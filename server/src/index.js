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

    // Scan target
    socket.on('scan', (data, callback) => {
        const result = gameManager.handleScan(socket.id, data.targetId);

        if (result.success) {
            // Notify squad about scan progress
            io.to(result.squadId).emit('scan_complete', {
                scannerId: socket.id,
            });

            // Broadcast to GM for network visualization
            io.to('gm').emit('scan_recorded', {
                squadId: result.squadId,
                scannerId: socket.id,
            });

            if (result.loopComplete) {
                io.to(result.squadId).emit('squad_activated');
                io.to('gm').emit('squad_loop_complete', { squadId: result.squadId });
            }
        }

        callback(result);
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
            callback({ clue: null });
            return;
        }

        const squad = gameManager.squads.get(player.squad);
        if (!squad) {
            callback({ clue: null });
            return;
        }

        // Generate unique clue for this player
        const playerIndex = squad.players.findIndex(p => p.id === socket.id);
        const clues = [
            'It is NOT in the first row',
            'It is NOT in the first column',
            'It is NOT red',
            'It is in the center area',
            'It has a sharp angle',
        ];

        callback({ clue: clues[playerIndex % clues.length] });
    });

    // Getaway code verification
    socket.on('verify_code', (data, callback) => {
        const player = gameManager.players.get(socket.id);
        if (!player || !player.squad) {
            callback({ success: false });
            return;
        }

        const success = gameManager.verifyCode(player.squad, data.code);

        if (success) {
            io.to(player.squad).emit('heist_complete');
            io.to('gm').emit('squad_completed', { squadId: player.squad });
        }

        callback({ success });
    });

    // DEV: Squad-wide advance to next view
    // When one player triggers this, ALL players advance
    socket.on('squad_advance', (data) => {
        console.log(`[SQUAD_ADVANCE] Broadcasting view change to: ${data.view}`);
        // Broadcast to ALL connected players
        io.emit('view_change', { view: data.view });
    });

    // Get code fragment - assigns unique positions to each player
    socket.on('get_fragment', (callback) => {
        const CODE = 'A3F7';

        // Initialize fragment tracking
        if (!global.fragmentAssignments) {
            global.fragmentAssignments = new Map();
            global.fragmentCounter = 0;
        }

        // Check if this socket already has an assignment
        if (global.fragmentAssignments.has(socket.id)) {
            const assignment = global.fragmentAssignments.get(socket.id);
            callback(assignment);
            return;
        }

        // Assign next position (cycles 0-3)
        const position = global.fragmentCounter % 4;
        global.fragmentCounter++;

        const assignment = {
            char: CODE[position],
            position: position + 1 // 1-indexed for display
        };

        global.fragmentAssignments.set(socket.id, assignment);
        console.log(`[FRAGMENT] Assigned position ${assignment.position} (${assignment.char}) to ${socket.id}`);

        callback(assignment);
    });

    // Tumbler state tracking for sync
    socket.on('tumbler_state', (data) => {
        // Track this player's sweet spot state
        if (!global.tumblerStates) {
            global.tumblerStates = new Map();
            global.tumblerSyncStart = null;
        }

        global.tumblerStates.set(socket.id, {
            atSweetSpot: data.atSweetSpot,
            timestamp: Date.now()
        });

        // Clean up stale entries (players who haven't sent update in 2s)
        const now = Date.now();
        for (const [id, state] of global.tumblerStates.entries()) {
            if (now - state.timestamp > 2000) {
                global.tumblerStates.delete(id);
            }
        }

        // Count how many players are connected and at sweet spot
        const totalPlayers = global.tumblerStates.size;
        let playersAtSweetSpot = 0;

        for (const [, state] of global.tumblerStates.entries()) {
            if (state.atSweetSpot) playersAtSweetSpot++;
        }

        // Check if ALL players are at sweet spot
        const allSynced = totalPlayers > 0 && playersAtSweetSpot === totalPlayers;

        if (allSynced) {
            if (!global.tumblerSyncStart) {
                global.tumblerSyncStart = Date.now();
                console.log('[TUMBLER] All players synced! Starting 3s timer...');
            }

            const syncTime = (Date.now() - global.tumblerSyncStart) / 1000;

            // Broadcast sync progress to all players
            io.emit('tumbler_sync', {
                synced: true,
                syncTime: syncTime,
                playersReady: playersAtSweetSpot,
                totalPlayers: totalPlayers
            });

            // If synced for 3 seconds, advance!
            if (syncTime >= 3) {
                console.log('[TUMBLER] VAULT CRACKED! All players held for 3s!');
                global.tumblerSyncStart = null;
                global.tumblerStates.clear();
                io.emit('view_change', { view: 'getaway' });
            }
        } else {
            // Not all synced - reset timer
            if (global.tumblerSyncStart) {
                console.log('[TUMBLER] Sync broken - timer reset');
                global.tumblerSyncStart = null;
            }

            // Broadcast current status
            io.emit('tumbler_sync', {
                synced: false,
                syncTime: 0,
                playersReady: playersAtSweetSpot,
                totalPlayers: totalPlayers
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

    socket.on('start_heist', () => {
        gameManager.setPhase('heist');
        gmNamespace.emit('game_state', gameManager.getGameState());
    });

    socket.on('reset_game', () => {
        gameManager.resetGame();
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
