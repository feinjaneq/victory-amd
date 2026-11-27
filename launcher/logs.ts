// Run logs are a session's own: when a new game session starts, the log of the
// one before it goes. Build and prebuild logs are kept — they are what a failed
// compile or a shader pass is read from afterwards.
import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/// Deletes every `run-*.log` in `dir` except `keep` (the log of the session that
/// is starting). Returns how many went. Never throws: a file another process still
/// holds is left alone.
export function pruneRunLogs(dir: string, keep: string): number {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    if (!/^run-.*\.log$/i.test(name)) continue;
    const file = join(dir, name);
    if (file === keep) continue;
    try {
      unlinkSync(file);
      removed += 1;
    } catch {
      /* open somewhere else; the next session tries again */
    }
  }
  return removed;
}
