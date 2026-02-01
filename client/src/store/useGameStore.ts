import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

// Types
export type GamePhase = 'lobby' | 'chain' | 'heist' | 'getaway';
export type GameView = 'lobby' | 'scanner' | 'waiting' | 'signal_jammer' | 'tumbler' | 'getaway' | 'complete';

export interface PlayerData {
    id: string;
    nickname: string;
    drawing: string; // Base64 canvas data
    tell: string;
    prompt: string;
}

export interface TargetData {
    id: string;
    drawing: string;
    tell: string;
    prompt: string;
    scanCode?: string; // Target's scan code for QR verification
}

export interface SquadData {
    id: string;
    members: string[];
    loopComplete: boolean;
    progress: number;
    currentMinigame: string | null;
}

export interface ClueData {
    clue: string;
}

export interface PuzzleCell {
    symbol: string;
    color: string;
}

export interface PuzzleData {
    id: string;
    name: string;
    grid: PuzzleCell[];
}

export interface SquadStatus {
    confirmedCount: number;
    totalCount: number;
    allConfirmed: boolean;
}

export interface HeistResult {
    position: number;
    totalSquads: number;
    isWinner: boolean;
    tasksCompleted: number;
}

export interface GameState {
    // Connection
    socket: Socket | null;
    connected: boolean;

    // Game State
    phase: GamePhase;
    currentView: GameView;

    // Player Data
    player: PlayerData | null;
    target: TargetData | null;

    // Squad Data
    squad: SquadData | null;
    squadStatus: SquadStatus | null;

    // Minigame Data
    clue: string | null;
    puzzleData: PuzzleData | null;
    codeFragments: string[];

    // Result Data
    heistResult: HeistResult | null;

    // UI State
    isScanning: boolean;
    scanComplete: boolean;
    showSuccess: boolean;
    showError: boolean;

    // QR Scan Code
    myScanCode: string | null;

    // Actions
    connect: () => void;
    disconnect: () => void;

    // Registration
    setPlayerData: (data: Partial<PlayerData>) => void;
    register: (data: { nickname: string; drawing: string; tell: string; prompt: string }) => Promise<void>;

    // Game Flow
    setView: (view: GameView) => void;
    getTarget: () => Promise<void>;
    performScan: (targetId: string) => Promise<{ success: boolean; loopComplete?: boolean }>;

    // Minigames
    getClue: () => Promise<void>;
    getPuzzle: () => Promise<void>;
    submitSignalJammerGuess: (symbolIndex: number) => Promise<{ success: boolean }>;
    updateTumblerState: (state: { angle: number; atSweetSpot: boolean }) => void;

    // Getaway
    verifyCode: (code: string) => Promise<{ success: boolean }>;

    // Squad
    squadAdvance: (view: GameView) => void;
    getSquadStatus: () => Promise<SquadStatus>;

    // QR Code Verification
    getMyScanCode: () => Promise<void>;
    verifyScan: (scannedCode: string) => Promise<{ success: boolean; message: string }>;

    // UI
    triggerSuccess: () => void;
    triggerError: () => void;
    clearEffects: () => void;
}

// Socket URL configuration
// When accessed via ngrok or external URL, use the same origin (Vite proxy handles it)
// When localhost, connect directly to backend
const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const SOCKET_URL = isLocalhost
    ? 'http://localhost:3001'
    : window.location.origin;

