import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { WS_EVENTS, type WsMessage } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Broadcast helper
  const broadcast = (message: WsMessage) => {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  const sendTo = (socketId: string, message: WsMessage) => {
    wss.clients.forEach((client) => {
      // @ts-ignore - we attach id to ws client
      if (client.id === socketId && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  };

  wss.on("connection", (ws) => {
    const socketId = Math.random().toString(36).substring(7);
    // @ts-ignore
    ws.id = socketId;

    ws.on("message", async (data) => {
      try {
        console.log("Received WS message:", data.toString());
        const message = JSON.parse(data.toString()) as WsMessage;

        if (message.type === WS_EVENTS.JOIN_GAME) {
          const payload = message.payload as any;
          await storage.createPlayer(socketId, {
            codename: payload.codename,
            identifyingInfo: JSON.stringify({
              text: payload.textInfo,
              canvas: payload.canvasInfo
            }),
            identifyingInfoType: "BOTH"
          });
          
          // Send current phase to new player
          const phase = await storage.getPhase();
          ws.send(JSON.stringify({ type: WS_EVENTS.STATE_UPDATE, payload: { phase } }));
        }

        if (message.type === WS_EVENTS.SUBMIT_ATTEMPT) {
          const { teamId, attempt } = message.payload as any;
          const team = await storage.getTeam(Number(teamId));
          
          if (team && team.password === attempt && !team.completed) {
            // Success!
            // Mark team as completed? Or just announce?
            // "Heist Complete" message with codenames
            
            // Find all team members
            const allPlayers = await storage.getAllPlayers();
            const teamMembers = allPlayers.filter(p => p.teamId === Number(teamId));
            const winningCodenames = teamMembers.map(p => p.codename);

            broadcast({
              type: WS_EVENTS.GAME_OVER,
              payload: {
                winningTeams: [{ teamId: Number(teamId), codenames: winningCodenames }],
                winningTeamId: Number(teamId),
                codenames: winningCodenames
              }
            });
          }
        }

      } catch (e) {
        console.error("WS Error:", e);
      }
    });

    ws.on("close", async () => {
      await storage.removePlayer(socketId);
    });
  });

  // REST API for Host Control

  app.get(api.game.status.path, async (req, res) => {
    const phase = await storage.getPhase();
    const players = await storage.getAllPlayers();
    const teamSize = await storage.getTeamSize();
    res.json({ 
      phase, 
      playerCount: players.length, 
      teamSize,
      players: players.map(p => ({ codename: p.codename }))
    });
  });

  app.post(api.game.setTeamSize.path, async (req, res) => {
    const { size } = req.body;
    await storage.setTeamSize(size);
    res.json({ size });
  });

  app.post(api.game.setPhase.path, async (req, res) => {
    const { phase } = req.body;
    const players = await storage.getAllPlayers();
    const teamSize = await storage.getTeamSize();

    if (phase === "HEIST") {
      if (players.length === 0 || players.length % teamSize !== 0) {
        return res.status(400).json({ 
          message: `Incompatible agent count (${players.length}) for team size ${teamSize}. Teams must be even.` 
        });
      }
    }

    await storage.setPhase(phase);
    broadcast({ type: WS_EVENTS.STATE_UPDATE, payload: { phase } });

    if (phase === "HEIST") {
      setTimeout(async () => {
        await generateTeamsAndAssign();
      }, 500);
    }

    res.json({ phase });
  });

  app.post(api.game.reset.path, async (req, res) => {
    await storage.clearGame();
    broadcast({ type: WS_EVENTS.STATE_UPDATE, payload: { phase: "START" } });
    res.json({ message: "Game reset" });
  });

  // Game Logic Helper
  async function generateTeamsAndAssign() {
    const players = await storage.getAllPlayers();
    if (players.length === 0) return;

    // Shuffle players
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const TEAM_SIZE = await storage.getTeamSize();
    
    // Create chunks
    for (let i = 0; i < shuffled.length; i += TEAM_SIZE) {
      const chunk = shuffled.slice(i, i + TEAM_SIZE);
      if (chunk.length < 2) continue; // Skip leftovers if too small, or handle differently

      // Generate Team ID (random 2 digit)
      const teamId = Math.floor(Math.random() * 90 + 10);
      
      // Generate Password
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let password = "";
      for (let j = 0; j < chunk.length; j++) password += chars[Math.floor(Math.random() * chars.length)];

      await storage.createTeam({ 
        id: Math.floor(Math.random() * 1000000), // Add explicit ID for storage consistency
        teamId, 
        password, 
        completed: false 
      });

      // Assign roles
      for (let j = 0; j < chunk.length; j++) {
        const player = chunk[j];
        const nextPlayer = chunk[(j + 1) % chunk.length]; // Circular for target info
        
        const updates: any = {
          teamId,
          passwordOrder: j + 1,
          passwordPiece: password[j],
          isFinal: j === chunk.length - 1,
          targetInfo: nextPlayer.identifyingInfo,
          targetInfoType: nextPlayer.identifyingInfoType
        };

        await storage.updatePlayer(player.socketId, updates);

        // Send individual assignment
        sendTo(player.socketId, {
          type: WS_EVENTS.PLAYER_ASSIGNMENT,
          payload: updates
        });
      }
    }
  }

  return httpServer;
}
