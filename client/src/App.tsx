import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Store
import { useGameStore } from './store/useGameStore';
import { useSocket } from './hooks/useSocket';
import { useHistoryManagement } from './hooks/useHistoryManagement';

// Game Views
import { LobbyView } from './components/game/LobbyView';
import { ScannerView } from './components/game/ScannerView';
import { WaitingView } from './components/game/WaitingView';
import { SignalJammer } from './components/game/SignalJammer';
import { Tumbler } from './components/game/Tumbler';
import { GetawayView } from './components/game/GetawayView';
import { CompleteView } from './components/game/CompleteView';

// GM View
import { GameMasterView } from './components/gm/GameMasterView';

// Audio
import { AudioPlayer } from './components/AudioPlayer';

// Main game component that handles view switching
function GameApp() {
  const connected = useSocket();
  const currentView = useGameStore((s) => s.currentView);

  // Handle browser back button navigation
  useHistoryManagement();

  if (!connected) {
    return (
      <div className="min-h-screen bg-slate-900 cyber-grid flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 font-mono">ESTABLISHING UPLINK...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {currentView === 'lobby' && <LobbyView key="lobby" />}
      {currentView === 'waiting' && <WaitingView key="waiting" />}
      {currentView === 'scanner' && <ScannerView key="scanner" />}
      {currentView === 'signal_jammer' && <SignalJammer key="signal_jammer" />}
      {currentView === 'tumbler' && <Tumbler key="tumbler" />}
      {currentView === 'getaway' && <GetawayView key="getaway" />}
      {currentView === 'complete' && <CompleteView key="complete" />}
    </AnimatePresence>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AudioPlayer />
      <Routes>
        {/* Game Master View */}
        <Route path="/central-command" element={<GameMasterView />} />

        {/* Player Game View */}
        <Route path="/*" element={<GameApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
