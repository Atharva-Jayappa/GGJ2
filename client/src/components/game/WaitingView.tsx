import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { Button } from '../ui/Button';
import QRCode from 'react-qr-code';

export function WaitingView() {
    const phase = useGameStore((s) => s.phase);
    const player = useGameStore((s) => s.player);
    const target = useGameStore((s) => s.target);
    const squadStatus = useGameStore((s) => s.squadStatus);
    const squadAdvance = useGameStore((s) => s.squadAdvance);
    const getSquadStatus = useGameStore((s) => s.getSquadStatus);
    const showError = useGameStore((s) => s.showError);
    const myScanCode = useGameStore((s) => s.myScanCode);
    const getMyScanCode = useGameStore((s) => s.getMyScanCode);

    const [showMyQR, setShowMyQR] = useState(false);

    useEffect(() => {
        if (phase === 'chain') {
            getSquadStatus();
            getMyScanCode(); // Fetch scan code for QR display
        }
    }, [phase, getSquadStatus, getMyScanCode]);

    // Handle back button for QR modal
    useEffect(() => {
        const handlePopState = () => {
            if (showMyQR) {
                // Back button pressed while modal is open - close it
                setShowMyQR(false);
                // Re-push state to prevent actual navigation
                window.history.pushState({ qrModal: false }, '', window.location.href);
            }
        };

        // Push state when opening modal
        if (showMyQR) {
            window.history.pushState({ qrModal: true }, '', window.location.href);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [showMyQR]);

    const handleStartHeist = () => {
        squadAdvance('signal_jammer');
    };

    const allConfirmed = squadStatus?.allConfirmed ?? false;
    const confirmedCount = squadStatus?.confirmedCount ?? 0;
    const totalCount = squadStatus?.totalCount ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`min-h-screen bg-slate-900 cyber-grid flex flex-col items-center justify-center p-4 ${showError ? 'shake' : ''}`}
        >
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 bg-cyan-400/20"
                        style={{
                            left: `${(i + 1) * 5}%`,
                            height: '100%',
                        }}
                        initial={{ y: '-100%', opacity: 0 }}
                        animate={{ y: '100%', opacity: [0, 0.5, 0] }}
                        transition={{
                            duration: 3 + Math.random() * 2,
                            repeat: Infinity,
                            delay: Math.random() * 2,
                        }}
                    />
                ))}
            </div>

            {/* Content */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center relative z-10 w-full max-w-sm"
            >
                {/* Messages based on phase */}
                {phase === 'lobby' && (
                    <>
                        {/* Status icon */}
                        <motion.div
                            animate={{
                                rotate: [0, 360],
                                borderColor: ['#22d3ee', '#f472b6', '#22d3ee'],
                            }}
                            transition={{
                                rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
                                borderColor: { duration: 3, repeat: Infinity },
                            }}
                            className="w-24 h-24 border-4 border-cyan-400 rounded-full mx-auto mb-8 flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-4 h-4 bg-cyan-400 rounded-full"
                            />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-cyan-400 text-glow-cyan tracking-widest mb-4">
                            IDENTITY REGISTERED
                        </h1>
                        <p className="text-slate-400 mb-2">
                            Welcome, <span className="text-pink-400">{player?.nickname}</span>
                        </p>
                        <p className="text-slate-500 text-sm">
                            Awaiting mission briefing...
                        </p>
                    </>
                )}

                {phase === 'chain' && (
                    <>
                        <h1 className="text-2xl font-bold text-green-400 tracking-widest mb-4">
                            TARGET LOCKED
                        </h1>

                        {/* Show the target that was just scanned */}
                        {target && (
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="cyber-card p-4 mb-6 relative overflow-hidden"
                            >
                                <div className="scanlines absolute inset-0 pointer-events-none" />

                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-green-400" />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-green-400" />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-green-400" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-green-400" />

                                <div className="text-center mb-3">
                                    <span className="px-3 py-1 bg-green-500/20 border border-green-500 text-green-400 text-xs tracking-widest">
                                        CONFIRMED
                                    </span>
                                </div>

                                <div className="relative mx-auto mb-3" style={{ width: '150px', height: '150px' }}>
                                    <img
                                        src={target.drawing}
                                        alt="Target"
                                        className="w-full h-full object-cover border-2 border-green-400/50"
                                    />
                                    <div className="absolute inset-0 border-2 border-green-400 opacity-50" />
                                </div>

                                <div className="text-center">
                                    <p className="text-pink-400 text-xs mb-1 uppercase tracking-wider">
                                        {target.prompt}
                                    </p>
                                    <p className="text-white font-mono text-sm">
                                        "{target.tell}"
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Squad sync status */}
                        <div className="mb-6">
                            <p className="text-slate-400 mb-2">
                                Waiting for squad synchronization...
                            </p>
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <span className="text-cyan-400 font-mono text-lg">
                                    {confirmedCount} / {totalCount}
                                </span>
                                <span className="text-slate-500 text-sm">teammates ready</span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-800 rounded-full h-2 mb-4">
                                <motion.div
                                    className="bg-gradient-to-r from-cyan-400 to-green-400 h-2 rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: totalCount > 0 ? `${(confirmedCount / totalCount) * 100}%` : '0%' }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>

                            {!allConfirmed && (
                                <p className="text-yellow-400 text-sm animate-pulse">
                                    Waiting for {totalCount - confirmedCount} more teammate{totalCount - confirmedCount !== 1 ? 's' : ''} to confirm...
                                </p>
                            )}
                        </div>

                        {/* Squad sync button - only enabled when all confirmed */}
                        <Button
                            onClick={handleStartHeist}
                            variant={allConfirmed ? "primary" : "secondary"}
                            disabled={!allConfirmed}
                            className={`w-full ${allConfirmed ? 'glow-cyan animate-pulse' : 'opacity-50'}`}
                        >
                            {allConfirmed ? '⚡ SQUAD READY - START HEIST' : `⏳ WAITING FOR SQUAD (${confirmedCount}/${totalCount})`}
                        </Button>

                        {/* Show My Code button - for hunters looking for YOU */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowMyQR(true)}
                            className="w-full mt-4 py-3 bg-pink-500/20 border border-pink-400 text-pink-400 
                                     font-bold tracking-wider"
                        >
                            📱 Show My Code (For My Hunter)
                        </motion.button>

                        {/* QR Code Modal */}
                        <AnimatePresence>
                            {showMyQR && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-8"
                                    onClick={() => setShowMyQR(false)}
                                >
                                    <motion.div
                                        initial={{ scale: 0.8 }}
                                        animate={{ scale: 1 }}
                                        exit={{ scale: 0.8 }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <p className="text-pink-400 text-lg mb-4 tracking-wider text-center">
                                            SHOW THIS TO YOUR HUNTER
                                        </p>

                                        <div className="p-6 bg-white rounded-lg glow-pink">
                                            {myScanCode ? (
                                                <QRCode value={myScanCode} size={220} />
                                            ) : (
                                                <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-500">
                                                    Loading...
                                                </div>
                                            )}
                                        </div>

                                        <p className="mt-4 text-cyan-400 font-mono text-lg tracking-widest text-center">
                                            {myScanCode || '...'}
                                        </p>

                                        <p className="mt-4 text-slate-500 text-xs text-center">
                                            Tap anywhere to close
                                        </p>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}

                {phase === 'heist' && (
                    <>
                        {/* Status icon */}
                        <motion.div
                            animate={{
                                rotate: [0, 360],
                                borderColor: ['#22d3ee', '#f472b6', '#22d3ee'],
                            }}
                            transition={{
                                rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
                                borderColor: { duration: 3, repeat: Infinity },
                            }}
                            className="w-24 h-24 border-4 border-cyan-400 rounded-full mx-auto mb-8 flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-4 h-4 bg-cyan-400 rounded-full"
                            />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-pink-400 text-glow-pink tracking-widest mb-4">
                            SQUAD SYNCHRONIZED
                        </h1>
                        <p className="text-slate-400 mb-2">
                            Heist protocols loading...
                        </p>
                    </>
                )}

                {/* Pulse rings */}
                <div className="mt-8">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="absolute left-1/2 top-1/2 w-32 h-32 border border-cyan-400/30 rounded-full"
                            style={{ marginLeft: '-64px', marginTop: '-64px' }}
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 2 + i * 0.5, opacity: 0 }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: i * 0.7,
                            }}
                        />
                    ))}
                </div>
            </motion.div>

            {/* Bottom tip */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="absolute bottom-8 text-slate-500 text-sm text-center"
            >
                Stay alert. Your squad needs you.
            </motion.p>
        </motion.div>
    );
}
