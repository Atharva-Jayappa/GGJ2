import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import QRCode from 'react-qr-code';
import { DrawingGrid } from './DrawingGrid';
import { SquadProgress } from './SquadProgress';
import { Leaderboard } from './Leaderboard';

type Phase = 'start' | 'tutorial' | 'lobby' | 'chain' | 'heist' | 'getaway' | 'complete';

interface LeaderboardEntry {
    id: string;
    name: string;
    currentView: string;
    progressPercent: number;
    tasksCompleted: number;
    finishPosition: number | null;
    completedAt: number | null;
    playerCount: number;
    isComplete: boolean;
}

interface GameState {
    phase: Phase;
    playerCount: number;
    maxPlayers: number;
    squadCount: number;
    teamSize: number;
    drawings: Array<{
        id: string;
        drawing: string;
        nickname: string;
        timestamp: number;
    }>;
    squads: Array<{
        id: string;
        playerCount: number;
        completedScans: number;
        totalScans: number;
        isLoopComplete: boolean;
        progress: number;
        currentMinigame: string | null;
        currentView?: string;
        finishPosition?: number | null;
        players: Array<{
            id: string;
            nickname: string;
            connected: boolean;
            scanComplete: boolean;
        }>;
    }>;
    leaderboard: LeaderboardEntry[];
}

const SOCKET_URL = import.meta.env.PROD
    ? `${window.location.origin}/gm`
    : 'http://localhost:3001/gm';

// Always use current origin for QR code (works for localhost, ngrok, etc.)
const JOIN_URL = window.location.origin;

