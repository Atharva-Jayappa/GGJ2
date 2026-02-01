/**
 * Server entry point - Socket.io server for Protocol: UNMASK
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GameManager from './GameManager.js';
import { getPuzzleById, getRandomPuzzle } from './puzzleData.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from client build in production
const clientDistPath = join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// SPA fallback - serve index.html for all non-API routes (Express 5 compatible)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/socket.io') && !req.path.includes('.')) {
        res.sendFile(join(clientDistPath, 'index.html'));
    } else {
        next();
    }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6,
    perMessageDeflate: {
        threshold: 1024,
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: true,
    },
});

// Initialize game manager
const gameManager = new GameManager(io);

// Timeout check interval
setInterval(() => {
    gameManager.checkTimeouts();
}, 5000);

// Player namespace
io.on('connection', (socket) => {
    console.log(`[CONNECT] ${socket.id}`);

    // Player registration
    socket.on('register', (data, callback) => {
        const player = gameManager.registerPlayer(socket.id, data);

        // Broadcast to GM view
        io.to('gm').emit('player_joined', {
            id: socket.id,
            nickname: data.nickname,
            drawing: data.drawing,
            count: gameManager.players.size,
        });

        callback({ success: true, player, prompt: player.prompt });
    });

    // Request prompt before registration
    socket.on('get_prompt', (callback) => {
        callback({ prompt: gameManager.getRandomPrompt() });
    });

    // Get target info for chain phase
    socket.on('get_target', (callback) => {
        const target = gameManager.getTargetInfo(socket.id);
        callback({ target });
    });

    // Get squad status (for waiting view - how many confirmed)
    socket.on('get_squad_status', (callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            console.log(`[GET_SQUAD_STATUS] No player or squad for ${socket.id}, player exists: ${!!player}, squad: ${player?.squad}`);
            callback({ confirmedCount: 0, totalCount: 0, allConfirmed: false });
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            console.log(`[GET_SQUAD_STATUS] Squad ${player.squad} not found in squads map`);
            callback({ confirmedCount: 0, totalCount: 0, allConfirmed: false });
            return;
        }

        const confirmedCount = squad.getCompletedScans();
        const totalCount = squad.players.length;
        const allConfirmed = confirmedCount === totalCount;
        console.log(`[GET_SQUAD_STATUS] Squad ${player.squad}: ${confirmedCount}/${totalCount} confirmed`);

        callback({ confirmedCount, totalCount, allConfirmed });
    });

    // Scan target
    socket.on('scan', (data, callback) => {
        const result = gameManager.handleScan(socket.id, data.targetId);

        if (result.success) {
            const squad = gameManager.squads.get(result.squadId);

            // Notify ALL squad members about scan progress (emit to each player directly)
            if (squad) {
                const confirmedCount = squad.getCompletedScans();
                const totalCount = squad.players.length;
                const allConfirmed = confirmedCount === totalCount;

                squad.players.forEach(p => {
                    io.to(p.id).emit('scan_complete', {
                        scannerId: socket.id,
                        confirmedCount,
                        totalCount,
                        allConfirmed
                    });
                });

                if (result.loopComplete) {
                    squad.players.forEach(p => {
                        io.to(p.id).emit('squad_activated');
                    });
                }
            }

            // Broadcast to GM for network visualization
            io.to('gm').emit('scan_recorded', {
                squadId: result.squadId,
                scannerId: socket.id,
            });

            if (result.loopComplete) {
                io.to('gm').emit('squad_loop_complete', { squadId: result.squadId });
            }
        }

        callback(result);
    });

    // Verify QR code scan - validates scanned code matches target
    socket.on('verify_scan', (data, callback) => {
        const result = gameManager.verifyScan(socket.id, data.scannedCode);

        if (result.success) {
            // Also record the scan completion 
            const target = gameManager.getTargetInfo(socket.id);
            if (target) {
                const scanResult = gameManager.handleScan(socket.id, target.id);

                if (scanResult.success) {
                    const squad = gameManager.squads.get(scanResult.squadId);

                    if (squad) {
                        const confirmedCount = squad.getCompletedScans();
                        const totalCount = squad.players.length;
                        const allConfirmed = confirmedCount === totalCount;

                        squad.players.forEach(p => {
                            io.to(p.id).emit('scan_complete', {
                                scannerId: socket.id,
                                confirmedCount,
                                totalCount,
                                allConfirmed
                            });
                        });

                        if (scanResult.loopComplete) {
                            squad.players.forEach(p => {
                                io.to(p.id).emit('squad_activated');
                            });
                            io.to('gm').emit('squad_loop_complete', { squadId: scanResult.squadId });
                        }
                    }

                    io.to('gm').emit('scan_recorded', {
                        squadId: scanResult.squadId,
                        scannerId: socket.id,
                    });
                }
            }
        }

        callback(result);
    });

    // Get player's own scan code (for displaying their QR)
    socket.on('get_my_scan_code', (callback) => {
        const scanCode = gameManager.getPlayerScanCode(socket.id);
        callback({ scanCode });
    });

    // Minigame state updates
    socket.on('minigame_state', (data) => {
        gameManager.updateMinigameState(socket.id, data);
    });

    // Signal Jammer guess
    socket.on('signal_jammer_guess', (data, callback) => {
        const result = gameManager.handleSignalJammerGuess(socket.id, data.symbolIndex);

        if (!result.success) {
            // Broadcast error to GM for visual feedback
            io.to('gm').emit('squad_error', { squadId: result.squadId });
        }

        callback(result);
    });

    // Get clue for Signal Jammer
    socket.on('get_clue', (callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            console.log(`[GET_CLUE] No player or squad for ${socket.id}`);
            callback({ clue: null });
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            console.log(`[GET_CLUE] Squad ${player.squad} not found`);
            callback({ clue: null });
            return;
        }

        // If no puzzle assigned yet, assign one now (handles race conditions)
        if (!squad.puzzleId) {
            const puzzle = getRandomPuzzle();
            squad.puzzleId = puzzle.id;
            squad.correctSymbol = puzzle.correctIndex;
            console.log(`[GET_CLUE] Assigned puzzle ${puzzle.id} to squad ${player.squad} on-demand`);
        }

        // Get the puzzle assigned to this squad
        const puzzle = getPuzzleById(squad.puzzleId);
        if (!puzzle) {
            console.log(`[GET_CLUE] Puzzle ${squad.puzzleId} not found`);
            callback({ clue: null });
            return;
        }

        // Generate unique clue for this player based on their index in the squad
        const playerIndex = squad.players.findIndex(p => p.id === socket.id);
        const clue = puzzle.clues[playerIndex % puzzle.clues.length];
        
        console.log(`[GET_CLUE] Returning clue for player ${playerIndex} in squad ${player.squad}`);
        callback({ clue });
    });

    // Get puzzle data for Signal Jammer (grid, colors, puzzle name)
    socket.on('get_puzzle', (callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            console.log(`[GET_PUZZLE] No player or squad for ${socket.id}`);
            callback({ puzzle: null });
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            console.log(`[GET_PUZZLE] Squad ${player.squad} not found`);
            callback({ puzzle: null });
            return;
        }

        // If no puzzle assigned yet, assign one now (handles race conditions)
        if (!squad.puzzleId) {
            const puzzle = getRandomPuzzle();
            squad.puzzleId = puzzle.id;
            squad.correctSymbol = puzzle.correctIndex;
            console.log(`[GET_PUZZLE] Assigned puzzle ${puzzle.id} to squad ${player.squad} on-demand`);
        }

        // Get the puzzle assigned to this squad
        const puzzle = getPuzzleById(squad.puzzleId);
        if (!puzzle) {
            console.log(`[GET_PUZZLE] Puzzle ${squad.puzzleId} not found in database`);
            callback({ puzzle: null });
            return;
        }

        console.log(`[GET_PUZZLE] Returning puzzle ${puzzle.id} for squad ${player.squad}`);
        
        // Send puzzle data (grid and name) but NOT the correct answer
        callback({
            puzzle: {
                id: puzzle.id,
                name: puzzle.name,
                grid: puzzle.grid,
            }
        });
    });


    // Getaway code verification
    socket.on('verify_code', (data, callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            callback({ success: false });
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            callback({ success: false });
            return;
        }

        // Already completed - don't process again
        if (squad.finishPosition !== null) {
            callback({ success: true, position: squad.finishPosition, isWinner: squad.finishPosition === 1 });
            return;
        }

        const success = gameManager.verifyCode(player.squad, data.code);

        if (success) {
            // Track finish position - increment global counter
            if (!global.finishCounter) {
                global.finishCounter = 0;
            }
            global.finishCounter++;
            const position = global.finishCounter;
            const totalSquads = gameManager.squads.size;
            const isWinner = position === 1;

            // Mark squad as complete with position
            squad.markComplete(position);

            // Emit to each squad player directly with their result
            squad.players.forEach(p => {
                io.to(p.id).emit('heist_complete', {
                    position,
                    totalSquads,
                    isWinner,
                    tasksCompleted: squad.tasksCompleted
                });
            });

            io.to('gm').emit('squad_completed', {
                squadId: player.squad,
                position,
                totalSquads
            });

            // Broadcast updated leaderboard
            io.to('gm').emit('leaderboard_update', gameManager.getLeaderboard());

            callback({ success: true, position, isWinner });
        } else {
            callback({ success: false });
        }
    });

    // Squad-wide advance to next view - ONLY affects the player's squad
    socket.on('squad_advance', (data) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            console.log(`[SQUAD_ADVANCE] Player ${socket.id} not in a squad`);
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            console.log(`[SQUAD_ADVANCE] Squad ${player.squad} not found`);
            return;
        }

        // Check if ALL squad members have confirmed their scans
        const allConfirmed = squad.players.every(p => p.scanComplete);
        if (!allConfirmed) {
            console.log(`[SQUAD_ADVANCE] Squad ${player.squad} not all confirmed yet`);
            socket.emit('squad_advance_denied', {
                message: 'Waiting for all squad members to confirm their targets',
                confirmedCount: squad.getCompletedScans(),
                totalCount: squad.players.length
            });
            return;
        }

        console.log(`[SQUAD_ADVANCE] Squad ${player.squad} advancing to: ${data.view}`);
        
        // If advancing to signal_jammer, ensure puzzle is assigned
        if (data.view === 'signal_jammer' && !squad.puzzleId) {
            const puzzle = getRandomPuzzle();
            squad.puzzleId = puzzle.id;
            squad.correctSymbol = puzzle.correctIndex;
            console.log(`[SQUAD_ADVANCE] Assigned puzzle ${puzzle.id} to squad ${player.squad}`);
        }
        
        // Track the view change
        squad.setView(data.view);

        // Only broadcast to THIS squad's players
        squad.players.forEach(p => {
            io.to(p.id).emit('view_change', { view: data.view });
        });

        // Broadcast updated leaderboard to GM
        io.to('gm').emit('leaderboard_update', gameManager.getLeaderboard());
    });

    // Get code fragment - assigns unique positions to each player PER SQUAD
    // Uses the code generated by GameManager which scales with team size
    socket.on('get_fragment', (callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            callback({ char: '?', position: 1, codeLength: 4 });
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            callback({ char: '?', position: 1, codeLength: 4 });
            return;
        }

        const squadId = player.squad;

        // Get code from GameManager (generated during heist phase with team-size scaling)
        let codeFragments = gameManager.codeFragments.get(squadId);

        // If code doesn't exist yet, generate it now (handles squad_advance skipping global phase)
        if (!codeFragments || codeFragments.length === 0) {
            const teamSize = squad.players.length;
            codeFragments = gameManager.generateCodeFragments(teamSize);
            gameManager.codeFragments.set(squadId, codeFragments);
            console.log(`[FRAGMENT] Generated on-demand code for ${squadId}: ${codeFragments.join('')} (${teamSize} players)`);
        }

        const codeLength = codeFragments.length;

        // Initialize per-squad fragment tracking for player assignments
        if (!global.squadFragments) {
            global.squadFragments = new Map(); // squadId -> { assignments Map, counter }
        }

        // Initialize tracking for this squad if not exists
        if (!global.squadFragments.has(squadId)) {
            global.squadFragments.set(squadId, {
                assignments: new Map(),
                counter: 0
            });
            console.log(`[FRAGMENT] Squad ${squadId}: Code is ${codeFragments.join('')} (length ${codeLength})`);
        }

        const squadData = global.squadFragments.get(squadId);

        // Check if this socket already has an assignment
        if (squadData.assignments.has(socket.id)) {
            const assignment = squadData.assignments.get(socket.id);
            // Always include codeLength in case it was missing from earlier assignment
            assignment.codeLength = codeLength;
            callback(assignment);
            return;
        }

        // Assign next position (cycles through code length)
        const position = squadData.counter % codeLength;
        squadData.counter++;

        const assignment = {
            char: codeFragments[position],
            position: position + 1, // 1-indexed for display
            codeLength: codeLength
        };

        squadData.assignments.set(socket.id, assignment);
        console.log(`[FRAGMENT] Squad ${squadId}: Assigned position ${assignment.position}/${codeLength} (${assignment.char}) to ${socket.id}`);

        callback(assignment);
    });

    // Get tumbler configuration (random sweet spot angle per player) - PER SQUAD
    socket.on('get_tumbler_config', (callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            callback({ sweetSpotAngle: 45 }); // fallback
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            callback({ sweetSpotAngle: 45 }); // fallback
            return;
        }

        const squadId = player.squad;

        // Initialize per-squad tumbler angle tracking
        if (!global.squadTumblerAngles) {
            global.squadTumblerAngles = new Map(); // squadId -> Map of player angles
        }

        if (!global.squadTumblerAngles.has(squadId)) {
            global.squadTumblerAngles.set(squadId, new Map());
        }

        const squadAngles = global.squadTumblerAngles.get(squadId);

        // Check if player already has an assigned angle
        if (squadAngles.has(socket.id)) {
            const angle = squadAngles.get(socket.id);
            console.log(`[TUMBLER] Player ${socket.id} retrieving existing angle: ${angle}°`);
            callback({ sweetSpotAngle: angle });
            return;
        }

        // Generate a random angle between 0 and 359
        const randomAngle = Math.floor(Math.random() * 360);
        squadAngles.set(socket.id, randomAngle);
        console.log(`[TUMBLER] Squad ${squadId}: Assigned angle ${randomAngle}° to player ${socket.id}`);

        callback({ sweetSpotAngle: randomAngle });
    });

    // Tumbler state tracking for sync - PER SQUAD
    socket.on('tumbler_state', (data) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) return;

        const squad = gameManager.squads.get(player.squad);
        if (!squad) return;

        const squadId = player.squad;

        // Initialize per-squad tumbler tracking
        if (!global.squadTumblerStates) {
            global.squadTumblerStates = new Map(); // squadId -> Map of player states
            global.squadTumblerSyncStart = new Map(); // squadId -> timestamp
        }

        if (!global.squadTumblerStates.has(squadId)) {
            global.squadTumblerStates.set(squadId, new Map());
        }

        const squadStates = global.squadTumblerStates.get(squadId);
        squadStates.set(socket.id, {
            atSweetSpot: data.atSweetSpot,
            timestamp: Date.now()
        });

        // Clean up stale entries for this squad (players who haven't sent update in 2s)
        const now = Date.now();
        for (const [id, state] of squadStates.entries()) {
            if (now - state.timestamp > 2000) {
                squadStates.delete(id);
            }
        }

        // Count how many squad members are at sweet spot
        const squadSize = squad.players.length;
        let playersAtSweetSpot = 0;

        for (const [, state] of squadStates.entries()) {
            if (state.atSweetSpot) playersAtSweetSpot++;
        }

        // Check if ALL squad members are at sweet spot
        const allSynced = squadStates.size === squadSize && playersAtSweetSpot === squadSize;

        if (allSynced) {
            if (!global.squadTumblerSyncStart.has(squadId)) {
                global.squadTumblerSyncStart.set(squadId, Date.now());
                console.log(`[TUMBLER] Squad ${squadId} all synced! Starting 3s timer...`);
            }

            const syncTime = (Date.now() - global.squadTumblerSyncStart.get(squadId)) / 1000;

            // Broadcast sync progress to THIS SQUAD ONLY
            squad.players.forEach(p => {
                io.to(p.id).emit('tumbler_sync', {
                    synced: true,
                    syncTime: syncTime,
                    playersReady: playersAtSweetSpot,
                    totalPlayers: squadSize
                });
            });

            // If synced for 3 seconds, advance THIS SQUAD ONLY!
            if (syncTime >= 3) {
                console.log(`[TUMBLER] Squad ${squadId} VAULT CRACKED! All players held for 3s!`);
                global.squadTumblerSyncStart.delete(squadId);
                global.squadTumblerStates.delete(squadId);

                // Advance only this squad
                squad.players.forEach(p => {
                    io.to(p.id).emit('view_change', { view: 'getaway' });
                });
            }
        } else {
            // Not all synced - reset timer for this squad
            if (global.squadTumblerSyncStart.has(squadId)) {
                console.log(`[TUMBLER] Squad ${squadId} sync broken - timer reset`);
                global.squadTumblerSyncStart.delete(squadId);
            }

            // Broadcast current status to THIS SQUAD ONLY
            squad.players.forEach(p => {
                io.to(p.id).emit('tumbler_sync', {
                    synced: false,
                    syncTime: 0,
                    playersReady: playersAtSweetSpot,
                    totalPlayers: squadSize
                });
            });
        }
    });

    // Heartbeat for disconnect handling
    socket.on('heartbeat', () => {
        gameManager.handleHeartbeat(socket.id);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] ${socket.id}`);
        gameManager.removePlayer(socket.id);

        io.to('gm').emit('player_left', {
            id: socket.id,
            count: gameManager.players.size,
        });
    });
});

// Game Master namespace
const gmNamespace = io.of('/gm');

gmNamespace.on('connection', (socket) => {
    console.log('[GM CONNECT]');
    socket.join('gm');

    // Send current game state
    socket.emit('game_state', gameManager.getGameState());

    // Admin controls
    socket.on('set_phase', (data) => {
        console.log(`[GM] Setting phase to: ${data.phase}`);
        const result = gameManager.setPhase(data.phase);
        if (!result.success) {
            socket.emit('phase_error', { message: result.message });
        }
        gmNamespace.emit('game_state', gameManager.getGameState());
    });

    socket.on('set_team_size', (data) => {
        console.log(`[GM] Setting team size to: ${data.size}`);
        gameManager.setTeamSize(data.size);
        gmNamespace.emit('game_state', gameManager.getGameState());
    });

    socket.on('start_game', () => {
        const result = gameManager.setPhase('chain');
        if (!result.success) {
            socket.emit('phase_error', { message: result.message });
        }
        gmNamespace.emit('game_state', gameManager.getGameState());
    });

    socket.on('reset_game', () => {
        gameManager.resetGame();

        // Clear all per-squad global state
        if (global.squadTumblerStates) global.squadTumblerStates.clear();
        if (global.squadTumblerSyncStart) global.squadTumblerSyncStart.clear();
        if (global.squadFragments) global.squadFragments.clear();
        if (global.squadTumblerAngles) global.squadTumblerAngles.clear();

        io.emit('game_reset');
        gmNamespace.emit('game_state', gameManager.getGameState());
    });
});

// Periodic state broadcast to GM (every 2 seconds for auto-refresh)
setInterval(() => {
    gmNamespace.emit('game_state', gameManager.getGameState());
}, 1000);

const PORT = process.env.PORT || 3001;
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

httpServer.listen(PORT, HOST, () => {
    console.log(`🎮 Protocol: UNMASK server running on ${HOST}:${PORT}`);
    console.log(`📊 Configured for up to 100+ concurrent players`);
});
