import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    TAP_URL: z.url().default("http://127.0.0.1:2480"),
    TAP_HISTORY_DB_PATH: z.string().default("./.data/lexicon-history.sqlite"),
    TAP_ADMIN_PASSWORD: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
