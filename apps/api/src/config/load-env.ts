import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const candidateEnvFiles = [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "..", "..", ".env"),
];

for (const path of candidateEnvFiles) {
  if (existsSync(path)) {
    config({ path, override: false });
  }
}