export function GameMasterView() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<GameState>({
        phase: 'start',
        playerCount: 0,
        maxPlayers: 100,
        squadCount: 0,
        teamSize: 4,
        drawings: [],
        squads: [],
        leaderboard: [],
    });
    const [errorSquad, setErrorSquad] = useState<string | null>(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
        });

        newSocket.on('connect', () => {
            console.log('[GM] Connected');
        });

        newSocket.on('game_state', (state: GameState) => {
            setGameState(state);
        });

        newSocket.on('player_joined', (data) => {
            setGameState((prev) => ({
                ...prev,
                playerCount: data.count,
                drawings: [...prev.drawings, {
                    id: data.id,
                    drawing: data.drawing,
                    nickname: data.nickname,
                    timestamp: Date.now(),
                }],
            }));
        });

        newSocket.on('player_left', (data) => {
            setGameState((prev) => ({
                ...prev,
                playerCount: data.count,
                drawings: prev.drawings.filter((d) => d.id !== data.id),
            }));
        });

        newSocket.on('squad_error', (data: { squadId: string }) => {
            setErrorSquad(data.squadId);
            setTimeout(() => setErrorSquad(null), 300);
        });

        newSocket.on('phase_change', (data: { phase: Phase }) => {
            setGameState((prev) => ({
                ...prev,
                phase: data.phase,
            }));
        });

        newSocket.on('leaderboard_update', (leaderboard: LeaderboardEntry[]) => {
            setGameState((prev) => ({
                ...prev,
                leaderboard,
            }));
        });

        newSocket.on('squad_completed', (data: { squadId: string; position: number; totalSquads: number }) => {
            console.log(`[GM] Squad ${data.squadId} completed at position ${data.position}`);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const setPhase = useCallback((phase: Phase) => {
        socket?.emit('set_phase', { phase });
        setGameState((prev) => ({ ...prev, phase }));
    }, [socket]);

    const startGame = useCallback(() => {
        socket?.emit('start_game');
    }, [socket]);


    const resetGame = useCallback(() => {
        socket?.emit('reset_game');
        setGameState((prev) => ({ ...prev, phase: 'start', playerCount: 0, drawings: [], squads: [], leaderboard: [] }));
    }, [socket]);

    const updateTeamSize = useCallback((delta: number) => {
        const newSize = Math.max(2, Math.min(10, gameState.teamSize + delta));
        socket?.emit('set_team_size', { size: newSize });
    }, [socket, gameState.teamSize]);

    const teamSize = gameState.teamSize;
    const canStartChain = gameState.playerCount >= teamSize && gameState.playerCount % teamSize === 0;

    return (
        <div className="min-h-screen bg-slate-900 cyber-grid text-white overflow-hidden">
            {/* Scanlines overlay */}
            <div className="scanlines fixed inset-0 pointer-events-none z-50" />

            {/* Header Bar */}
            <motion.header
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur border-b border-cyan-400/30"
            >
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-cyan-400 text-glow-cyan tracking-widest">
                            PROTOCOL: UNMASK
                        </h1>
                        <span className="px-3 py-1 bg-pink-500/20 border border-pink-400 text-pink-400 text-sm tracking-wider">
                            CENTRAL COMMAND
                        </span>
                    </div>

                    {/* Phase indicator */}
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <span className="text-slate-500 text-xs uppercase">Current Phase</span>
                            <p className="text-xl font-bold text-cyan-400 uppercase tracking-wider">
                                {gameState.phase}
                            </p>
                        </div>

                        {/* Control buttons - only show after start/tutorial */}
                        {gameState.phase !== 'start' && gameState.phase !== 'tutorial' && (
                            <div className="flex gap-2">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={resetGame}
                                    className="px-4 py-2 bg-red-500/20 border border-red-400 text-red-400 font-bold"
                                >
                                    RESET
                                </motion.button>
                            </div>
                        )}
                    </div>
                </div>
            </motion.header>

            {/* Main Content */}
            <main className="pt-20 min-h-screen">
                <AnimatePresence mode="wait">
                    {/* START PHASE - Intro Screen */}
                    {gameState.phase === 'start' && (
                        <motion.div
                            key="start"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center text-center"
                        >
                            <motion.div
                                initial={{ y: -20 }}
                                animate={{ y: 0 }}
                                className="mb-12"
                            >
                                <h1 className="text-6xl md:text-8xl font-bold text-white tracking-widest mb-2 opacity-50">
                                    PROTOCOL
                                </h1>
                                <h2 className="text-7xl md:text-9xl font-bold text-cyan-400 text-glow-cyan tracking-widest">
                                    UNMASK
                                </h2>
                            </motion.div>

                            <div className="flex gap-6">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setPhase('lobby')}
                                    className="px-8 py-4 bg-cyan-400/20 border-2 border-cyan-400 text-cyan-400 
                                     font-bold text-xl tracking-wider flex items-center gap-3 hover:bg-cyan-400/30"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                                    </svg>
                                    INITIATE
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setPhase('tutorial')}
                                    className="px-8 py-4 bg-white/10 border-2 border-white/30 text-white/70 
                                     font-bold text-xl tracking-wider hover:border-white hover:text-white hover:bg-white/20"
                                >
                                    BRIEFING
                                </motion.button>
                            </div>

                            <p className="mt-16 text-slate-500 font-mono text-sm tracking-widest">
                                SECURE CONNECTION ESTABLISHED // V.2.0
                            </p>
                        </motion.div>
                    )}

                    {/* TUTORIAL PHASE */}
                    {gameState.phase === 'tutorial' && (
                        <motion.div
                            key="tutorial"
                            initial={{ x: 100, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -100, opacity: 0 }}
                            className="min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center p-8"
                        >
                            <div className="w-full max-w-4xl">
                                <div className="aspect-video bg-black border-2 border-cyan-400/30 relative overflow-hidden mb-8">
                                    <iframe
                                        className="absolute inset-0 w-full h-full"
                                        src="https://www.youtube.com/embed/djV11Xbc914?autoplay=1&mute=0&controls=1"
                                        title="Mission Briefing"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                    <div className="absolute inset-0 pointer-events-none opacity-20 scanlines" />
                                </div>

                                <div className="flex justify-between items-center">
                                    <p className="text-slate-500 font-mono text-sm tracking-widest">
                                        MISSION BRIEFING // TOP SECRET
                                    </p>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setPhase('start')}
                                        className="px-6 py-2 bg-cyan-400/20 border border-cyan-400 text-cyan-400 
                                         font-bold tracking-wider flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        RETURN TO MENU
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* LOBBY PHASE */}
                    {gameState.phase === 'lobby' && (
                        <motion.div
                            key="lobby"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col lg:flex-row min-h-[calc(100vh-5rem)]"
                        >
                            {/* Left side - QR Code and counter */}
                            <div className="lg:w-1/3 p-8 flex flex-col items-center justify-center border-r border-cyan-400/20">
                                {/* Player Counter */}
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="text-center mb-8"
                                >
                                    <p className="text-slate-500 text-lg uppercase tracking-wider mb-2">
                                        Operatives Online
                                    </p>
                                    <motion.p
                                        key={gameState.playerCount}
                                        initial={{ scale: 1.5, color: '#4ade80' }}
                                        animate={{ scale: 1, color: '#22d3ee' }}
                                        className="text-8xl font-bold text-cyan-400 text-glow-cyan"
                                    >
                                        {gameState.playerCount}
                                    </motion.p>
                                    <p className="text-slate-500 text-2xl">
                                        / {gameState.maxPlayers}
                                    </p>
                                </motion.div>

                                {/* QR Code */}
                                <motion.div
                                    initial={{ scale: 0, rotate: -10 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ delay: 0.2, type: 'spring' }}
                                    className="p-6 bg-white rounded-lg glow-cyan"
                                >
                                    <QRCode
                                        value={JOIN_URL}
                                        size={256}
                                        level="M"
                                    />
                                </motion.div>

                                <p className="mt-4 text-cyan-400 text-lg font-mono">
                                    SCAN TO JOIN
                                </p>
                                <p className="text-slate-500 text-sm mt-1">
                                    {JOIN_URL}
                                </p>

                                {/* Team Size Selector */}
                                <div className="mt-8 flex items-center gap-6 bg-slate-800/50 border border-cyan-400/30 p-4 rounded-lg">
                                    <span className="text-slate-400 font-mono">TEAM SIZE:</span>
                                    <div className="flex items-center gap-4">
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => updateTeamSize(-1)}
                                            className="w-8 h-8 bg-slate-700 text-cyan-400 rounded hover:bg-slate-600"
                                        >
                                            -
                                        </motion.button>
                                        <span className="text-3xl font-bold font-mono text-white w-8 text-center">{teamSize}</span>
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => updateTeamSize(1)}
                                            className="w-8 h-8 bg-slate-700 text-cyan-400 rounded hover:bg-slate-600"
                                        >
                                            +
                                        </motion.button>
                                    </div>
                                </div>

                                {/* Start Button with validation */}
                                <motion.button
                                    whileHover={{ scale: canStartChain ? 1.05 : 1 }}
                                    whileTap={{ scale: canStartChain ? 0.95 : 1 }}
                                    onClick={startGame}
                                    disabled={!canStartChain}
                                    className={`mt-6 w-full py-4 font-bold text-xl tracking-wider ${canStartChain
                                            ? 'bg-green-500/20 border-2 border-green-400 text-green-400 hover:bg-green-500/30'
                                            : 'bg-slate-700/50 border-2 border-slate-600 text-slate-500 cursor-not-allowed'
                                        }`}
                                >
                                    {canStartChain
                                        ? 'BEGIN OPERATION'
                                        : `NEED ${teamSize - (gameState.playerCount % teamSize)} MORE AGENTS`
                                    }
                                </motion.button>
                            </div>

                            {/* Right side - Drawing mosaic */}
                            <div className="lg:w-2/3 overflow-auto">
                                <div className="p-4">
                                    <h2 className="text-xl text-slate-400 uppercase tracking-wider mb-4">
                                        RECRUITED OPERATIVES
                                    </h2>
                                    <DrawingGrid drawings={gameState.drawings} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* CHAIN PHASE */}
                    {gameState.phase === 'chain' && (
                        <motion.div
                            key="chain"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="min-h-[calc(100vh-5rem)] p-8"
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-4xl font-bold text-cyan-400 text-glow-cyan tracking-widest mb-2">
                                    NETWORK FORMATION
                                </h2>
                                <p className="text-slate-400 text-lg">
                                    Operatives are establishing secure connections
                                </p>
                            </div>

                            {/* Squad Network Visualization */}
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                                {gameState.squads.map((squad, index) => {
                                    const squadNames = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
                                    const isComplete = squad.isLoopComplete;

                                    return (
                                        <motion.div
                                            key={squad.id}
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: index * 0.15 }}
                                            className={`cyber-card p-6 text-center relative overflow-hidden
                        ${isComplete ? 'border-green-400 glow-green' : 'border-cyan-400/30'}`}
                                        >
                                            {/* Pulse effect when complete */}
                                            {isComplete && (
                                                <motion.div
                                                    initial={{ scale: 0, opacity: 0.5 }}
                                                    animate={{ scale: 3, opacity: 0 }}
                                                    transition={{ repeat: Infinity, duration: 2 }}
                                                    className="absolute inset-0 bg-green-400 rounded-lg"
                                                />
                                            )}

                                            <h3 className={`text-2xl font-bold mb-4 ${isComplete ? 'text-green-400' : 'text-cyan-400'
                                                }`}>
                                                {squadNames[index]}
                                            </h3>

                                            {/* Circular network visualization */}
                                            <div className="relative w-32 h-32 mx-auto mb-4">
                                                {/* Connection lines */}
                                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                                                    {squad.players.map((_, pIndex) => {
                                                        const nextIndex = (pIndex + 1) % squad.players.length;
                                                        const angle1 = (pIndex / squad.players.length) * 2 * Math.PI - Math.PI / 2;
                                                        const angle2 = (nextIndex / squad.players.length) * 2 * Math.PI - Math.PI / 2;
                                                        const r = 40; // radius in viewBox units (percentage-like)
                                                        const cx = 50; // center x
                                                        const cy = 50; // center y
                                                        const x1 = cx + r * Math.cos(angle1);
                                                        const y1 = cy + r * Math.sin(angle1);
                                                        const x2 = cx + r * Math.cos(angle2);
                                                        const y2 = cy + r * Math.sin(angle2);

                                                        const scanComplete = pIndex < squad.completedScans;

                                                        return (
                                                            <motion.line
                                                                key={pIndex}
                                                                x1={x1}
                                                                y1={y1}
                                                                x2={x2}
                                                                y2={y2}
                                                                stroke={scanComplete ? '#4ade80' : '#475569'}
                                                                strokeWidth={scanComplete ? 3 : 1}
                                                                initial={{ pathLength: 0, opacity: 0.3 }}
                                                                animate={{
                                                                    pathLength: 1,
                                                                    opacity: scanComplete ? 1 : 0.3,
                                                                }}
                                                                transition={{ delay: 0.5 + pIndex * 0.1 }}
                                                            />
                                                        );
                                                    })}
                                                </svg>

                                                {/* Player nodes */}
                                                {squad.players.map((player, pIndex) => {
                                                    const angle = (pIndex / squad.players.length) * 2 * Math.PI - Math.PI / 2;
                                                    const r = 40; // Same radius as SVG (percentage)
                                                    const cx = 50; // center percentage
                                                    const cy = 50; // center percentage
                                                    const x = cx + r * Math.cos(angle);
                                                    const y = cy + r * Math.sin(angle);

                                                    return (
                                                        <motion.div
                                                            key={player.id}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ delay: 0.3 + pIndex * 0.1 }}
                                                            className={`absolute w-4 h-4 rounded-full ${!player.connected
                                                                ? 'bg-red-500'
                                                                : player.scanComplete
                                                                    ? 'bg-green-400'
                                                                    : 'bg-slate-600'
                                                                }`}
                                                            style={{
                                                                left: `${x}%`,
                                                                top: `${y}%`,
                                                                transform: 'translate(-50%, -50%)',
                                                            }}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {/* Status */}
                                            <p className={`text-lg font-mono ${isComplete ? 'text-green-400' : 'text-slate-500'
                                                }`}>
                                                {isComplete ? 'ACTIVATED' : `${squad.completedScans}/${squad.totalScans} LINKED`}
                                            </p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* HEIST PHASE */}
                    {(gameState.phase === 'heist' || gameState.phase === 'getaway') && (
                        <motion.div
                            key="heist"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="min-h-[calc(100vh-5rem)] p-8"
                        >
                            <div className="text-center mb-8">
                                <h2 className="text-4xl font-bold text-pink-400 text-glow-pink tracking-widest mb-2">
                                    HEIST IN PROGRESS
                                </h2>
                                <p className="text-slate-400 text-lg">
                                    Squads are executing their missions
                                </p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <Leaderboard entries={gameState.leaderboard} />

                                <div>
                                    <SquadProgress
                                        squads={gameState.squads}
                                        showError={errorSquad}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer status bar */}
            <motion.footer
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-cyan-400/30 py-2 px-4"
            >
                <div className="container mx-auto flex justify-between items-center text-sm">
                    <span className="text-slate-500">
                        SYSTEM STATUS: <span className="text-green-400">OPERATIONAL</span>
                    </span>
                    <span className="text-slate-500">
                        SQUADS ACTIVE: <span className="text-cyan-400">{gameState.squadCount}</span>
                    </span>
                    <span className="text-slate-500">
                        UPLINK: <span className="text-green-400">●</span> STABLE
                    </span>
                </div>
            </motion.footer>
        </div>
    );
}
