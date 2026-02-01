/**
 * GameManager.js - Central game state management
 * Handles player assignment, phase transitions, and game coordination
 */

import { v4 as uuidv4 } from 'uuid';
import Squad from './Squad.js';

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
        };
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
            // Initialize code fragments for each squad
            this.squads.forEach((squad, squadId) => {
                this.codeFragments.set(squadId, this.generateCodeFragments());
                squad.setMinigame('signal_jammer');
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
    }

    /**
     * Generate random code fragments for the getaway phase
     * @returns {Array}
     */
    generateCodeFragments() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const fragments = [];
        for (let i = 0; i < 4; i++) {
            fragments.push(chars[Math.floor(Math.random() * chars.length)]);
        }
        return fragments;
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
