const debugPort = process.env.CDP_PORT || '9445';
const baseUrl = process.env.PHILOMATE_AUDIT_URL || 'http://127.0.0.1:5199/';
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
const target = targets.find((item) => item.type === 'page');
if (!target) throw new Error('No browser page is available on the configured CDP port');

const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
};
await new Promise((resolveOpen, reject) => {
  socket.onopen = resolveOpen;
  socket.onerror = reject;
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolveSend, reject) => pending.set(id, { resolve: resolveSend, reject }));
}

await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.enable');
await send('Page.navigate', { url: `${baseUrl}?audit=${Date.now()}` });
await new Promise((resolveWait) => setTimeout(resolveWait, 3500));
const evaluated = await send('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(() => {
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      type: entry.initiatorType,
      bytes: entry.transferSize || entry.encodedBodySize || 0,
      duration: Math.round(entry.duration),
    }));
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, Math.round(entry.startTime)]));
    return {
      route: location.pathname,
      readyState: document.readyState,
      transferredBytes: resources.reduce((sum, entry) => sum + entry.bytes, navigation?.transferSize || 0),
      resourceCount: resources.length + 1,
      firstContentfulPaintMs: paint['first-contentful-paint'] ?? null,
      domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
      loadMs: navigation ? Math.round(navigation.loadEventEnd) : null,
      byType: resources.reduce((groups, entry) => {
        groups[entry.type] = (groups[entry.type] || 0) + entry.bytes;
        return groups;
      }, {}),
      largest: resources.sort((a, b) => b.bytes - a.bytes).slice(0, 8),
    };
  })()`,
});
socket.close();
const metrics = evaluated.result.value;
const budgets = {
  transferredBytes: { actual: metrics.transferredBytes, maximum: 3 * 1024 * 1024 },
  firstContentfulPaintMs: { actual: metrics.firstContentfulPaintMs, maximum: 3000 },
  resourceCount: { actual: metrics.resourceCount, maximum: 45 },
};
const failures = Object.entries(budgets)
  .filter(([, budget]) => typeof budget.actual !== 'number' || budget.actual > budget.maximum)
  .map(([name, budget]) => `${name}: ${budget.actual} > ${budget.maximum}`);
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), metrics, budgets, passed: failures.length === 0, failures }, null, 2));
if (failures.length) process.exitCode = 1;
