import { z } from "zod";
import { buildApp } from "./app";
import "./config/load-env";

const envSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3333),
});

const env = envSchema.parse(process.env);
const app = await buildApp();

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
