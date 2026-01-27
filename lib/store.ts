import { cmdUrl, multiExec } from "./redis";

export type DemoLog = {
  ts: string;
  action: string;
  outcome: string;
};

const KEY = "aif:demo:logs";

/**
 * Append a log entry to Redis (durable) and keep only the last 50.
 */
export async function addLog(action: string, outcome: string) {
  const entry: DemoLog = {
    ts: new Date().toISOString(),
    action,
    outcome,
  };

  const payload = JSON.stringify(entry);

  await multiExec([
    ["LPUSH", KEY, payload],
    ["LTRIM", KEY, 0, 49],
  ]);
}

/**
 * Fetch last 20 log entries (most recent first).
 */
export async function getLogs(limit = 20): Promise<DemoLog[]> {
  const end = Math.max(0, limit - 1);
  const result = await cmdUrl(`lrange/${encodeURIComponent(KEY)}/0/${end}`);

  const items: string[] = Array.isArray(result) ? result : [];
  const logs: DemoLog[] = [];

  for (const s of items) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj.ts === "string") logs.push(obj as DemoLog);
    } catch {
      // ignore malformed entries
    }
  }

  return logs;
}

/**
 * Optional: clear logs (handy for demos)
 */
export async function clearLogs() {
  await multiExec([["DEL", KEY]]);
}
