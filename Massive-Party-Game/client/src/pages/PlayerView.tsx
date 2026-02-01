import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/use-game";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, Eye, CheckCircle2, AlertTriangle, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PlayerView() {
  const { gameState, joinGame, submitAttempt } = useWebSocket();
  const [codename, setCodename] = useState("");
  const [identifyingInfoType, setIdentifyingInfoType] = useState<"TEXT" | "CANVAS">("TEXT");
  const [textInfo, setTextInfo] = useState("");
  const [canvasInfo, setCanvasInfo] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [finalPassword, setFinalPassword] = useState("");
  const { toast } = useToast();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codename) return;
    
    if (!textInfo || !canvasInfo) {
      toast({ title: "Missing Info", description: "Please provide BOTH a description and a drawing.", variant: "destructive" });
      return;
    }

    setIsConnecting(true);
    // Artificial delay for "uplink establishment" feeling
    await new Promise(r => setTimeout(r, 1500));
    
    joinGame(codename, textInfo, canvasInfo);
    setHasJoined(true);
    setIsConnecting(false);
    toast({ title: "UPLINK ESTABLISHED", description: "You are now in the field, Agent." });
  };

  const handleAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameState.playerData?.teamId) {
      submitAttempt(gameState.playerData.teamId, finalPassword);
      setFinalPassword(""); // Clear for retry
    }
  };

  // === UPLINK LOADING ===
  if (isConnecting) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="relative w-24 h-24 mb-8">
          <Loader2 className="w-24 h-24 text-primary animate-spin opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 bg-primary/20 rounded-full animate-ping" />
          </div>
        </div>
        <h2 className="text-2xl font-mono text-primary animate-pulse tracking-widest uppercase">ESTABLISHING UPLINK</h2>
        <p className="text-gray-500 font-mono text-sm mt-4">BYPASSING FIREWALLS...</p>
      </div>
    );
  }

  // === WAITING ROOM / LOBBY ===
  if (hasJoined && gameState.phase === "LOBBY") {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
        <h2 className="text-2xl font-mono text-primary mb-2">ACCESS GRANTED</h2>
        <p className="text-gray-400">Waiting for mission start...</p>
        <div className="mt-8 p-4 border border-primary/20 bg-primary/5 rounded-lg">
          <p className="text-xs text-primary/50 uppercase tracking-widest mb-1">CODENAME</p>
          <p className="text-xl font-bold text-white font-mono">{codename}</p>
        </div>
      </div>
    );
  }

  // === GAME ACTIVE ===
  if (gameState.phase === "HEIST" && gameState.playerData) {
    const { teamId, passwordOrder, passwordPiece, targetInfo, targetType, isFinal } = gameState.playerData;
    
    const targetData = JSON.parse(targetInfo || "{}");

    return (
      <div className="min-h-screen bg-background p-4 flex flex-col gap-4 overflow-y-auto pb-20">
        {/* Header Bar */}
        <div className="bg-primary/10 border-b border-primary/30 p-4 -mx-4 -mt-4 mb-2 flex justify-between items-center sticky top-0 backdrop-blur-md z-10">
          <div>
            <span className="text-xs text-primary/70 block font-mono">TEAM ID</span>
            <span className="text-2xl font-bold text-white font-mono">{String(teamId).padStart(3, '0')}</span>
          </div>
          <div className="text-right">
            <span className="text-xs text-primary/70 block font-mono">POSITION</span>
            <span className="text-xl font-bold text-white font-mono">AGENT #{passwordOrder}</span>
          </div>
        </div>

        {/* Secret Piece Card */}
        <div className="bg-zinc-900 border border-primary/30 rounded-xl p-6 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          <h3 className="text-sm font-mono text-primary/60 mb-2 uppercase tracking-widest">Your Password Fragment</h3>
          <div className="text-6xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(0,255,0,0.5)]">
            {passwordPiece}
          </div>
          <p className="text-xs text-gray-500 mt-2">Do not share this digitally. Verbal only.</p>
        </div>

        {/* Mission Card */}
        <div className="bg-white text-black rounded-xl p-6 shadow-lg shadow-white/5 relative">
          <div className="flex items-center gap-2 mb-4 border-b border-black/10 pb-2">
            <Eye className="w-5 h-5 text-red-600" />
            <h3 className="font-bold uppercase tracking-widest text-sm">Current Objective</h3>
          </div>
          
          <p className="font-mono text-lg mb-4">
            Find <span className="font-bold bg-black text-white px-2 py-0.5 rounded">AGENT #{passwordOrder + 1}</span>
          </p>
          
          <div className="bg-gray-100 p-4 rounded-lg border-2 border-dashed border-gray-300 space-y-4">
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Physical Description</p>
              <p className="text-xl font-serif italic text-gray-800 leading-relaxed">"{targetData.text}"</p>
            </div>
            
            {targetData.canvas && (
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Facial Profile / Markings</p>
                <img src={targetData.canvas} alt="Target Sketch" className="w-full rounded bg-white border border-gray-200" />
              </div>
            )}
          </div>
        </div>

        {/* Final Input (Only for last player) */}
        {isFinal && (
          <div className="mt-4 bg-red-900/20 border-2 border-red-500/50 rounded-xl p-6 animate-pulse">
            <div className="flex items-center gap-2 mb-4 text-red-500">
              <Lock className="w-6 h-6" />
              <h3 className="font-bold uppercase tracking-widest">FINAL PASSWORD ENTRY</h3>
            </div>
            
            <form onSubmit={handleAttempt} className="flex flex-col gap-4">
              <Input 
                value={finalPassword}
                onChange={(e) => setFinalPassword(e.target.value.toUpperCase())}
                placeholder="ENTER FULL PASSWORD"
                className="bg-black border-red-500/50 text-white font-mono text-center text-2xl uppercase h-16 tracking-[0.5em]"
              />
              <button 
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg text-xl uppercase tracking-widest shadow-lg shadow-red-900/50 transition-all active:scale-95"
              >
                UNLOCK SYSTEM
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  // === HEIST COMPLETE ===
  if (gameState.phase === "COMPLETE") {
    const isWinner = gameState.winningTeams?.some((t: any) => t.teamId === gameState.playerData?.teamId);
    const winningTeam = gameState.winningTeams?.[0]; // Show first winner for now
    
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 text-center ${isWinner ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
        {isWinner ? (
          <>
            <CheckCircle2 className="w-24 h-24 text-primary mb-6 animate-bounce" />
            <h1 className="text-4xl font-bold text-white mb-2">MISSION ACCOMPLISHED</h1>
            <p className="text-primary font-mono text-lg mb-8">Your team cracked the code.</p>
          </>
        ) : (
          <>
            <AlertTriangle className="w-24 h-24 text-red-500 mb-6" />
            <h1 className="text-4xl font-bold text-white mb-2">MISSION FAILED</h1>
            <p className="text-red-400 font-mono text-lg mb-8">Another team was faster.</p>
          </>
        )}

        {winningTeam && (
          <div className="bg-black/50 border border-primary/20 p-6 rounded-lg w-full max-w-xs">
            <p className="text-xs font-mono text-primary/50 uppercase mb-3">Winning Agents</p>
            <div className="flex flex-wrap justify-center gap-2">
              {winningTeam.codenames?.map((name: string) => (
                <span key={name} className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-mono border border-primary/30">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="mt-12 text-sm text-gray-500 font-mono">Waiting for host to reset...</p>
      </div>
    );
  }

  // === DEFAULT: JOIN FORM ===
  return (
    <div className="min-h-screen p-4 flex flex-col justify-center max-w-md mx-auto relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 z-[-1] bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px]" />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-block p-3 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold font-mono text-white tracking-tight">AGENT LOGIN</h1>
          <p className="text-primary/60 text-sm font-mono">SECURE TERMINAL V.4.2</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-primary/80 uppercase tracking-widest ml-1">Codename</label>
            <Input 
              required
              value={codename}
              onChange={e => setCodename(e.target.value)}
              placeholder="e.g. SHADOW, VIPER..."
              className="bg-black/50 border-primary/30 focus:border-primary text-lg h-12 font-mono"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-primary/80 uppercase tracking-widest ml-1">Physical Description</label>
              <Input 
                value={textInfo}
                onChange={e => setTextInfo(e.target.value)}
                placeholder="e.g. Red hoodie, glasses, sitting left"
                className="bg-black/50 border-primary/30 h-12 font-mono"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-primary/80 uppercase tracking-widest ml-1">Facial Profile / Markings</label>
              <div className="border border-primary/20 rounded-lg overflow-hidden bg-black/50">
                <DrawingCanvas onSave={setCanvasInfo} />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={!gameState.connected}
            className="w-full btn-cyber bg-primary/10 hover:bg-primary hover:text-black font-bold py-4 text-xl mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gameState.connected ? "ESTABLISH UPLINK" : "CONNECTING..."}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
