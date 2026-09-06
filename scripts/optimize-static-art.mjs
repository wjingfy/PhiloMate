import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const debugPort = process.env.CDP_PORT || '9444';
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

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser conversion failed');
  return result.result.value;
}

async function convertImage(source, output, maxWidth, maxHeight, quality = .78) {
  const value = await evaluate(`(async () => {
    const image = new Image();
    image.src = ${JSON.stringify(source)};
    await image.decode();
    const scale = Math.min(1, ${maxWidth} / image.naturalWidth, ${maxHeight} / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/webp', ${quality}), sourceWidth: image.naturalWidth, sourceHeight: image.naturalHeight, width: canvas.width, height: canvas.height };
  })()`);
  const targetPath = resolve(output);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, Buffer.from(value.data.split(',')[1], 'base64'));
  console.log(`${source}: ${value.sourceWidth}x${value.sourceHeight} -> ${value.width}x${value.height} ${output}`);
}

async function videoPoster(source, output, maxWidth = 1280, maxHeight = 720) {
  const value = await evaluate(`(async () => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = ${JSON.stringify(source)};
    await new Promise((resolve, reject) => { video.onloadeddata = resolve; video.onerror = reject; });
    video.currentTime = Math.min(.2, video.duration || .2);
    await new Promise((resolve) => { video.onseeked = resolve; setTimeout(resolve, 500); });
    const scale = Math.min(1, ${maxWidth} / video.videoWidth, ${maxHeight} / video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', .76);
  })()`);
  const targetPath = resolve(output);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, Buffer.from(value.split(',')[1], 'base64'));
  console.log(`${source} -> ${output}`);
}

for (const role of ['confucius', 'socrates', 'wangyangming', 'foucault']) {
  const source = `/converter/dialogue/${role}.webp`;
  await convertImage(source, `src/ui/assets/dialogue/optimized/${role}-480.webp`, 480, 900, .76);
  await convertImage(source, `src/ui/assets/dialogue/optimized/${role}-800.webp`, 800, 1280, .78);
  await convertImage(`/converter/selection/${role}.png`, `src/ui/assets/selection/${role}.webp`, 380, 520, .76);
}
await videoPoster('/converter/video/classroom.webm', 'src/ui/assets/backgrounds/classroom-poster.webp');
await videoPoster('/converter/video/balcony.webm', 'src/ui/assets/window/balcony-poster.webp');
socket.close();
