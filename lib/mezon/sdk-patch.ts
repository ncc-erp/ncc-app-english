import { createRequire } from "module";

// mezon-sdk opens a better-sqlite3 message cache at ./mezon-cache when a MezonClient is
// constructed. On Vercel that is a read-only fs (ENOENT) and the native addon SIGABRTs the
// function on teardown. The app never reads that cache, so on Vercel swap the class for a
// no-op before the SDK loads it. Import this module before anything that imports "mezon-sdk".
if (process.env.VERCEL) {
  // Resolve from this file (walks up to the app's node_modules), not from cwd
  const req = createRequire(__filename);
  const id = req.resolve("mezon-sdk/dist/cjs/sqlite/MessageDatabase");

  class NoopMessageDatabase {
    saveMessage() {}
    getMessageById() {
      return null;
    }
  }

  const cached = req.cache[id];
  if (cached) {
    cached.exports.MessageDatabase = NoopMessageDatabase;
  } else {
    // Pre-seed the require cache so MessageDatabase.js (and better-sqlite3) never load
    const Module = req("module") as typeof import("module");
    const stub = new Module(id);
    stub.filename = id;
    stub.loaded = true;
    stub.exports = { MessageDatabase: NoopMessageDatabase };
    req.cache[id] = stub;
  }
}

export {};
