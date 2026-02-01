import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

export function SignalJammer() {
    const socket = useGameStore((s) => s.socket);
    const squadAdvance = useGameStore((s) => s.squadAdvance);
    const triggerSuccess = useGameStore((s) => s.triggerSuccess);
    const triggerError = useGameStore((s) => s.triggerError);
    const showSuccess = useGameStore((s) => s.showSuccess);
    const showError = useGameStore((s) => s.showError);
    const submitSignalJammerGuess = useGameStore((s) => s.submitSignalJammerGuess);
    const clue = useGameStore((s) => s.clue);
    const puzzleData = useGameStore((s) => s.puzzleData);
    const getPuzzle = useGameStore((s) => s.getPuzzle);
    const getClue = useGameStore((s) => s.getClue);
    const player = useGameStore((s) => s.player);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [wrongGuesses, setWrongGuesses] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [solved, setSolved] = useState(false);
    const [failedToLoad, setFailedToLoad] = useState(false);

    // If player not registered, redirect to lobby
    useEffect(() => {
        if (!player) {
            console.log('[SignalJammer] No player data, redirecting to lobby...');
            setView('lobby');
        }
    }, [player, setView]);

    // Fetch puzzle and clue on mount, with retry logic for timing issues
    useEffect(() => {
        // Don't fetch if player not registered
        if (!player) return;

        let retryCount = 0;
        const maxRetries = 5;
        let retryTimeout: ReturnType<typeof setTimeout>;
        let cancelled = false;

        const fetchPuzzle = async () => {
            if (cancelled) return;
            
            await getPuzzle();
            
            // Check store state directly (useGameStore.getState() to get fresh value)
            const currentPuzzleData = useGameStore.getState().puzzleData;
            
            if (!currentPuzzleData && retryCount < maxRetries) {
                retryCount++;
                console.log(`[SignalJammer] Puzzle not loaded, retrying (${retryCount}/${maxRetries})...`);
                retryTimeout = setTimeout(fetchPuzzle, 500);
            } else if (!currentPuzzleData) {
                // Max retries exceeded, redirect to lobby
                console.log('[SignalJammer] Failed to load puzzle after retries, redirecting to lobby...');
                setFailedToLoad(true);
            }
        };

        fetchPuzzle();
        getClue();

        return () => {
            cancelled = true;
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [getPuzzle, getClue, player]);

    // Redirect to lobby after failed loading
    useEffect(() => {
        if (failedToLoad) {
            setView('lobby');
        }
    }, [failedToLoad, setView]);

    const handleSymbolClick = useCallback(async (index: number) => {
        if (wrongGuesses.has(index) || isSubmitting || solved || !socket) return;

        setSelectedIndex(index);
        setIsSubmitting(true);

        // Submit guess to server for validation
        const result = await submitSignalJammerGuess(index);

        if (result.success) {
            triggerSuccess();
            setSolved(true);

                // Advance the entire squad to next minigame
                setTimeout(() => {
                    squadAdvance('tumbler');
                }, 1500);
            } else {
                // Wrong guess
                setWrongGuesses((prev) => new Set([...prev, index]));
                triggerError();

                // Haptic feedback for error
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
            }

        setIsSubmitting(false);
        setSelectedIndex(null);
    }, [wrongGuesses, isSubmitting, solved, triggerSuccess, triggerError, setView, submitSignalJammerGuess]);

    // Show loading if puzzle not yet loaded
    if (!puzzleData) {
        return (
            <div className="min-h-screen bg-slate-900 cyber-grid flex items-center justify-center">
                <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-cyan-400 text-xl"
                >
                    Loading puzzle...
                </motion.div>
            </div>
        );
    }

    const grid = puzzleData.grid;
    const puzzleName = puzzleData.name || 'SIGNAL JAMMER';
    const maxTries = 8;
    const triesLeft = maxTries - wrongGuesses.size;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`min-h-screen bg-slate-900 cyber-grid p-4 flex flex-col ${showError ? 'shake' : ''}`}
        >
            {/* Success bloom overlay */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        className="fixed inset-0 pointer-events-none z-50 bloom"
                        style={{
                            background: 'radial-gradient(circle at center, rgba(74, 222, 128, 0.5) 0%, transparent 60%)',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Solved overlay */}
            <AnimatePresence>
                {solved && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-green-500/20 flex items-center justify-center z-40"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                            className="text-center"
                        >
                            <p className="text-4xl mb-2">✓</p>
                            <p className="text-green-400 text-xl font-bold tracking-widest">
                                SIGNAL DECODED
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-4"
            >
                <h1 className="text-xl font-bold text-cyan-400 text-glow-cyan tracking-widest">
                    {puzzleName.toUpperCase()}
                </h1>
                <p className="text-slate-400 text-sm mt-1">DECODE THE FREQUENCY</p>
            </motion.div>

            {/* Clue Display */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="cyber-card p-4 mb-6"
            >
                <p className="text-pink-400 text-xs uppercase tracking-wider mb-1">
                    YOUR INTEL:
                </p>
                <p className="text-white font-mono text-sm">
                    "{clue || 'Loading clue...'}"
                </p>
                <p className="text-slate-500 text-xs mt-2 italic">
                    💡 Communicate with your squad to find the answer
                </p>
            </motion.div>

            {/* 3x3 Grid of Symbols */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-6"
            >
                {grid.map((cell, index) => {
                    const isWrong = wrongGuesses.has(index);
                    const isSelected = selectedIndex === index;
                    const isCorrect = solved && isSelected;

                    return (
                        <motion.button
                            key={index}
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{
                                scale: 1,
                                rotate: 0,
                                opacity: isWrong ? 0.3 : 1,
                            }}
                            transition={{
                                delay: 0.3 + index * 0.05,
                                type: 'spring',
                                stiffness: 260,
                                damping: 20,
                            }}
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: isWrong ? 1 : 1.05 }}
                            onClick={() => handleSymbolClick(index)}
                            disabled={isWrong || isSubmitting || solved}
                            className={`
                aspect-square flex items-center justify-center relative
                text-4xl font-bold
                border-2 transition-all duration-200
                ${isCorrect
                                    ? 'bg-green-500/30 border-green-400 glow-cyan'
                                    : isWrong
                                        ? 'bg-red-900/20 border-red-500/30 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-cyan-500/30 border-cyan-400 glow-cyan'
                                            : 'bg-slate-800/50 border-slate-600 hover:border-cyan-400/50'
                                }
              `}
                            style={{ color: isWrong ? 'rgba(239, 68, 68, 0.3)' : cell.color }}
                        >
                            <motion.span
                                animate={isSelected ? {
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0],
                                } : {}}
                                transition={{ duration: 0.3 }}
                            >
                                {cell.symbol}
                            </motion.span>

                            {/* Wrong indicator */}
                            {isWrong && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute inset-0 flex items-center justify-center"
                                >
                                    <span className="text-red-500 text-6xl opacity-50">✗</span>
                                </motion.div>
                            )}
                        </motion.button>
                    );
                })}
            </motion.div>

            {/* Progress indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-center"
            >
                <p className={`text-xs ${triesLeft <= 2 ? 'text-red-400' : 'text-slate-500'}`}>
                    Tries remaining: {triesLeft} / {maxTries}
                </p>
                {wrongGuesses.size > 0 && (
                    <p className="text-red-400 text-xs mt-1">
                        Eliminated: {Array.from(wrongGuesses).map(i => grid[i]?.symbol || '?').join(' ')}
                    </p>
                )}
            </motion.div>

            {/* Instructions */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-auto text-center"
            >
                <p className="text-cyan-400/60 text-xs">
                    Each operative has a unique clue.
                </p>
                <p className="text-cyan-400/60 text-xs">
                    Share information verbally to crack the code.
                </p>
            </motion.div>
        </motion.div>
    );
}
