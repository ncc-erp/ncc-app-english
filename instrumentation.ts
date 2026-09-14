export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Crucial: Do NOT run bot during static build / compile phase (npm run build)
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return;
    }
    // The bot is a long-lived websocket + sqlite (better-sqlite3) process; inside a
    // serverless function it either fails (read-only fs) or SIGABRTs the whole process.
    if (process.env.VERCEL) {
      console.warn("[Instrumentation] Skipping Mezon Bot on Vercel; run the bot on a long-lived host.");
      return;
    }

    try {
      const { initBotService } = await import("./lib/bot/bot-service");
      await initBotService();
    } catch (err) {
      console.error("[Instrumentation] Failed to initialize Mezon Bot:", err);
    }
  }
}
