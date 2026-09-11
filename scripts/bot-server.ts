import path from "path";
import { loadEnvConfig } from "@next/env";

// Ensure all environment variables from .env.local and .env are fully loaded
try {
  loadEnvConfig(path.resolve(__dirname, ".."));
} catch {
  // ignore
}
try {
  loadEnvConfig(process.cwd());
} catch {
  // ignore
}

import { initBotService } from "../lib/bot/bot-service";

// Standalone execution wrapper
initBotService().catch((err) => {
  console.error("❌ [Standalone Bot Server] Error:", err);
  process.exit(1);
});
