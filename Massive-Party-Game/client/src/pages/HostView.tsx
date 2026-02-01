import { useEffect, useState } from "react";
import { useWebSocket, useGameStatus, useSetPhase, useResetGame, useSetTeamSize } from "@/hooks/use-game";
import { GlitchText } from "@/components/GlitchText";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, RotateCcw, MonitorPlay, Lock, ShieldCheck, Trophy, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import Confetti from "react-confetti";
import qrCodeImg from "@assets/Screenshot_2026-01-31_at_5.39.07_PM_1769912303586.png";

export default function HostView() {
  const { gameState } = useWebSocket();
  const { data: status } = useGameStatus();
  const setPhase = useSetPhase();
  const resetGame = useResetGame();
  const setTeamSize = useSetTeamSize();
  const [error, setError] = useState<string | null>(null);

  // Determine current effective phase (websocket overrides if connected, else status query)
  const currentPhase = gameState.connected ? gameState.phase : (status?.phase || "START");

  const canStartHeist = status && status.playerCount > 0 && status.teamSize && (status.playerCount % status.teamSize === 0);

  const handleStartHeist = () => {
    if (!canStartHeist) {
      setError(`Cannot start heist: ${status?.playerCount} agents cannot be divided evenly into teams of ${status?.teamSize}.`);
      return;
    }
    setError(null);
    setPhase.mutate("HEIST");
  };

  const playMusic = () => {
    // Placeholder for music logic
    console.log("Playing theme music...");
  };

  return (
    <div className="min-h-screen bg-background text-primary p-4 md:p-8 flex flex-col overflow-hidden relative">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      {/* Header Status Bar */}
      <div className="flex justify-between items-center mb-8 border-b border-primary/20 pb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${gameState.connected ? 'bg-primary animate-pulse' : 'bg-red-500'}`} />
          <span className="font-mono text-sm tracking-widest opacity-70">
            SYSTEM STATUS: {gameState.connected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="font-mono text-xl font-bold tracking-[0.2em]">
          OPERATION: HEIST
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <span className="font-mono text-xl">{status?.playerCount || 0} AGENTS</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          
          {/* === PHASE: START === */}
          {currentPhase === "START" && (
            <motion.div 
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="text-center flex flex-col items-center gap-12"
            >
              <div className="relative">
                <GlitchText text="PROTOCOL" size="lg" className="block text-white opacity-50 mb-2" />
                <GlitchText text="OMEGA" size="xl" />
              </div>
              
              <div className="flex gap-6">
                <button 
                  onClick={() => {
                    setPhase.mutate("LOBBY");
                    playMusic();
                  }}
                  className="btn-cyber flex items-center gap-4 group"
                >
                  <Play className="w-6 h-6 group-hover:fill-current" />
                  INITIATE
                </button>
                
                <button 
                  onClick={() => setPhase.mutate("TUTORIAL")}
                  className="btn-cyber border-white/20 text-white/50 hover:text-white hover:border-white hover:bg-white/10"
                >
                  <MonitorPlay className="w-6 h-6" />
                  BRIEFING
                </button>
              </div>
            </motion.div>
          )}

          {/* === PHASE: TUTORIAL === */}
          {currentPhase === "TUTORIAL" && (
            <motion.div 
              key="tutorial"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="w-full max-w-4xl flex flex-col gap-8"
            >
              <div className="aspect-video bg-black border-2 border-primary/30 relative overflow-hidden group">
                <iframe 
                  className="absolute inset-0 w-full h-full"
                  src="https://www.youtube.com/embed/djV11Xbc914?autoplay=1&mute=0&controls=1" 
                  title="Mission Briefing" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                ></iframe>
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%] pointer-events-none opacity-20" />
              </div>
              
              <div className="flex justify-between items-center">
                <div className="font-mono text-sm opacity-50">
                  MISSION BRIEFING // TOP SECRET
                </div>
                <button 
                  onClick={() => setPhase.mutate("START")}
                  className="btn-cyber py-2 px-6 text-sm flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  RETURN TO MENU
                </button>
              </div>
            </motion.div>
          )}

          {/* === PHASE: LOBBY === */}
          {currentPhase === "LOBBY" && (
            <motion.div 
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full max-w-6xl"
            >
              <div className="flex flex-col items-center text-center">
                <h2 className="text-4xl font-bold mb-4 font-mono">RECRUITING AGENTS</h2>
                
                <div className="bg-white p-4 rounded-lg mb-8 shadow-[0_0_20px_rgba(0,255,0,0.3)]">
                  <img src={qrCodeImg} alt="Join Game QR Code" className="w-56 h-56" />
                </div>

                <div className="text-8xl font-bold font-mono text-white mb-4 tracking-tighter">
                  {String(status?.playerCount || 0).padStart(3, '0')}
                </div>
                
                <div className="bg-primary/5 border border-primary/20 p-4 mb-8 w-full backdrop-blur-sm">
                  <p className="font-mono text-sm mb-1">JOIN MISSION AT:</p>
                  <div className="text-2xl font-bold tracking-wider text-white">
                    {window.location.host}
                  </div>
                </div>

                <div className="flex items-center gap-6 bg-black/50 border border-primary/30 p-4 rounded-lg mb-8">
                  <span className="font-mono text-primary/70">TEAM SIZE:</span>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => status?.teamSize && setTeamSize.mutate(Math.max(2, status.teamSize - 1))}
                      className="p-1 hover:text-white transition-colors"
                    >
                      <ChevronLeft />
                    </button>
                    <span className="text-3xl font-bold font-mono text-white w-8">{status?.teamSize || 3}</span>
                    <button 
                      onClick={() => status?.teamSize && setTeamSize.mutate(status.teamSize + 1)}
                      className="p-1 hover:text-white transition-colors"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 font-mono text-sm mb-4 bg-red-500/10 p-3 border border-red-500/30 rounded w-full">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button 
                  onClick={handleStartHeist}
                  className="btn-cyber w-full py-6 text-2xl"
                  disabled={!status?.playerCount || status.playerCount < (status?.teamSize || 2)}
                >
                  BEGIN HEIST OPERATION
                </button>
              </div>

              <div className="bg-black/40 border border-primary/20 p-6 flex flex-col">
                <h3 className="text-xl font-mono text-primary/70 mb-4 border-b border-primary/20 pb-2">ACTIVE AGENTS</h3>
                <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                  {status?.players?.map((p, i) => (
                    <div key={i} className="bg-primary/5 border border-primary/10 p-3 font-mono text-sm text-white flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {p.codename}
                    </div>
                  ))}
                  {(!status?.players || status.players.length === 0) && (
                    <div className="col-span-2 text-center text-primary/30 font-mono py-12">
                      NO AGENTS DETECTED...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* === PHASE: HEIST === */}
          {currentPhase === "HEIST" && (
            <motion.div 
              key="heist"
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center w-full"
            >
              <div className="animate-[spin_10s_linear_infinite] w-32 h-32 border-4 border-dashed border-primary rounded-full mx-auto mb-8 opacity-50" />
              <h2 className="text-6xl font-bold mb-4 tracking-widest text-white uppercase">Operation Active</h2>
              
              <div className="flex justify-center gap-8 mb-12 font-mono">
                <div className="bg-primary/10 border border-primary/30 px-6 py-4">
                  <span className="block text-xs text-primary/50 uppercase">Teams Deployed</span>
                  <span className="text-4xl font-bold text-white">
                    {status && status.teamSize ? Math.floor(status.playerCount / status.teamSize) : 0}
                  </span>
                </div>
                <div className="bg-primary/10 border border-primary/30 px-6 py-4">
                  <span className="block text-xs text-primary/50 uppercase">Team Capacity</span>
                  <span className="text-4xl font-bold text-white">{status?.teamSize || 0}</span>
                </div>
              </div>

              <p className="text-2xl font-mono text-primary/70 animate-pulse">
                WAITING FOR TEAMS TO BREACH SECURITY...
              </p>
              
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
                {/* Placeholder for live team stats if backend supported it */}
                <div className="bg-black/40 border border-primary/20 p-4 font-mono text-sm">
                  MONITORING NETWORK TRAFFIC...
                </div>
                <div className="bg-black/40 border border-primary/20 p-4 font-mono text-sm">
                  ENCRYPTING COMMS CHANNELS...
                </div>
                <div className="bg-black/40 border border-primary/20 p-4 font-mono text-sm">
                  TRACKING AGENT LOCATIONS...
                </div>
              </div>
            </motion.div>
          )}

          {/* === PHASE: COMPLETE === */}
          {currentPhase === "COMPLETE" && (
            <motion.div 
              key="complete"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-center"
            >
              <Confetti width={window.innerWidth} height={window.innerHeight} colors={['#00ff00', '#ffffff', '#000000']} />
              
              <div className="inline-block p-4 border-4 border-primary mb-8 bg-black">
                <ShieldCheck className="w-24 h-24 text-primary mx-auto mb-4" />
                <h2 className="text-6xl md:text-8xl font-bold tracking-tighter text-white uppercase">
                  MISSION<br/>SUCCESS
                </h2>
              </div>

              <div className="mb-12">
                <p className="font-mono text-xl mb-4 text-primary/70 uppercase tracking-widest">Winning Extraction Teams</p>
                <div className="flex flex-col gap-6 items-center">
                  {gameState.winningTeams?.map((team: any) => (
                    <div key={team.teamId} className="w-full max-w-md">
                      <div className="bg-primary text-black px-6 py-3 font-bold text-2xl font-mono flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-6 h-6" /> 
                          <span>TEAM {String(team.teamId).padStart(3, '0')}</span>
                        </div>
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {team.codenames?.map((name: string) => (
                          <div key={name} className="bg-black border border-primary/30 text-primary px-3 py-2 font-mono text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                            {name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )) || (
                    <div className="text-2xl font-mono border border-primary/20 p-8 bg-black/40">
                      NO EXTRACTION DATA RECORDED
                    </div>
                  )}
                </div>
              </div>

              <button 
                onClick={() => resetGame.mutate()}
                className="btn-cyber flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-5 h-5" />
                SYSTEM REBOOT
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <div className="fixed bottom-4 right-4 font-mono text-xs text-primary/30 pointer-events-none">
        SECURE CONNECTION ESTABLISHED // V.1.0.4
      </div>
    </div>
  );
}
