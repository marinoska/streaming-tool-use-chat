import 'dotenv/config';

/**
 * Centralized, typed configuration read once from the environment.
 * Loading dotenv here (imported early via main.ts) guarantees env vars are
 * populated before any other module reads them.
 */
export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST ?? '0.0.0.0',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
} as const;
