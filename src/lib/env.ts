import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  STORAGE_DIR: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url(),
  SEED_PASSWORD: z.string().min(12).optional(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_FROM: z.string().email(),
  APP_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: unknown): Env {
  return envSchema.parse(input);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
