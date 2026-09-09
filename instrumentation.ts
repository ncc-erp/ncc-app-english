export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Crucial: Do NOT run bot during static build / compile phase (npm run build)
    if (process.env.NEXT_PHASE === "phase-production-build") {
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
