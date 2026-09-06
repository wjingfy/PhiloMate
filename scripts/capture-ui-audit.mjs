import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve(process.argv[2] || '.ui-audit/current');
const debugPort = process.env.CDP_PORT || '9222';
const viewportWidth = Number(process.env.AUDIT_WIDTH || 1440);
const viewportHeight = Number(process.env.AUDIT_HEIGHT || 900);
const auditRole = process.env.AUDIT_ROLE || 'confucius';
const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5199'));
if (!target) throw new Error('PhiloMate debug target not found');

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

const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
async function evaluate(expression) {
  return send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
  await wait(700);
}
async function capture(name) {
  await evaluate(`document.querySelectorAll('video').forEach((video) => video.pause())`);
  await wait(120);
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(resolve(outputDir, `${name}.png`), Buffer.from(data, 'base64'));
}

await mkdir(outputDir, { recursive: true });
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: viewportWidth <= 600,
});
await evaluate('location.reload()');
await wait(1800);
if (process.env.AUDIT_INTERACTIONS === '1') {
  await evaluate('localStorage.clear(); location.reload()');
  await wait(1800);
  await click(`[data-select-role="${auditRole}"]`);
  await capture('01-paper-notice');
  await click('#advance-entry');
  await capture('02-paper-opening');
  await wait(1900);
  await capture('03-paper-reveal');
  await click('#advance-entry');
  for (let index = 0; index < 6; index += 1) {
    if (!(await evaluate(`Boolean(document.querySelector('#advance-entry'))`)).result?.value) break;
    await click('#advance-entry');
  }
  await capture('04-tools-collapsed');
  await click('#toggle-more');
  await capture('05-tools-expanded');
  await click('#open-snacks');
  await capture('06-snack-open');
  await click('.owned-snack');
  await click('#confirm-snack');
  await capture('07-snack-reply');
  await wait(4400);
  await capture('08-snack-reply-dismissed');
  await click('#close-snacks');
  await capture('09-dialogue-after-gift');
  socket.close();
  console.log(outputDir);
  process.exit(0);
}
if (process.env.AUDIT_WINDOW_ONLY === '1') {
  await evaluate(`location.href = ${JSON.stringify(`http://127.0.0.1:5199/?role=${auditRole}&feature=window&preview=1`)}`);
  await wait(2400);
  await click('[data-window-panel="records"]');
  await capture('01-reading-records');
  await click('[data-window-panel="add"]');
  await capture('02-add-book');
  socket.close();
  console.log(outputDir);
  process.exit(0);
}
if (process.env.AUDIT_DIALOGUE_ONLY === '1') {
  await click(`[data-select-role="${auditRole}"]`);
  for (let index = 0; index < 6; index += 1) {
    if (!(await evaluate(`Boolean(document.querySelector('#advance-entry'))`)).result?.value) break;
    await click('#advance-entry');
  }
  await capture('dialogue');
  socket.close();
  console.log(outputDir);
  process.exit(0);
}
await capture('01-selection');
await click(`[data-select-role="${auditRole}"]`);
for (let index = 0; index < 4; index += 1) {
  if (!(await evaluate(`Boolean(document.querySelector('#advance-entry'))`)).result?.value) break;
  await click('#advance-entry');
}
await capture('02-dialogue');
await click('[data-open-feature="window"]');
await capture('03-window');
await click('[data-window-panel="records"]');
await capture('03a-reading-records');
await click('[data-window-panel="add"]');
await capture('03b-add-book');
await click('#close-feature');
await click('#toggle-more');
await click('[data-open-feature="notes"]');
await capture('04-notes');
await click('#close-feature');
await click('[data-open-feature="career"]');
await capture('05-career');
await click('#close-feature');
await click('[data-open-feature="thoughts"]');
await capture('06-thoughts');
await click('#close-feature');
await click('#open-snacks');
await capture('07-snacks');
await click('#open-atlas');
await capture('08-snack-atlas');
socket.close();
console.log(outputDir);
