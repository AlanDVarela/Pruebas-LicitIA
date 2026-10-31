import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  COOKIE_SECURE: bool.default('false'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AI_ENABLED: bool.default('true'),
  STORAGE_DIR: z.string().default('./storage'),
  LLM_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
});

export const env = schema.parse(process.env);
