import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

export function ScannerView() {
    const target = useGameStore((s) => s.target);
    const performScan = useGameStore((s) => s.performScan);
    const setView = useGameStore((s) => s.setView);
    const showSuccess = useGameStore((s) => s.showSuccess);
    const showError = useGameStore((s) => s.showError);

    const [holdProgress, setHoldProgress] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startHold = useCallback(() => {
        if (isProcessing) return;
        
        // Reset progress
        setHoldProgress(0);

        // Start progress animation
        const startTime = Date.now();
        const holdDuration = 2000; // 2 seconds to confirm

        progressIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / holdDuration) * 100, 100);
            setHoldProgress(progress);
        }, 16);

        // Set timer for completion
        holdTimerRef.current = setTimeout(async () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            setHoldProgress(100);
            setIsProcessing(true);

            // Send scan to server to record confirmation
            // For hackathon simplicity, we trust the player found their target
            // In a real game, you'd verify with QR codes or proximity
            if (target?.id) {
                // Send the target's ID to the server to record this scan
                const result = await performScan(target.id);
                
                // Haptic feedback
                if (navigator.vibrate) {
                    navigator.vibrate([50, 50, 100]);
                }

                if (result.success) {
                    // Move to waiting view after a brief delay
                    setTimeout(() => {
                        setView('waiting');
                        setIsProcessing(false);
                    }, 500);
                } else {
                    // Reset on failure
                    setHoldProgress(0);
                    setIsProcessing(false);
                }
            }
        }, holdDuration);
    }, [target, performScan, setView, isProcessing]);

    const cancelHold = useCallback(() => {
        if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
        }
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        setHoldProgress(0);
    }, []);

    if (!target) {
        return (
            <div className="min-h-screen bg-slate-900 cyber-grid flex items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full"
                />
            </div>
        );
    }

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
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none z-50"
                        style={{
                            background: 'radial-gradient(circle at center, rgba(74, 222, 128, 0.4) 0%, transparent 70%)',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-6"
            >
                <h1 className="text-xl font-bold text-red-400 tracking-widest animate-pulse">
                    ⚠ TARGET ACQUIRED ⚠
                </h1>
                <p className="text-slate-400 text-sm mt-1">LOCATE AND CONFIRM</p>
            </motion.div>

            {/* Wanted Poster Card */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="cyber-card p-4 mb-6 relative overflow-hidden"
            >
                {/* Scanlines overlay */}
                <div className="scanlines absolute inset-0 pointer-events-none" />

                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400" />

                {/* WANTED header */}
                <div className="text-center mb-4">
                    <span className="px-4 py-1 bg-red-500/20 border border-red-500 text-red-400 text-xs tracking-widest">
                        WANTED
                    </span>
                </div>

                {/* Target Drawing */}
                <div className="relative mx-auto mb-4" style={{ width: '200px', height: '200px' }}>
                    <motion.img
                        src={target.drawing}
                        alt="Target"
                        className="w-full h-full object-cover border-2 border-cyan-400/50"
                        initial={{ filter: 'blur(10px)' }}
                        animate={{ filter: 'blur(0px)' }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    />

                    {/* Glowing border animation */}
                    <motion.div
                        className="absolute inset-0 border-2 border-cyan-400"
                        animate={{
                            boxShadow: [
                                '0 0 0 0 rgba(34, 211, 238, 0.4)',
                                '0 0 20px 5px rgba(34, 211, 238, 0.2)',
                                '0 0 0 0 rgba(34, 211, 238, 0.4)',
                            ],
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                </div>

                {/* Target Tell */}
                <div className="text-center">
                    <p className="text-pink-400 text-xs mb-1 uppercase tracking-wider">
                        {target.prompt}
                    </p>
                    <p className="text-white font-mono text-sm">
                        "{target.tell}"
                    </p>
                </div>
            </motion.div>

            {/* Instructions */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-center mb-6"
            >
                <p className="text-slate-400 text-sm">
                    Find this operative in the room.
                </p>
                <p className="text-cyan-400 text-sm mt-1">
                    Hold the button to confirm target.
                </p>
            </motion.div>

            {/* Scan Button */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-auto"
            >
                <motion.button
                    onMouseDown={startHold}
                    onMouseUp={cancelHold}
                    onMouseLeave={cancelHold}
                    onTouchStart={startHold}
                    onTouchEnd={cancelHold}
                    whileTap={{ scale: 0.95 }}
                    disabled={holdProgress === 100}
                    className="w-full relative overflow-hidden bg-gradient-to-r from-red-500/20 to-pink-500/20
                     border-2 border-red-400 text-red-400 py-6 font-bold text-lg tracking-widest
                     uppercase transition-colors disabled:opacity-50"
                >
                    {/* Progress fill */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-red-500/40 to-pink-500/40"
                        style={{
                            width: `${holdProgress}%`,
                            transition: 'width 0.05s linear',
                        }}
                    />

                    <span className="relative z-10 flex items-center justify-center gap-2">
                        {holdProgress === 100 ? (
                            <>
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    className="w-5 h-5 border-2 border-current border-t-transparent rounded-full"
                                />
                                TARGET LOCKED!
                            </>
                        ) : holdProgress > 0 ? (
                            `CONFIRMING... ${Math.floor(holdProgress)}%`
                        ) : (
                            '🎯 HOLD TO SCAN TARGET'
                        )}
                    </span>
                </motion.button>
            </motion.div>

            {/* Pulse indicator when holding */}
            <AnimatePresence>
                {holdProgress > 0 && holdProgress < 100 && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.2, opacity: 0 }}
                        className="fixed inset-0 pointer-events-none flex items-center justify-center"
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.5, 1],
                                opacity: [0.5, 0, 0.5],
                            }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="w-64 h-64 rounded-full border-4 border-red-400"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
