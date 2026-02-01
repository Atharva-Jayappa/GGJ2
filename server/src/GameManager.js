/**
 * GameManager.js - Central game state management
 * Handles player assignment, phase transitions, and game coordination
 */

import { v4 as uuidv4 } from 'uuid';
import Squad from './Squad.js';
import { PUZZLES, getRandomPuzzle } from './puzzleData.js';

// Game prompts for the lobby phase
const PROMPTS = [
    "My most recognizable feature is…",
    "People always confuse me for…",
    "I am absolutely NOT…",
    "My secret talent is…",
    "If I were a superhero, my power would be…",
    "The strangest thing about me is…",
    "You'll never guess that I…",
    "My friends describe me as…",
];

class GameManager {
    constructor(io) {
        this.io = io;
        this.phase = 'start'; // start, tutorial, lobby, chain, heist, getaway, complete
        this.players = new Map(); // socketId -> player data
        this.squads = new Map(); // squadId -> Squad instance
        this.drawings = []; // All submitted drawings for GM view
        this.codeFragments = new Map(); // squadId -> array of code fragments
        this.maxPlayers = 100;
        this.squadSize = 4; // configurable team size
        this.gracePeriodsMs = 30000;
    }

    /**
     * Set the team size
     * @param {number} size
     */
    setTeamSize(size) {
        if (size >= 2 && size <= 10) {
            this.squadSize = size;
        }
    }

    /**
     * Get a random prompt for a player
     * @returns {string}
     */
    getRandomPrompt() {
        return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    }

    /**
     * Register a new player
     * @param {string} socketId
     * @param {Object} data - { nickname, drawing, tell }
     * @returns {Object} - Player object with assigned prompt
     */
    registerPlayer(socketId, data) {
        const player = {
            id: socketId,
            nickname: data.nickname,
            drawing: data.drawing,
            tell: data.tell,
            prompt: data.prompt || this.getRandomPrompt(),
            squad: null,
            joinedAt: Date.now(),
        };

        this.players.set(socketId, player);
        this.drawings.push({
            id: socketId,
            drawing: data.drawing,
            nickname: data.nickname,
            timestamp: Date.now(),
        });

        return player;
    }

    /**
     * Remove a player
     * @param {string} socketId
     */
    removePlayer(socketId) {
        const player = this.players.get(socketId);

        if (player && player.squad) {
            const squad = this.squads.get(player.squad);
            if (squad) {
                squad.removePlayer(socketId);
            }
        }

        // Remove player's drawing from the drawings array
        this.drawings = this.drawings.filter(d => d.id !== socketId);

        this.players.delete(socketId);
    }

    /**
     * Assign all registered players into circular squads
     * Called when game starts (transitions from lobby to chain phase)
     * Assumes canStartGame() validation has passed (playerCount divisible by squadSize)
     */
    formSquads() {
        const playerList = Array.from(this.players.values());

        // Shuffle players randomly using Fisher-Yates
        for (let i = playerList.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerList[i], playerList[j]] = [playerList[j], playerList[i]];
        }

        // Clear any existing squads
        this.squads.clear();

        // Form squads of exactly squadSize players
        const numSquads = Math.floor(playerList.length / this.squadSize);

        for (let squadIdx = 0; squadIdx < numSquads; squadIdx++) {
            const squadId = `squad_${squadIdx + 1}`;
            const squad = new Squad(squadId, this.squadSize);

            const startIdx = squadIdx * this.squadSize;
            const endIdx = startIdx + this.squadSize;

            for (let i = startIdx; i < endIdx; i++) {
                const player = playerList[i];

                // Generate unique scan code for QR verification
                player.scanCode = this.generateScanCode();

                squad.addPlayer(player);
                player.squad = squadId;
                this.players.set(player.id, player);
            }

            this.squads.set(squadId, squad);
        }

