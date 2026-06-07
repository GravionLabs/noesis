import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),

  DATABASE_URL: z
    .string()
    .default("postgres://noesis:noesis_dev@localhost:5442/noesis"),

  RABBITMQ_URL: z
    .string()
    .default("amqp://guest:guest@localhost:5682/"),

  EMBEDDING_PROVIDER: z
    .enum(["huggingface", "ollama", "openai"])
    .default("huggingface"),

  EMBEDDING_MODEL: z
    .string()
    .default("Xenova/bge-base-en-v1.5"),

  EMBEDDING_DIMENSIONS: z.coerce.number().default(768),

  OPENAI_API_KEY: z.string().default(""),

  OLLAMA_URL: z.string().default("http://localhost:11434"),

  CRAWLER_URL: z.string().default("http://localhost:3001"),

  SERVER_URL: z.string().default("http://localhost:5000"),
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
