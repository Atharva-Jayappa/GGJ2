import { type Player, type Team, type InsertPlayer } from "@shared/schema";

export interface IStorage {
  // Players
  createPlayer(socketId: string, player: InsertPlayer): Promise<Player>;
  getPlayer(socketId: string): Promise<Player | undefined>;
  getAllPlayers(): Promise<Player[]>;
  updatePlayer(socketId: string, updates: Partial<Player>): Promise<Player>;
  removePlayer(socketId: string): Promise<void>;

  // Teams
  createTeam(team: Team): Promise<Team>;
  getTeam(teamId: number): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  clearTeams(): Promise<void>;
  
  // Game State
  getPhase(): Promise<string>;
  setPhase(phase: string): Promise<void>;
  clearGame(): Promise<void>;
}

export class MemStorage implements IStorage {
  private players: Map<string, Player>;
  private teams: Map<number, Team>;
  private phase: string;
  private idCounter: number;
  private teamSize: number;

  constructor() {
    this.players = new Map();
    this.teams = new Map();
    this.phase = "START";
    this.idCounter = 1;
    this.teamSize = 3;
  }

  async createPlayer(socketId: string, insertPlayer: InsertPlayer): Promise<Player> {
    const player: Player = {
      ...insertPlayer,
      id: this.idCounter++,
      socketId,
      teamId: null,
      passwordOrder: null,
      passwordPiece: null,
      isFinal: false,
      targetInfo: null,
      targetInfoType: null,
      identifyingInfo: insertPlayer.identifyingInfo || null,
      identifyingInfoType: insertPlayer.identifyingInfoType || "TEXT"
    };
    this.players.set(socketId, player);
    return player;
  }

  async getPlayer(socketId: string): Promise<Player | undefined> {
    return this.players.get(socketId);
  }

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(this.players.values());
  }

  async updatePlayer(socketId: string, updates: Partial<Player>): Promise<Player> {
    const player = this.players.get(socketId);
    if (!player) throw new Error("Player not found");
    const updated = { ...player, ...updates };
    this.players.set(socketId, updated);
    return updated;
  }

  async removePlayer(socketId: string): Promise<void> {
    this.players.delete(socketId);
  }

  async createTeam(team: Team): Promise<Team> {
    const newTeam = { ...team, id: this.idCounter++ };
    this.teams.set(team.teamId, newTeam);
    return newTeam;
  }

  async getTeam(teamId: number): Promise<Team | undefined> {
    return this.teams.get(teamId);
  }

  async getAllTeams(): Promise<Team[]> {
    return Array.from(this.teams.values());
  }

  async clearTeams(): Promise<void> {
    this.teams.clear();
  }

  async getPhase(): Promise<string> {
    return this.phase;
  }

  async getTeamSize(): Promise<number> {
    return this.teamSize;
  }

  async setTeamSize(size: number): Promise<void> {
    this.teamSize = size;
  }

  async setPhase(phase: string): Promise<void> {
    this.phase = phase;
  }

  async clearGame(): Promise<void> {
    // Keep players connected, but reset their game data
    const playersArr = Array.from(this.players.values());
    for (const p of playersArr) {
      this.players.set(p.socketId, {
        ...p,
        teamId: null,
        passwordOrder: null,
        passwordPiece: null,
        isFinal: false,
        targetInfo: null,
        targetInfoType: null
      });
    }
    this.teams.clear();
    this.phase = "START";
  }
}

export const storage = new MemStorage();
