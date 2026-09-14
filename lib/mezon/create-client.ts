import os from "os";
import { MezonClient } from "mezon-sdk";

type MezonClientOptions = ConstructorParameters<typeof MezonClient>[0];

// ponytail: mezon-sdk opens a sqlite cache at ./mezon-cache relative to cwd; on Vercel cwd is
// read-only, so construct the client from tmpdir. Drop this if the SDK ever exposes the path.
export function createMezonClient(opts: MezonClientOptions): MezonClient {
  if (!process.env.VERCEL) return new MezonClient(opts);
  const cwd = process.cwd();
  process.chdir(os.tmpdir());
  try {
    return new MezonClient(opts);
  } finally {
    process.chdir(cwd);
  }
}
