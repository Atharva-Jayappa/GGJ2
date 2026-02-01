import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';

interface TumblerProps {
    sweetSpotRange?: number;
}

interface SyncState {
    synced: boolean;
    syncTime: number;
    playersReady: number;
    totalPlayers: number;
}

export function Tumbler({
    sweetSpotRange = 20,
}: TumblerProps) {
    const socket = useGameStore((s) => s.socket);
    const triggerSuccess = useGameStore((s) => s.triggerSuccess);
    const showSuccess = useGameStore((s) => s.showSuccess);
    const showError = useGameStore((s) => s.showError);

    // Sweet spot angle fetched from server
    const [sweetSpotAngle, setSweetSpotAngle] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Refs for 60fps performance
    const dialRef = useRef<HTMLDivElement>(null);
    const currentAngleRef = useRef(0);
    const isAtSweetSpotRef = useRef(false);
    const lastVibrationRef = useRef(0);

    // State for UI
    const [isAtSweetSpot, setIsAtSweetSpot] = useState(false);
    const [syncState, setSyncState] = useState<SyncState>({
        synced: false,
        syncTime: 0,
        playersReady: 0,
        totalPlayers: 0
    });
    const [completed, setCompleted] = useState(false);
    const completedRef = useRef(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isPermanentlyDenied, setIsPermanentlyDenied] = useState(false);
    const [isLandscape, setIsLandscape] = useState(false);

    // Check if device is in landscape mode
    useEffect(() => {
        const checkOrientation = () => {
            // Check if window width is greater than height (landscape)
            const isLandscapeMode = window.innerWidth > window.innerHeight;
            setIsLandscape(isLandscapeMode);
        };

        // Check immediately
        checkOrientation();

        // Listen for orientation/resize changes
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', checkOrientation);

        return () => {
            window.removeEventListener('resize', checkOrientation);
            window.removeEventListener('orientationchange', checkOrientation);
        };
    }, []);

    // Lock screen orientation to portrait on mount (works on Android only)
    useEffect(() => {
        const lockOrientation = async () => {
            try {
                // Type assertion for experimental API
                const screenOrientation = screen.orientation as any;
                if (screenOrientation && screenOrientation.lock) {
                    await screenOrientation.lock('portrait').catch((err: Error) => {
                        console.log('[TUMBLER] Orientation lock not supported:', err);
                    });
                }
            } catch (err) {
                console.log('[TUMBLER] Orientation lock failed:', err);
            }
        };
        
        lockOrientation();
        
        return () => {
            // Unlock orientation when component unmounts
            const screenOrientation = screen.orientation as any;
            if (screenOrientation && screenOrientation.unlock) {
                screenOrientation.unlock();
            }
        };
    }, []);

    // Fetch sweet spot angle from server on mount
    useEffect(() => {
        if (socket) {
            socket.emit('get_tumbler_config', (data: { sweetSpotAngle: number }) => {
                console.log('[TUMBLER] Received sweet spot angle:', data.sweetSpotAngle);
                setSweetSpotAngle(data.sweetSpotAngle);
                setLoading(false);
            });
        }
    }, [socket]);

    // Check if angle is in sweet spot
    const checkSweetSpot = useCallback((angle: number) => {
        if (sweetSpotAngle === null) return false;
        const normalizedAngle = ((angle % 360) + 360) % 360;
        const normalizedSweet = ((sweetSpotAngle % 360) + 360) % 360;

        let diff = Math.abs(normalizedAngle - normalizedSweet);
        if (diff > 180) diff = 360 - diff;

        return diff <= sweetSpotRange;
    }, [sweetSpotAngle, sweetSpotRange]);

    // Handle device orientation
    const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
        if (completed) return;

        const gamma = event.gamma || 0;
        const beta = event.beta || 0;
        const angle = ((gamma * 2) + (beta * 0.5) + 180) % 360;

        currentAngleRef.current = angle;

        // Update dial rotation directly
        if (dialRef.current) {
            dialRef.current.style.transform = `rotate(${angle}deg)`;
        }

        const atSweetSpot = checkSweetSpot(angle);

        // Haptic on entering/leaving sweet spot
        if (atSweetSpot && !isAtSweetSpotRef.current) {
            if (navigator.vibrate) navigator.vibrate(20);
        }

        // Extra haptic near center
        const now = Date.now();
        if (atSweetSpot && sweetSpotAngle !== null && now - lastVibrationRef.current > 500) {
            const normalizedAngle2 = ((angle % 360) + 360) % 360;
            const normalizedSweet2 = ((sweetSpotAngle % 360) + 360) % 360;
            let diff = Math.abs(normalizedAngle2 - normalizedSweet2);
            if (diff > 180) diff = 360 - diff;

            if (diff < 5 && navigator.vibrate) {
                navigator.vibrate(50);
                lastVibrationRef.current = now;
            }
        }

        isAtSweetSpotRef.current = atSweetSpot;
        setIsAtSweetSpot(atSweetSpot);
    }, [checkSweetSpot, sweetSpotAngle, completed]);

    // Check if we need to request permission (iOS 13+)
    useEffect(() => {
        const requiresPermission = typeof (DeviceOrientationEvent as any).requestPermission === 'function';
        setNeedsPermission(requiresPermission);

        // On non-iOS devices, permission is automatic
        if (!requiresPermission) {
            setPermissionGranted(true);
        }
    }, []);

    // Request permission for iOS
    const requestPermission = async () => {
        setPermissionError(null); // Clear any previous errors
        
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            try {
                const permission = await (DeviceOrientationEvent as any).requestPermission();
                if (permission === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    setPermissionGranted(true);
                    setPermissionError(null);
                    setIsPermanentlyDenied(false);
                } else {
                    // Permission denied - on iOS this is permanent until manually reset
                    setIsPermanentlyDenied(true);
                    setPermissionError('denied');
                    console.warn('DeviceOrientation permission denied');
                }
            } catch (error) {
                // User cancelled the prompt (DOMException) or other error
                // On iOS, if user already denied before, this won't even show the prompt
                // and will immediately throw an error
                console.error('DeviceOrientation permission error:', error);
                
                // Check if this is a NotAllowedError (permission previously denied)
                if (error instanceof DOMException && error.name === 'NotAllowedError') {
                    setIsPermanentlyDenied(true);
                    setPermissionError('denied');
                } else {
                    // User just cancelled this time
                    setPermissionError('cancelled');
                }
            }
        } else {
            // Non-iOS device
            window.addEventListener('deviceorientation', handleOrientation);
            setPermissionGranted(true);
        }
    };

    // Setup listeners and server communication
    useEffect(() => {
        window.addEventListener('deviceorientation', handleOrientation);

        // Send state to server periodically (use ref to avoid stale closure)
        const sendInterval = setInterval(() => {
            if (socket && !completedRef.current) {
                socket.emit('tumbler_state', {
                    atSweetSpot: isAtSweetSpotRef.current
                });
            }
        }, 100); // 10 updates per second

        // Listen for sync updates from server
        const handleSync = (data: SyncState) => {
            setSyncState(data);

            // Haptic feedback when all synced
            if (data.synced && data.syncTime > 0) {
                // Pulse haptic every second while synced
                if (Math.floor(data.syncTime) !== Math.floor(data.syncTime - 0.1)) {
                    if (navigator.vibrate) navigator.vibrate(30);
                }
            }
        };

        const handleComplete = (data: { view: string }) => {
            if (data.view === 'getaway') {
                setCompleted(true);
                completedRef.current = true; // Update ref for interval
                triggerSuccess();
                if (navigator.vibrate) {
                    navigator.vibrate([50, 50, 100, 50, 150]);
                }
            }
        };

        if (socket) {
            socket.on('tumbler_sync', handleSync);
            socket.on('view_change', handleComplete);
        }

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
            clearInterval(sendInterval);
            if (socket) {
                socket.off('tumbler_sync', handleSync);
                socket.off('view_change', handleComplete);
            }
        };
    }, [handleOrientation, socket, completed, triggerSuccess]);

    const sweetSpotStyle = {
        transform: `rotate(${sweetSpotAngle ?? 0}deg)`,
    };

    const { synced, syncTime, playersReady, totalPlayers } = syncState;

    // Loading screen while fetching sweet spot angle
    if (loading || sweetSpotAngle === null) {
        return (
            <div className="min-h-screen bg-slate-900 cyber-grid flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-pink-400 font-mono tracking-widest">CALIBRATING TUMBLER...</p>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`min-h-screen bg-slate-900 cyber-grid p-4 flex flex-col items-center justify-center ${showError ? 'shake' : ''}`}
        >
            {/* Success overlay */}
            <AnimatePresence>
                {(showSuccess || completed) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-green-500/20 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                            className="text-center"
                        >
                            <p className="text-4xl mb-2">🔓</p>
                            <p className="text-green-400 text-xl font-bold tracking-widest">
                                VAULT CRACKED
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Landscape mode overlay - iOS workaround since orientation lock isn't supported */}
            <AnimatePresence>
                {isLandscape && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900 flex flex-col items-center justify-center z-50"
                    >
                        <motion.div
                            animate={{ rotate: [0, -90, -90, 0] }}
                            transition={{ 
                                duration: 2, 
                                repeat: Infinity, 
                                repeatDelay: 0.5,
                                times: [0, 0.25, 0.75, 1]
                            }}
                            className="text-6xl mb-6"
                        >
                            📱
                        </motion.div>
                        <p className="text-pink-400 text-xl font-bold tracking-widest text-center px-4">
                            ROTATE YOUR DEVICE
                        </p>
                        <p className="text-slate-400 text-sm mt-2 text-center px-4">
                            This game requires portrait mode, turn off auto-rotate
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-4"
            >
                <h1 className="text-xl font-bold text-pink-400 text-glow-pink tracking-widest">
                    THE TUMBLER
                </h1>
                <p className="text-slate-400 text-sm mt-1">ALL PLAYERS MUST HOLD SIMULTANEOUSLY</p>
            </motion.div>

            {/* Squad sync status */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`mb-4 px-6 py-3 rounded-lg border-2 ${synced
                    ? 'bg-green-500/20 border-green-400'
                    : 'bg-slate-800/50 border-slate-600'
                    }`}
            >
                <div className="text-center">
                    <p className={`text-lg font-bold ${synced ? 'text-green-400' : 'text-slate-400'}`}>
                        {playersReady} / {totalPlayers} PLAYERS READY
                    </p>
                    {synced && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-2"
                        >
                            <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden mx-auto">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-green-400 to-cyan-400"
                                    style={{ width: `${Math.min(syncTime / 3 * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-green-400 text-xs mt-1">
                                SYNCED: {syncTime.toFixed(1)}s / 3.0s
                            </p>
                        </motion.div>
                    )}
                </div>
            </motion.div>

            {/* Permission button and error messages */}
            {!permissionGranted && (
                <div className="text-center mb-4 max-w-md mx-auto">
                    {isPermanentlyDenied ? (
                        // Permanently denied - show instructions for manual fix
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-500/10 border-2 border-red-400 rounded-lg p-4"
                        >
                            <p className="text-red-400 font-bold mb-2">⚠️ Motion Permission Denied</p>
                            <p className="text-slate-300 text-sm mb-3">
                                To play this game, you need to enable Motion & Orientation in Safari settings:
                            </p>
                            <ol className="text-left text-slate-300 text-xs space-y-2 mb-3">
                                <li className="flex gap-2">
                                    <span className="text-cyan-400 font-bold">1.</span>
                                    <span>Open <strong>Settings</strong> app on your iPhone</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-cyan-400 font-bold">2.</span>
                                    <span>Scroll down and tap <strong>Safari</strong></span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-cyan-400 font-bold">3.</span>
                                    <span>Scroll down to find <strong>Motion & Orientation Access</strong></span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-cyan-400 font-bold">4.</span>
                                    <span>Toggle it <strong>ON</strong></span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-cyan-400 font-bold">5.</span>
                                    <span>Come back to this page and refresh</span>
                                </li>
                            </ol>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors"
                            >
                                REFRESH PAGE
                            </button>
                        </motion.div>
                    ) : (
                        // Not yet requested or user cancelled temporarily
                        <>
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={requestPermission}
                                className="px-4 py-2 bg-cyan-500/20 border border-cyan-400 text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors"
                            >
                                TAP TO ENABLE MOTION
                            </motion.button>
                            {permissionError === 'cancelled' && (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-yellow-400 text-xs mt-2"
                                >
                                    Motion permission required to play. Tap button to try again.
                                </motion.p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Dial Container */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="relative w-64 h-64"
            >
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-700">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1 h-4 bg-slate-600"
                            style={{
                                top: '0',
                                left: '50%',
                                marginLeft: '-2px',
                                transformOrigin: 'center 128px',
                                transform: `rotate(${i * 30}deg)`,
                            }}
                        />
                    ))}
                </div>

                {/* Sweet spot indicator */}
                <div className="absolute inset-0 pointer-events-none" style={sweetSpotStyle}>
                    <motion.div
                        className={`absolute w-16 h-2 ${isAtSweetSpot ? 'bg-green-400' : 'bg-yellow-400'}`}
                        style={{
                            top: '0',
                            left: '50%',
                            marginLeft: '-32px',
                            marginTop: '8px',
                            boxShadow: isAtSweetSpot
                                ? '0 0 20px rgba(74, 222, 128, 0.8)'
                                : '0 0 10px rgba(250, 204, 21, 0.5)',
                        }}
                        animate={isAtSweetSpot ? {
                            boxShadow: [
                                '0 0 20px rgba(74, 222, 128, 0.8)',
                                '0 0 40px rgba(74, 222, 128, 1)',
                                '0 0 20px rgba(74, 222, 128, 0.8)',
                            ],
                        } : {}}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                    />
                </div>

                {/* Rotating dial */}
                <div
                    ref={dialRef}
                    className="absolute inset-4 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-400/30"
                    style={{ transform: 'rotate(0deg)' }}
                >
                    <div className="absolute inset-1/3 rounded-full bg-slate-700 border border-cyan-400/50" />
                    <div
                        className="absolute w-2 h-16 bg-gradient-to-b from-cyan-400 to-transparent"
                        style={{ top: '12px', left: '50%', marginLeft: '-4px' }}
                    />
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-1.5 h-1.5 rounded-full bg-pink-400"
                            style={{
                                top: '50%',
                                left: '50%',
                                transform: `rotate(${i * 45}deg) translateY(-50px) translateX(-3px)`,
                            }}
                        />
                    ))}
                </div>

                {/* Fixed center indicator */}
                <div className="absolute top-0 left-1/2 w-0.5 h-8 bg-white" style={{ marginLeft: '-1px' }} />
            </motion.div>

            {/* Personal status */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 text-center"
            >
                <p className={`text-lg font-bold ${isAtSweetSpot ? 'text-green-400' : 'text-yellow-400'}`}>
                    {isAtSweetSpot ? '✓ YOU ARE READY' : 'FIND YOUR SWEET SPOT'}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                    Tilt device to align pointer with yellow marker
                </p>
            </motion.div>

            {/* Instructions */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-center text-slate-500 text-xs"
            >
                <p>ALL squad members must hold their sweet spots</p>
                <p>at the same time for 3 seconds!</p>
            </motion.div>
        </motion.div>
    );
}
