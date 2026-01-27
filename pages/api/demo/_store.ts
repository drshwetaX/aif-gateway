export type DemoLog = {
  ts: string;
  action: string;
  outcome: string;
};

const logs: DemoLog[] = [];

export function addLog(action: string, outcome: string) {
  logs.unshift({
    ts: new Date().toISOString(),
    action,
    outcome,
  });

  // keep last 20
  if (logs.length > 20) logs.length = 20;
}

export function getLogs() {
  return logs;
}
