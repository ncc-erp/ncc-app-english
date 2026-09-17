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

import http from "http";
import { initBotService } from "../lib/bot/bot-service";
import { isClanMember, isClanAdminMember } from "../lib/mezon/bot-client";

// Standalone execution wrapper
initBotService()
  .then((client) => {
    if (!client) throw new Error("Bot client not initialised");

    // Membership & Admin check for the web app
    // GET /verify?userId=<mezon_id>        header x-bot-secret: $BOT_VERIFY_SECRET
    // GET /verify-admin?userId=<mezon_id>  header x-bot-secret: $BOT_VERIFY_SECRET
    const secret = process.env.BOT_VERIFY_SECRET;
    const port = Number(process.env.BOT_HTTP_PORT || 3100);
    http
      .createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost");
        res.setHeader("Content-Type", "application/json");

        if (url.pathname !== "/verify" && url.pathname !== "/verify-admin") {
          res.writeHead(404).end(JSON.stringify({ error: "not found" }));
          return;
        }
        if (!secret || req.headers["x-bot-secret"] !== secret) {
          res.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        const userId = url.searchParams.get("userId") || "";

        if (url.pathname === "/verify") {
          try {
            const isMember = userId ? await isClanMember(client, userId) : false;
            res.writeHead(200).end(JSON.stringify({ isMember }));
          } catch (err) {
            console.error("[Bot Server] /verify error:", err);
            res.writeHead(500).end(JSON.stringify({ isMember: false }));
          }
          return;
        }

        if (url.pathname === "/verify-admin") {
          try {
            const isAdmin = userId ? await isClanAdminMember(client, userId) : false;
            res.writeHead(200).end(JSON.stringify({ isAdmin }));
          } catch (err) {
            console.error("[Bot Server] /verify-admin error:", err);
            res.writeHead(500).end(JSON.stringify({ isAdmin: false }));
          }
          return;
        }
      })
      .listen(port, () => console.log(`🌐 [Bot Server] /verify & /verify-admin listening on :${port}`));
  })
  .catch((err) => {
    console.error("❌ [Standalone Bot Server] Error:", err);
    process.exit(1);
  });
