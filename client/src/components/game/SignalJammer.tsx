import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

// Cyber rune symbols
const RUNES = [
    '◇', '△', '○',
    '□', '⬡', '⬢',
    '◈', '✧', '☆',
];

const RUNE_COLORS = [
    'text-cyan-400',
    'text-pink-400',
    'text-green-400',
    'text-yellow-400',
    'text-red-400',
    'text-purple-400',
    'text-blue-400',
    'text-orange-400',
    'text-teal-400',
];

export function SignalJammer() {
    const socket = useGameStore((s) => s.socket);
    const squadAdvance = useGameStore((s) => s.squadAdvance);
    const triggerSuccess = useGameStore((s) => s.triggerSuccess);
    const triggerError = useGameStore((s) => s.triggerError);
    const showSuccess = useGameStore((s) => s.showSuccess);
    const showError = useGameStore((s) => s.showError);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [wrongGuesses, setWrongGuesses] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [solved, setSolved] = useState(false);
    const [clue, setClue] = useState<string | null>(null);

    // Fetch unique clue from server on mount
    useEffect(() => {
        if (socket && !clue) {
            socket.emit('get_clue', (response: { clue: string | null }) => {
                console.log('[SIGNAL JAMMER] Received clue:', response.clue);
                setClue(response.clue);
            });
        }
    }, [socket, clue]);

    // Listen for view changes (when another player solves it or squad advances)
    useEffect(() => {
        const handleViewChange = (data: { view: string }) => {
            if (data.view === 'tumbler') {
                setSolved(true);
                triggerSuccess();
            }
        };

        if (socket) {
            socket.on('view_change', handleViewChange);
        }

        return () => {
            if (socket) {
                socket.off('view_change', handleViewChange);
            }
        };
    }, [socket, triggerSuccess]);

    const handleSymbolClick = useCallback(async (index: number) => {
        if (wrongGuesses.has(index) || isSubmitting || solved || !socket) return;

        setSelectedIndex(index);
        setIsSubmitting(true);

        // Send guess to server for validation
        socket.emit('signal_jammer_guess', { symbolIndex: index }, (result: { success: boolean }) => {
            if (result.success) {
                triggerSuccess();
                setSolved(true);

                // Haptic feedback for success
                if (navigator.vibrate) {
                    navigator.vibrate([50, 50, 100, 50, 150]);
                }

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
        });
    }, [wrongGuesses, isSubmitting, solved, socket, triggerSuccess, triggerError, squadAdvance]);

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
                    SIGNAL JAMMER
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
                {clue ? (
                    <p className="text-white font-mono text-sm">
                        "{clue}"
                    </p>
                ) : (
                    <p className="text-slate-500 text-sm animate-pulse">
                        Receiving transmission...
                    </p>
                )}
            </motion.div>

            {/* 3x3 Grid of Runes */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-3 gap-3 max-w-xs mx-auto mb-6"
            >
                {RUNES.map((rune, index) => {
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
                                        ? 'bg-red-900/20 border-red-500/30 text-red-500/30 cursor-not-allowed'
                                        : isSelected
                                            ? 'bg-cyan-500/30 border-cyan-400 glow-cyan'
                                            : 'bg-slate-800/50 border-slate-600 hover:border-cyan-400/50'
                                }
                ${RUNE_COLORS[index]}
              `}
                        >
                            <motion.span
                                animate={isSelected ? {
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0],
                                } : {}}
                                transition={{ duration: 0.3 }}
                            >
                                {rune}
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
                        Eliminated: {Array.from(wrongGuesses).map(i => RUNES[i]).join(' ')}
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
