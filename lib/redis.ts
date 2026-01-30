// lib/redis.ts
type UpstashResp<T> = { result: T; error?: string };

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
// lib/redis.ts
import Redis from "ioredis";

let _redis: Redis | null = null;

export function redis() {
  if (!_redis) _redis = new Redis(process.env.REDIS_URL!);
  return _redis;
}

export async function multiExec(
  fn: (multi: ReturnType<Redis["multi"]>) => void
) {
  const m = redis().multi();
  fn(m);
  return await m.exec();
}

async function upstash<T>(cmd: string, args: (string | number)[] = []): Promise<T> {
  if (!url || !token) throw new Error("Upstash Redis env vars not set");
  const endpoint = `${url}/${cmd}/${args.map((x) => encodeURIComponent(String(x))).join("/")}`;

  const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
  const j = (await r.json()) as UpstashResp<T>;

  if ((j as any)?.error) throw new Error(String((j as any).error));
  return j.result;
}

export function getRedis() {
  return {
    lrange: (key: string, start: number, stop: number) => upstash<any[]>("lrange", [key, start, stop]),
    get: (key: string) => upstash<string | null>("get", [key]),
    set: (key: string, value: string) => upstash<"OK">("set", [key, value]),
    lpush: (key: string, value: string) => upstash<number>("lpush", [key, value]),
    lrem: (key: string, count: number, value: string) => upstash<number>("lrem", [key, count, value]),
    ltrim: (key: string, start: number, stop: number) => upstash<"OK">("ltrim", [key, start, stop]),
    del: (key: string) => upstash<number>("del", [key]),

    // demo-friendly multiExec: sequential execution (OK for <500 items demo scale)
    multiExec: async (commands: Array<[string, ...any[]]>) => {
      const out: any[] = [];
      for (const c of commands) {
        const [cmd, ...args] = c;
        out.push(await upstash<any>(cmd, args as any));
      }
      return out;
    },
  };
}
