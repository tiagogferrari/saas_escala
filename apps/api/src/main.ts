import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import "dotenv/config";
import Fastify from "fastify";
import { z } from "zod";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3333),
  NODE_ENV: z.string().default("development"),
});

const env = envSchema.parse(process.env);

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
  },
});

await app.register(cors, {
  origin: true,
});
await app.register(helmet);

app.get("/health", async () => ({
  status: "ok",
  service: "escala-api",
  timestamp: new Date().toISOString(),
}));

app.get("/", async () => ({
  name: "SaaS Escala API",
  status: "running",
}));

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
