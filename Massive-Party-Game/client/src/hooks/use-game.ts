import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useEffect, useState, useRef, useCallback } from "react";
import { WS_EVENTS, type WsMessage } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// === REST API HOOKS ===

export function useGameStatus() {
  return useQuery({
    queryKey: [api.game.status.path],
    queryFn: async () => {
      const res = await fetch(api.game.status.path);
      if (!res.ok) throw new Error("Failed to fetch game status");
      const data = await res.json();
      return data as { 
        phase: string; 
        playerCount: number; 
        teamSize?: number;
        players?: { codename: string }[] 
      };
    },
    refetchInterval: 5000, // Fallback polling
  });
}

export function useResetGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.game.reset.path, { method: api.game.reset.method });
      if (!res.ok) throw new Error("Failed to reset game");
      return (await res.json()) as { message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.game.status.path] });
    },
  });
}

export function useSetTeamSize() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (size: number) => {
      const res = await fetch(api.game.setTeamSize.path, {
        method: api.game.setTeamSize.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size }),
      });
      if (!res.ok) throw new Error("Failed to set team size");
      return (await res.json()) as { size: number };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.game.status.path] });
    },
  });
}

export function useSetPhase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (phase: string) => {
      const res = await fetch(api.game.setPhase.path, {
        method: api.game.setPhase.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to set phase");
      }
      return (await res.json()) as { phase: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.game.status.path] });
    },
  });
}

// === WEBSOCKET HOOK ===

type GameState = {
  phase: string;
  connected: boolean;
  playerData?: {
    teamId: number;
    passwordOrder: number;
    passwordPiece: string;
    targetInfo: string;
    targetType: "TEXT" | "CANVAS" | "BOTH";
    isFinal: boolean;
  };
  winningTeams?: any[];
};

export function useWebSocket() {
  const [gameState, setGameState] = useState<GameState>({
    phase: "START",
    connected: false,
  });
  
  const socketRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Connect on mount
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setGameState(prev => ({ ...prev, connected: true }));
        console.log("WS Connected");
      };

      ws.onclose = () => {
        setGameState(prev => ({ ...prev, connected: false }));
        console.log("WS Disconnected");
        // Simple reconnect logic could go here
      };

      ws.onmessage = (event) => {
        try {
          console.log("Received WS message on client:", event.data);
          const message: WsMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case WS_EVENTS.STATE_UPDATE:
              setGameState(prev => ({ 
                ...prev, 
                phase: (message.payload as any).phase 
              }));
              queryClient.invalidateQueries({ queryKey: [api.game.status.path] });
              break;
              
            case WS_EVENTS.PLAYER_ASSIGNMENT:
              setGameState(prev => ({
                ...prev,
                playerData: message.payload as any
              }));
              break;
              
            case WS_EVENTS.GAME_OVER:
              setGameState(prev => ({
                ...prev,
                winningTeams: (message.payload as any).winningTeams,
                phase: "COMPLETE"
              }));
              break;

            case WS_EVENTS.ERROR:
              toast({
                title: "Error",
                description: (message.payload as any).message,
                variant: "destructive",
              });
              break;
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };
    };

    connect();

    return () => {
      socketRef.current?.close();
    };
  }, [toast, queryClient]);

  const joinGame = useCallback((codename: string, textInfo: string, canvasInfo: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: WS_EVENTS.JOIN_GAME,
        payload: { codename, textInfo, canvasInfo }
      }));
    }
  }, []);

  const submitAttempt = useCallback((teamId: number, attempt: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: WS_EVENTS.SUBMIT_ATTEMPT,
        payload: { teamId, attempt }
      }));
    }
  }, []);

  return {
    gameState,
    joinGame,
    submitAttempt
  };
}
