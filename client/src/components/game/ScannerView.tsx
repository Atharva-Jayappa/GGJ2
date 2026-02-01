import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
import QRCode from 'react-qr-code';
import { useGameStore } from '../../store/useGameStore';

export function ScannerView() {
    const target = useGameStore((s) => s.target);
    const myScanCode = useGameStore((s) => s.myScanCode);
    const getMyScanCode = useGameStore((s) => s.getMyScanCode);
    const verifyScan = useGameStore((s) => s.verifyScan);
    const setView = useGameStore((s) => s.setView);
    const showSuccess = useGameStore((s) => s.showSuccess);
    const showError = useGameStore((s) => s.showError);

    const [mode, setMode] = useState<'info' | 'scan' | 'show_code'>('info');
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanSuccess, setScanSuccess] = useState(false);

    // Fetch my scan code on mount
    useEffect(() => {
        getMyScanCode();
    }, [getMyScanCode]);

    // Handle back button for mode changes
    useEffect(() => {
        const handlePopState = () => {
            if (mode !== 'info') {
                // Back button pressed while in scan or show_code mode - go back to info
                setMode('info');
                // Re-push state to prevent actual navigation
                window.history.pushState({ scannerMode: 'info' }, '', window.location.href);
            }
        };

        // Push state when entering a sub-mode
        if (mode !== 'info') {
            window.history.pushState({ scannerMode: mode }, '', window.location.href);
        }

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [mode]);

    const handleScan = useCallback(async (result: { rawValue: string }[]) => {
        if (isProcessing || scanSuccess || !result.length) return;

        const scannedCode = result[0].rawValue;
        console.log('[SCANNER] Scanned code:', scannedCode);

        // Check if it's a valid UNMASK code
        if (!scannedCode.startsWith('UNMASK-')) {
            setScanError('Invalid code format');
            return;
        }

        setIsProcessing(true);
        setScanError(null);

        const response = await verifyScan(scannedCode);

        if (response.success) {
            setScanSuccess(true);
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 100, 50, 150]);
            }
            // Move to waiting view after brief delay
            setTimeout(() => {
                setView('waiting');
            }, 1500);
        } else {
            setScanError(response.message);
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        }

        setIsProcessing(false);
    }, [isProcessing, scanSuccess, verifyScan, setView]);

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
            {/* Success overlay */}
            <AnimatePresence>
                {(showSuccess || scanSuccess) && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.2 }}
                        className="fixed inset-0 bg-green-500/30 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                            className="text-center"
                        >
                            <p className="text-6xl mb-4">✓</p>
                            <p className="text-green-400 text-2xl font-bold tracking-widest">
                                TARGET VERIFIED
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
                    LOCATE TARGET
                </h1>
                <p className="text-pink-400 text-xs tracking-wider mt-1">
                    {target.prompt}
                </p>
            </motion.div>

            {/* Mode: Info - Show target details */}
            {mode === 'info' && (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex-1 flex flex-col"
                >
                    {/* Target Card */}
                    <div className="cyber-card p-4 mb-4 relative">
                        <div className="scanlines absolute inset-0 pointer-events-none" />

                        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
                        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />

                        <div className="text-center mb-3">
                            <span className="px-3 py-1 bg-pink-500/20 border border-pink-500 text-pink-400 text-xs tracking-widest">
                                TARGET DOSSIER
                            </span>
                        </div>

                        <div className="relative mx-auto mb-4" style={{ width: '200px', height: '200px' }}>
                            <img
                                src={target.drawing}
                                alt="Target"
                                className="w-full h-full object-cover border-2 border-cyan-400/50"
                            />
                        </div>

                        <div className="text-center">
                            <p className="text-pink-400 text-xs mb-1 uppercase tracking-wider">
                                {target.prompt}
                            </p>
                            <p className="text-white font-mono text-lg">
                                "{target.tell}"
                            </p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-yellow-500/10 border border-yellow-400/30 p-3 mb-4 text-center">
                        <p className="text-yellow-400 text-xs">
                            Find this person and ask them to show their code
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-auto space-y-3">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setMode('scan')}
                            className="w-full py-4 bg-cyan-500/20 border-2 border-cyan-400 text-cyan-400 
                                     font-bold text-lg tracking-widest hover:bg-cyan-400/30"
                        >
                            📷 SCAN TARGET'S CODE
                        </motion.button>

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setMode('show_code')}
                            className="w-full py-3 bg-pink-500/20 border border-pink-400 text-pink-400 
                                     font-bold tracking-wider"
                        >
                            Show My Code (For My Hunter)
                        </motion.button>
                    </div>
                </motion.div>
            )}

            {/* Mode: Scan - QR Scanner */}
            {mode === 'scan' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col"
                >
                    <div className="flex-1 relative overflow-hidden rounded-lg border-2 border-cyan-400">
                        <Scanner
                            onScan={handleScan}
                            onError={(error) => console.error('[SCANNER] Error:', error)}
                            components={{
                                finder: true,
                            }}
                            styles={{
                                container: { width: '100%', height: '100%' },
                                video: { width: '100%', height: '100%', objectFit: 'cover' },
                            }}
                        />

                        {/* Scanning overlay */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 border-4 border-cyan-400/30" />
                            <motion.div
                                className="absolute left-0 right-0 h-1 bg-cyan-400/50"
                                animate={{ top: ['0%', '100%', '0%'] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                            />
                        </div>
                    </div>

                    {/* Error message */}
                    {scanError && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 p-3 bg-red-500/20 border border-red-400 text-red-400 text-center"
                        >
                            {scanError}
                        </motion.div>
                    )}

                    {/* Back button */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('info')}
                        className="mt-4 py-3 bg-slate-800/50 border border-slate-600 text-slate-400 
                                 font-bold tracking-wider"
                    >
                        ← BACK TO TARGET INFO
                    </motion.button>
                </motion.div>
            )}

            {/* Mode: Show Code - Display my QR */}
            {mode === 'show_code' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center"
                >
                    <p className="text-pink-400 text-sm mb-4 tracking-wider">
                        SHOW THIS TO YOUR HUNTER
                    </p>

                    <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="p-6 bg-white rounded-lg glow-pink"
                    >
                        {myScanCode ? (
                            <QRCode value={myScanCode} size={220} />
                        ) : (
                            <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-500">
                                Loading...
                            </div>
                        )}
                    </motion.div>

                    <p className="mt-4 text-cyan-400 font-mono text-lg tracking-widest">
                        {myScanCode || '...'}
                    </p>

                    <p className="mt-2 text-slate-500 text-xs text-center">
                        Someone is looking for YOU!<br />
                        Show them this code when they find you.
                    </p>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setMode('info')}
                        className="mt-8 py-3 px-8 bg-slate-800/50 border border-slate-600 text-slate-400 
                                 font-bold tracking-wider"
                    >
                        ← BACK
                    </motion.button>
                </motion.div>
            )}
        </motion.div>
    );
}
