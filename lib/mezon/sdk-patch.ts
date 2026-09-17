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

// Patch 1: Prevent trimAbridgedPadding from arbitrarily stripping trailing zeroes of valid protobuf payloads.
// Abridged TCP padding in Mezon protocol is strictly at most 3 zero bytes for 4-byte boundary alignment.
// Stripping all trailing zeros arbitrarily destroys valid protobuf payloads ending in 0x00,
// which causes "RangeError: index out of range: N + 1 > N" during protobuf decoding.
try {
  const req: NodeJS.Require =
    typeof __non_webpack_require__ === "function"
      ? __non_webpack_require__
      : (eval("require") as NodeJS.Require);
  const protoDecodeId = req.resolve("mezon-sdk/dist/cjs/transport/protobuf_decode");
  const protoDecode = req(protoDecodeId);
  if (protoDecode && typeof protoDecode.trimAbridgedPadding === "function") {
    protoDecode.trimAbridgedPadding = function (payload: any) {
      const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
      let end = bytes.length;
      let trimmedCount = 0;
      while (end > 0 && bytes[end - 1] === 0 && trimmedCount < 3) {
        end--;
        trimmedCount++;
      }
      return new Uint8Array(bytes.subarray(0, end));
    };
  }
} catch (err) {
  console.warn("[mezon sdk-patch] could not patch trimAbridgedPadding:", err);
}

// Patch 2: Lenient RoleListEventResponse decoding to prevent crashes on truncated role frames
try {
  const req: NodeJS.Require =
    typeof __non_webpack_require__ === "function"
      ? __non_webpack_require__
      : (eval("require") as NodeJS.Require);
  const apiProtoId = req.resolve("mezon-sdk/dist/cjs/api/api");
  const apiProto = req(apiProtoId);
  if (apiProto && apiProto.RoleListEventResponse) {
    const origDecode = apiProto.RoleListEventResponse.decode.bind(apiProto.RoleListEventResponse);
    apiProto.RoleListEventResponse.decode = function (input: any, length?: number) {
      try {
        return origDecode(input, length);
      } catch (err: any) {
        if (
          err instanceof RangeError ||
          err?.name === "RangeError" ||
          String(err?.message).includes("out of range")
        ) {
          console.warn("[mezon sdk-patch] Rescued RangeError during RoleListEventResponse decode:", err.message);
          return apiProto.RoleListEventResponse.fromPartial({});
        }
        throw err;
      }
    };
  }
} catch (err) {
  console.warn("[mezon sdk-patch] could not patch RoleListEventResponse.decode:", err);
}

// Patch 3: Lenient ChannelUserList decoding to prevent RangeError on truncated/padded channel user frames
try {
  const req: NodeJS.Require =
    typeof __non_webpack_require__ === "function"
      ? __non_webpack_require__
      : (eval("require") as NodeJS.Require);
  const apiProtoId = req.resolve("mezon-sdk/dist/cjs/api/api");
  const apiProto = req(apiProtoId);
  if (apiProto && apiProto.ChannelUserList) {
    const origDecode = apiProto.ChannelUserList.decode.bind(apiProto.ChannelUserList);
    apiProto.ChannelUserList.decode = function (input: any, length?: number) {
      try {
        return origDecode(input, length);
      } catch (err: any) {
        if (
          err instanceof RangeError ||
          err?.name === "RangeError" ||
          String(err?.message).includes("out of range")
        ) {
          console.warn("[mezon sdk-patch] Rescued RangeError during ChannelUserList decode:", err.message);
          return apiProto.ChannelUserList.fromPartial({});
        }
        throw err;
      }
    };
  }
} catch (err) {
  console.warn("[mezon sdk-patch] could not patch ChannelUserList.decode:", err);
}

export {};

