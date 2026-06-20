import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z
    .string()
    .default("postgres://noesis:noesis_dev@localhost:5442/noesis"),

  EMBEDDING_PROVIDER: z
    .enum(["local", "ollama", "openai"])
    .default("local"),

  EMBEDDING_MODEL: z
    .string()
    .default("Xenova/bge-base-en-v1.5"),

  EMBEDDING_DIMENSIONS: z.coerce.number().default(768),

  OPENAI_API_KEY: z.string().default(""),

  OLLAMA_URL: z.string().default("http://localhost:11434"),

  GITHUB_TOKEN: z.string().default(""),

  AZURE_DEVOPS_TOKEN: z.string().default(""),
  AZURE_DEVOPS_ORG: z.string().default(""),

  API_KEY: z.string().default(""),

  SERVER_URL: z.string().default("http://localhost:5000"),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_SINK: z.enum(["stdout", "seq", "ecs"]).optional(),
  SEQ_URL: z.string().default("http://localhost:5341"),

  MAX_IMPORT_RETRIES: z.coerce.number().default(3),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:");
    for (const issue of parsed.error.issues) {
      console.error("  %s: %s", issue.path.join("."), issue.message);
    }
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();