        // Sanity check: verify all players assigned and squad sizes are correct
        console.log(`[SQUADS] Formed ${this.squads.size} squads of ${this.squadSize} players each`);
        for (const [squadId, squad] of this.squads) {
            console.log(`  ${squadId}: ${squad.players.length} players`);
        }
    }

    /**
     * Generate a unique scan code for QR verification
     * @returns {string}
     */
    generateScanCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars like 0/O, 1/I
        let code = 'UNMASK-';
        for (let i = 0; i < 8; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    /**
     * Get the target information for a player
     * @param {string} socketId
     * @returns {Object|null}
     */
    getTargetInfo(socketId) {
        const player = this.players.get(socketId);
        if (!player || !player.squad) return null;

        const squad = this.squads.get(player.squad);
        if (!squad) return null;

        const target = squad.getTarget(socketId);
        if (!target) return null;

        return {
            id: target.id,
            drawing: target.drawing,
            tell: target.tell,
            prompt: target.prompt,
            scanCode: target.scanCode, // Include scan code for QR verification
        };
    }

    /**
     * Get the player's own scan code (for displaying their QR)
     * @param {string} socketId
     * @returns {string|null}
     */
    getPlayerScanCode(socketId) {
        const player = this.players.get(socketId);
        return player?.scanCode || null;
    }

    /**
     * Verify a QR scan - check if scanned code matches player's target
     * @param {string} scannerId - The player doing the scanning
     * @param {string} scannedCode - The code that was scanned
     * @returns {Object} - { success, message }
     */
    verifyScan(scannerId, scannedCode) {
        const scanner = this.players.get(scannerId);
        if (!scanner || !scanner.squad) {
            return { success: false, message: 'Invalid player' };
        }

        const squad = this.squads.get(scanner.squad);
        if (!squad) {
            return { success: false, message: 'Squad not found' };
        }

        const target = squad.getTarget(scannerId);
        if (!target) {
            return { success: false, message: 'Target not found' };
        }

        // Verify the scanned code matches the target's code
        if (scannedCode === target.scanCode) {
            console.log(`[SCAN VERIFIED] Player ${scannerId} correctly scanned target ${target.id}`);
            return { success: true, message: 'Target verified!' };
        } else {
            console.log(`[SCAN FAILED] Player ${scannerId} scanned wrong code. Expected: ${target.scanCode}, Got: ${scannedCode}`);
            return { success: false, message: 'Wrong target! Keep looking.' };
        }
    }

    /**
     * Handle a scan action
     * @param {string} scannerId
     * @param {string} targetId
     * @returns {Object} - { success, message, loopComplete }
     */
    handleScan(scannerId, targetId) {
        const scanner = this.players.get(scannerId);
        if (!scanner || !scanner.squad) {
            return { success: false, message: 'Player not in squad' };
        }

        const squad = this.squads.get(scanner.squad);
        if (!squad) {
            return { success: false, message: 'Squad not found' };
        }

        const success = squad.recordScan(scannerId, targetId);

        if (!success) {
            return { success: false, message: 'Invalid target' };
        }

        return {
            success: true,
            message: 'Target locked',
            loopComplete: squad.isLoopComplete,
            squadId: scanner.squad,
        };
    }

    /**
     * Validate if game can start with current player count and team size
     * @returns {{ valid: boolean, message: string }}
     */
    canStartGame() {
        const count = this.players.size;
        if (count < this.squadSize) {
            return { valid: false, message: `Need at least ${this.squadSize} players` };
        }
        if (count % this.squadSize !== 0) {
            const needed = this.squadSize - (count % this.squadSize);
            return { valid: false, message: `Need ${needed} more players for even teams` };
        }
        return { valid: true, message: 'Ready to start' };
    }

    /**
     * Transition to a new phase
     * @param {string} newPhase
     * @returns {{ success: boolean, message?: string }}
     */
    setPhase(newPhase) {
        // Server-side validation for chain phase
        if (newPhase === 'chain') {
            const validation = this.canStartGame();
            if (!validation.valid) {
                return { success: false, message: validation.message };
            }
            this.formSquads();
        }

        this.phase = newPhase;

        if (newPhase === 'heist') {
            // Initialize code fragments and assign puzzles for each squad
            // Code length is based on squad size (1 char per player)
            this.squads.forEach((squad, squadId) => {
                const teamSize = squad.players.length;
                this.codeFragments.set(squadId, this.generateCodeFragments(teamSize));
                
                // Assign a random puzzle to this squad
                const puzzle = getRandomPuzzle();
                squad.puzzleId = puzzle.id;
                squad.correctSymbol = puzzle.correctIndex;
                console.log(`[HEIST] Squad ${squadId} assigned puzzle: ${puzzle.id} (answer: ${puzzle.correctIndex})`);
                
                squad.setMinigame('signal_jammer');
                squad.setView('signal_jammer');

                // Generate random correct symbol for Signal Jammer (0-8 for 9 symbols)
                squad.correctSymbol = Math.floor(Math.random() * 9);
                console.log(`[HEIST] Squad ${squadId} correct symbol: ${squad.correctSymbol}`);

                // Generate unique clues for each player based on the correct symbol
                squad.clues = this.generateSignalJammerClues(squad.correctSymbol, teamSize);
            });

            // Broadcast initial leaderboard
            this.io.to('gm').emit('leaderboard_update', this.getLeaderboard());
        }

        if (newPhase === 'getaway') {
            // Generate codes if they weren't already generated during heist
            // This handles edge cases like skipping directly to getaway
            this.squads.forEach((squad, squadId) => {
                if (!this.codeFragments.has(squadId)) {
                    const teamSize = squad.players.length;
                    this.codeFragments.set(squadId, this.generateCodeFragments(teamSize));
                    console.log(`[GETAWAY] Generated fallback code for ${squadId}: ${this.codeFragments.get(squadId).join('')}`);
                }
            });
        }

        this.io.emit('phase_change', { phase: newPhase });
        return { success: true };
    }

    /**
     * Reset the game to initial state
     */
    resetGame() {
        this.phase = 'start';
        this.players.clear();
        this.squads.clear();
        this.drawings = [];
        this.codeFragments.clear();
        this.squadSize = 4; // Reset to default team size
        // Reset global finish counter and squad fragments
        global.finishCounter = 0;
        global.squadFragments = new Map();
    }

    /**
     * Get leaderboard data showing all squads' progress
     * @returns {Array} Sorted array of squad progress data
     */
    getLeaderboard() {
        const squadNames = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET'];
        const leaderboard = [];
        let index = 0;

        this.squads.forEach((squad, squadId) => {
            // Calculate progress percentage based on view
            let progressPercent = 0;
            switch (squad.currentView) {
                case 'lobby': progressPercent = 0; break;
                case 'chain': progressPercent = 10; break;
                case 'scanner': progressPercent = 15; break;
                case 'waiting': progressPercent = 20; break;
                case 'signal_jammer': progressPercent = 30; break;
                case 'tumbler': progressPercent = 50; break;
                case 'getaway': progressPercent = 75; break;
                case 'complete': progressPercent = 100; break;
                default: progressPercent = 0;
            }

            leaderboard.push({
                id: squadId,
                name: squadNames[index] || `SQUAD ${index + 1}`,
                currentView: squad.currentView,
                progressPercent,
                tasksCompleted: squad.tasksCompleted,
                finishPosition: squad.finishPosition,
                completedAt: squad.completedAt,
                playerCount: squad.players.length,
                isComplete: squad.finishPosition !== null,
            });
            index++;
        });

        // Sort: completed squads by position, then incomplete by progress
        leaderboard.sort((a, b) => {
            if (a.isComplete && b.isComplete) {
                return a.finishPosition - b.finishPosition;
            }
            if (a.isComplete) return -1;
            if (b.isComplete) return 1;
            return b.progressPercent - a.progressPercent;
        });

        return leaderboard;
    }

    /**
     * Generate random code fragments for the getaway phase
     * Code length scales with team size: 1 character per player
     * Uses only characters available on the keypad: A-H and 1-8
     * @param {number} teamSize - Number of players in the squad
     * @returns {Array}
     */
    generateCodeFragments(teamSize) {
        // Only use characters that appear on the keypad
        const keypadChars = 'ABCDEFGH12345678';
        const codeLength = teamSize; // 1 character per player
        const fragments = [];
        for (let i = 0; i < codeLength; i++) {
            fragments.push(keypadChars[Math.floor(Math.random() * keypadChars.length)]);
        }
        return fragments;
    }

    /**
     * Generate unique clues for Signal Jammer minigame
     * Clues are based on the correct symbol's position in a 3x3 grid
     * @param {number} correctSymbol - Index 0-8 of the correct symbol
     * @param {number} teamSize - Number of players to generate clues for
     * @returns {Array} Array of clue strings
     */
    generateSignalJammerClues(correctSymbol, teamSize) {
        // 3x3 grid positions: 0-2 top row, 3-5 middle row, 6-8 bottom row
        const row = Math.floor(correctSymbol / 3); // 0=top, 1=middle, 2=bottom
        const col = correctSymbol % 3; // 0=left, 1=center, 2=right

        // Colors assigned to each symbol (matching client RUNE_COLORS)
        const colorNames = ['cyan', 'pink', 'green', 'yellow', 'red', 'purple', 'blue', 'orange', 'teal'];
        const correctColor = colorNames[correctSymbol];

        // Generate a pool of TRUE clues about the correct symbol
        const trueClues = [];

        // Row clues
        if (row === 0) trueClues.push('The symbol is in the TOP row');
        if (row === 1) trueClues.push('The symbol is in the MIDDLE row');
        if (row === 2) trueClues.push('The symbol is in the BOTTOM row');

        // Column clues
        if (col === 0) trueClues.push('The symbol is in the LEFT column');
        if (col === 1) trueClues.push('The symbol is in the CENTER column');
        if (col === 2) trueClues.push('The symbol is in the RIGHT column');

        // Color clues
        trueClues.push(`The symbol is ${correctColor.toUpperCase()} colored`);

        // "NOT" clues (things the symbol is NOT)
        const wrongColors = colorNames.filter((_, i) => i !== correctSymbol);
        trueClues.push(`The symbol is NOT ${wrongColors[0]} colored`);
        trueClues.push(`The symbol is NOT ${wrongColors[1]} colored`);

        if (row !== 0) trueClues.push('The symbol is NOT in the first row');
        if (row !== 2) trueClues.push('The symbol is NOT in the last row');
        if (col !== 0) trueClues.push('The symbol is NOT in the first column');
        if (col !== 2) trueClues.push('The symbol is NOT in the last column');

        // Shuffle and pick enough clues for the team
        const shuffled = trueClues.sort(() => Math.random() - 0.5);
        const clues = [];
        for (let i = 0; i < teamSize; i++) {
            clues.push(shuffled[i % shuffled.length]);
        }

        return clues;
    }

    /**
     * Get all squad statuses for GM view
     * @returns {Array}
     */
    getAllSquadStatuses() {
        return Array.from(this.squads.values()).map(s => s.getStatus());
    }

    /**
     * Get the current game state for broadcasting
     * @returns {Object}
     */
    getGameState() {
        return {
            phase: this.phase,
            playerCount: this.players.size,
            maxPlayers: this.maxPlayers,
            squadCount: this.squads.size,
            teamSize: this.squadSize,
            drawings: this.drawings,
            squads: this.getAllSquadStatuses(),
            leaderboard: this.getLeaderboard(),
        };
    }

    /**
     * Update minigame state for a player
     * @param {string} playerId
     * @param {Object} state
     */
    updateMinigameState(playerId, state) {
        const player = this.players.get(playerId);
        if (!player || !player.squad) return;

        const squad = this.squads.get(player.squad);
        if (!squad) return;

        squad.updateMinigameState(playerId, state);

        // Check for Tumbler win condition
        if (squad.currentMinigame === 'tumbler' && squad.checkAllAtSweetSpot()) {
            // Start 3-second timer for synchronized hold
            if (!squad.syncTimer) {
                squad.syncTimer = setTimeout(() => {
                    if (squad.checkAllAtSweetSpot()) {
                        squad.updateProgress(25);
                        squad.syncTimer = null;
                        this.io.to(player.squad).emit('minigame_success', { game: 'tumbler' });
                    }
                }, 3000);
            }
        }
    }

    /**
     * Handle Signal Jammer guess
     * @param {string} playerId
     * @param {number} symbolIndex
     * @returns {Object}
     */
    handleSignalJammerGuess(playerId, symbolIndex) {
        const player = this.players.get(playerId);
        if (!player || !player.squad) {
            return { success: false };
        }

        const squad = this.squads.get(player.squad);
        if (!squad) return { success: false };

        // The correct symbol is stored per squad
        const correctSymbol = squad.correctSymbol || 0;

        if (symbolIndex === correctSymbol) {
            squad.updateProgress(25);
            return { success: true, squadProgress: squad.progress };
        }

        return { success: false, squadId: player.squad };
    }

    /**
     * Verify final code for getaway phase
     * @param {string} squadId
     * @param {string} code
     * @returns {boolean}
     */
    verifyCode(squadId, code) {
        const fragments = this.codeFragments.get(squadId);
        if (!fragments) return false;

        const correctCode = fragments.join('');
        return code.toUpperCase() === correctCode;
    }

    /**
     * Handle heartbeat from player
     * @param {string} socketId
     */
    handleHeartbeat(socketId) {
        const player = this.players.get(socketId);
        if (player && player.squad) {
            const squad = this.squads.get(player.squad);
            if (squad) {
                squad.handleReconnect(socketId);
            }
        }
    }

    /**
     * Check for timed out players across all squads
     */
    checkTimeouts() {
        this.squads.forEach((squad, squadId) => {
            const timedOut = squad.checkTimeouts(this.gracePeriodsMs);
            timedOut.forEach(player => {
                // Auto-resolve: mark their scans as complete
                const target = squad.getTarget(player.id);
                if (target && !squad.scanMap.has(player.id)) {
                    squad.recordScan(player.id, target.id);
                    this.io.to(squadId).emit('auto_resolved', { playerId: player.id });
                }
            });
        });
    }
}

export default GameManager;
