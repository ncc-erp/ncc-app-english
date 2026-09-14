// Node's real require: webpack rewrites `require`/`createRequire` in the bundle, but leaves
// __non_webpack_require__ alone (and it resolves from the chunk, up to node_modules).
declare const __non_webpack_require__: NodeJS.Require | undefined;

// mezon-sdk opens a better-sqlite3 message cache at ./mezon-cache when a MezonClient is
// constructed. On Vercel that is a read-only fs (ENOENT) and the native addon SIGABRTs the
// function on teardown. The app never reads that cache, so on Vercel swap the class for a
// no-op before the SDK loads it. Import this module before anything that imports "mezon-sdk".
if (process.env.VERCEL) {
  try {
    const req: NodeJS.Require =
      typeof __non_webpack_require__ === "function"
        ? __non_webpack_require__
        : // eslint-disable-next-line no-eval
          (eval("require") as NodeJS.Require);
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
  } catch (err) {
    console.error("[mezon sdk-patch] could not stub MessageDatabase:", err);
  }
}

export {};