export const useGameStore = create<GameState>((set, get) => ({
    // Initial State
    socket: null,
    connected: false,
    phase: 'lobby',
    currentView: 'lobby',
    player: null,
    target: null,
    squad: null,
    squadStatus: null,
    clue: null,
    puzzleData: null,
    codeFragments: [],
    heistResult: null,
    isScanning: false,
    scanComplete: false,
    showSuccess: false,
    showError: false,
    myScanCode: null,

    // Connection
    connect: () => {
        if (get().socket) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            set({ connected: true });
            console.log('[SOCKET] Connected');
        });

        socket.on('disconnect', () => {
            set({ connected: false });
            console.log('[SOCKET] Disconnected');
        });

        // Phase changes
        socket.on('phase_change', (data: { phase: GamePhase }) => {
            set({ phase: data.phase });

            // Auto-transition view based on phase
            if (data.phase === 'chain') {
                set({ currentView: 'scanner' });
                get().getTarget();
            } else if (data.phase === 'heist') {
                set({ currentView: 'signal_jammer' });
                get().getClue();
                get().getPuzzle();
            } else if (data.phase === 'getaway') {
                set({ currentView: 'getaway' });
            }
        });

        // Clue updates
        socket.on('clue_update', (data: ClueData) => {
            set({ clue: data.clue });
        });

        // Squad activated
        socket.on('squad_activated', () => {
            set({ currentView: 'waiting' });
            get().triggerSuccess();
        });

        // Scan complete notification - update squad status directly from server
        socket.on('scan_complete', (data: { scannerId: string; confirmedCount: number; totalCount: number; allConfirmed: boolean }) => {
            console.log('[SOCKET] scan_complete received:', data);
            // Update squad status directly from the authoritative server broadcast
            set({ squadStatus: { confirmedCount: data.confirmedCount, totalCount: data.totalCount, allConfirmed: data.allConfirmed } });
        });

        // Squad advance denied - not all confirmed yet
        socket.on('squad_advance_denied', (data: { message: string; confirmedCount: number; totalCount: number }) => {
            console.log('[SOCKET] Squad advance denied:', data.message);
            set({ squadStatus: { confirmedCount: data.confirmedCount, totalCount: data.totalCount, allConfirmed: false } });
            get().triggerError();
        });

        // Minigame events
        socket.on('minigame_success', (data: { game: string }) => {
            get().triggerSuccess();
            if (data.game === 'tumbler') {
                set({ currentView: 'getaway' });
            }
        });

        // Heist complete with result data
        socket.on('heist_complete', (data: { position: number; totalSquads: number; isWinner: boolean; tasksCompleted: number }) => {
            set({
                currentView: 'complete',
                heistResult: data
            });
            get().triggerSuccess();
        });

        // Game reset
        socket.on('game_reset', () => {
            set({
                phase: 'lobby',
                currentView: 'lobby',
                player: null,
                target: null,
                squad: null,
                squadStatus: null,
                clue: null,
                codeFragments: [],
                heistResult: null,
                scanComplete: false,
            });
        });

        // DEV: View change broadcast - syncs all players
        socket.on('view_change', (data: { view: GameView }) => {
            console.log('[SOCKET] View change received:', data.view);
            set({ currentView: data.view });
        });

        // Heartbeat
        setInterval(() => {
            socket.emit('heartbeat');
        }, 10000);

        set({ socket });
    },

    disconnect: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
            set({ socket: null, connected: false });
        }
    },

    // Registration
    setPlayerData: (data) => {
        const current = get().player;
        set({ player: { ...current, ...data } as PlayerData });
    },

    register: async (data) => {
        const { socket } = get();
        if (!socket) return;

        return new Promise((resolve, reject) => {
            socket.emit('register', data, (response: { success: boolean; player: PlayerData }) => {
                if (response.success) {
                    set({ player: response.player, currentView: 'waiting' });
                    resolve();
                } else {
                    reject(new Error('Registration failed'));
                }
            });
        });
    },

    // Game Flow
    setView: (view) => {
        set({ currentView: view });
    },

    getTarget: async () => {
        const { socket } = get();
        if (!socket) return;

        return new Promise((resolve) => {
            socket.emit('get_target', (response: { target: TargetData }) => {
                set({ target: response.target });
                resolve();
            });
        });
    },

    performScan: async (targetId) => {
        const { socket } = get();
        if (!socket) return { success: false };

        set({ isScanning: true });

        return new Promise((resolve) => {
            socket.emit('scan', { targetId }, (response: { success: boolean; loopComplete?: boolean }) => {
                set({ isScanning: false });

                if (response.success) {
                    set({ scanComplete: true });
                    get().triggerSuccess();
                } else {
                    get().triggerError();
                }

                resolve(response);
            });
        });
    },

    // Minigames
    getClue: async () => {
        const { socket } = get();
        if (!socket) return;

        return new Promise((resolve) => {
            socket.emit('get_clue', (response: { clue: string }) => {
                set({ clue: response.clue });
                resolve();
            });
        });
    },

    getPuzzle: async () => {
        const { socket } = get();
        if (!socket) return;

        return new Promise((resolve) => {
            socket.emit('get_puzzle', (response: { puzzle: PuzzleData | null }) => {
                set({ puzzleData: response.puzzle });
                resolve();
            });
        });
    },

    submitSignalJammerGuess: async (symbolIndex) => {
        const { socket } = get();
        if (!socket) return { success: false };

        return new Promise((resolve) => {
            socket.emit('signal_jammer_guess', { symbolIndex }, (response: { success: boolean }) => {
                if (response.success) {
                    get().triggerSuccess();
                    // Move to next minigame
                    set({ currentView: 'tumbler' });
                } else {
                    get().triggerError();
                }
                resolve(response);
            });
        });
    },

    updateTumblerState: (state) => {
        const { socket } = get();
        if (!socket) return;

        socket.emit('minigame_state', {
            game: 'tumbler',
            ...state,
        });
    },

    // Getaway
    verifyCode: async (code) => {
        const { socket } = get();
        if (!socket) return { success: false };

        return new Promise((resolve) => {
            socket.emit('verify_code', { code }, (response: { success: boolean }) => {
                if (response.success) {
                    get().triggerSuccess();
                } else {
                    get().triggerError();
                }
                resolve(response);
            });
        });
    },

    // Squad - broadcast view change to squad players only
    squadAdvance: (view) => {
        const { socket } = get();
        if (!socket) return;

        console.log('[SQUAD] Requesting advance to:', view);
        socket.emit('squad_advance', { view });
    },

    // Get squad status (how many have confirmed scans)
    getSquadStatus: async () => {
        const { socket } = get();
        if (!socket) return { confirmedCount: 0, totalCount: 0, allConfirmed: false };

        return new Promise((resolve) => {
            socket.emit('get_squad_status', (response: { confirmedCount: number; totalCount: number; allConfirmed: boolean }) => {
                console.log('[SOCKET] get_squad_status response:', response);
                set({ squadStatus: response });
                resolve(response);
            });
        });
    },

    // Get player's own scan code for displaying QR
    getMyScanCode: async () => {
        const { socket } = get();
        if (!socket) return;

        return new Promise<void>((resolve) => {
            socket.emit('get_my_scan_code', (response: { scanCode: string | null }) => {
                console.log('[SOCKET] get_my_scan_code response:', response);
                set({ myScanCode: response.scanCode });
                resolve();
            });
        });
    },

    // Verify a scanned QR code
    verifyScan: async (scannedCode: string) => {
        const { socket } = get();
        if (!socket) return { success: false, message: 'Not connected' };

        return new Promise((resolve) => {
            socket.emit('verify_scan', { scannedCode }, (response: { success: boolean; message: string }) => {
                console.log('[SOCKET] verify_scan response:', response);
                if (response.success) {
                    get().triggerSuccess();
                } else {
                    get().triggerError();
                }
                resolve(response);
            });
        });
    },

    // UI Effects
    triggerSuccess: () => {
        set({ showSuccess: true });
        setTimeout(() => set({ showSuccess: false }), 600);
    },

    triggerError: () => {
        set({ showError: true });
        setTimeout(() => set({ showError: false }), 500);
    },

    clearEffects: () => {
        set({ showSuccess: false, showError: false });
    },
}));
