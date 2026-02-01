import { z } from 'zod';
import { insertPlayerSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  game: {
    status: {
      method: 'GET' as const,
      path: '/api/game/status',
      responses: {
        200: z.object({
          phase: z.string(),
          playerCount: z.number(),
          teamSize: z.number().optional(),
          players: z.array(z.object({
            codename: z.string()
          })).optional()
        })
      }
    },
    setTeamSize: {
      method: 'POST' as const,
      path: '/api/game/team-size',
      input: z.object({ size: z.number() }),
      responses: {
        200: z.object({ size: z.number() })
      }
    },
    setPhase: {
      method: 'POST' as const,
      path: '/api/game/phase',
      input: z.object({ phase: z.string() }),
      responses: {
        200: z.object({ phase: z.string() })
      }
    },
    reset: {
      method: 'POST' as const,
      path: '/api/game/reset',
      responses: {
        200: z.object({ message: z.string() })
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
