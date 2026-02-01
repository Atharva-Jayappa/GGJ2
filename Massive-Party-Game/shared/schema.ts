import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Global game state (singleton for this demo)
export const gameState = pgTable("game_state", {
  id: serial("id").primaryKey(),
  phase: text("phase").notNull().default("START"), // START, TUTORIAL, LOBBY, HEIST, COMPLETE
  teamSize: integer("team_size").default(3),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(), // The visible ID (e.g. 34)
  password: text("password").notNull(), // The full random password
  completed: boolean("completed").default(false),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  socketId: text("socket_id").notNull(),
  codename: text("codename").notNull(),
  identifyingInfo: text("identifying_info"), // Text or base64 image
  identifyingInfoType: text("identifying_info_type").default("TEXT"), // TEXT or CANVAS
  teamId: integer("team_id"), // FK to teams.teamId (logical ID)
  passwordOrder: integer("password_order"), // 1-based index
  passwordPiece: text("password_piece"), // The character they hold
  isFinal: boolean("is_final").default(false),
  targetInfo: text("target_info"), // The info of the person they need to find
  targetInfoType: text("target_info_type"),
});

// === SCHEMAS ===
export const insertPlayerSchema = createInsertSchema(players).omit({ 
  id: true, 
  socketId: true,
  teamId: true,
  passwordOrder: true,
  passwordPiece: true,
  isFinal: true,
  targetInfo: true,
  targetInfoType: true
});

// === TYPES ===
export type GameState = typeof gameState.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;

// === WEBSOCKET TYPES ===
export const WS_EVENTS = {
  // Client -> Server
  JOIN_GAME: 'join_game', // { codename, identifyingInfo, type }
  SUBMIT_ATTEMPT: 'submit_attempt', // { teamId, attempt }
  
  // Server -> Client
  STATE_UPDATE: 'state_update', // { phase }
  PLAYER_ASSIGNMENT: 'player_assignment', // { teamId, order, piece, targetInfo, targetType, isFinal }
  GAME_OVER: 'game_over', // { winningTeams: [] }
  ERROR: 'error'
} as const;

export interface WsMessage<T = unknown> {
  type: string;
  payload: T;
}
