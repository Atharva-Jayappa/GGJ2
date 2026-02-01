import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { GameView } from '../store/useGameStore';

/**
 * Hook to manage browser history for game views.
 * - Prevents accidental page exit during active game with back button
 * - Does NOT allow backward navigation through game phases (one-directional progress)
 * - Only the beforeunload warning for page refresh/close
 */
export function useHistoryManagement() {
    const currentView = useGameStore((s) => s.currentView);
    const phase = useGameStore((s) => s.phase);
    const isInitialMount = useRef(true);

    // Push initial history state on mount and whenever view changes
    // This creates a "buffer" so back button doesn't immediately exit
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            // Push an initial state so there's something to go "back" to
            window.history.pushState({ view: currentView, gameActive: true }, '', window.location.href);
        }
    }, [currentView]);

    // Handle back button - prevent it from doing anything during active game
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            console.log('[HISTORY] Back button pressed during game');

            // Don't allow backward navigation during active game
            // Just push back to current state to "cancel" the back action
            window.history.pushState({ view: currentView, gameActive: true }, '', window.location.href);

            // Optional: could show a toast/notification here
            console.log('[HISTORY] Blocked - game progress is one-directional');
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [currentView]);

    // Prevent accidental page exit when in active game
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            // Only warn if in active game (not in lobby)
            if (phase !== 'lobby' || currentView !== 'lobby') {
                event.preventDefault();
                event.returnValue = 'You have an active game in progress. Are you sure you want to leave?';
                return event.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [phase, currentView]);
}
