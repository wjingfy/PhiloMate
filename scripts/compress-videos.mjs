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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Browser video conversion failed');
  return result.result.value;
}

async function compressVideo(source, output, bitrate, maxDuration = 15) {
  const value = await evaluate(`(async () => {
    const source = ${JSON.stringify(source)};
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    video.src = source;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('video_load_failed')); });
    const scale = Math.min(1, 1280 / video.videoWidth, 720 / video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const context = canvas.getContext('2d', { alpha: false });
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) throw new Error('webm_encoder_unavailable');
    const recorder = new MediaRecorder(canvas.captureStream(24), { mimeType, videoBitsPerSecond: ${bitrate} });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = reject; });
    const draw = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (!video.ended) requestAnimationFrame(draw);
    };
    recorder.start(1000);
    draw();
    await video.play();
    await Promise.race([
      new Promise((resolve) => { video.onended = resolve; }),
      new Promise((resolve) => setTimeout(resolve, ${maxDuration * 1000})),
    ]);
    video.pause();
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: mimeType });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return { data: btoa(binary), width: canvas.width, height: canvas.height, duration: Math.min(video.currentTime, ${maxDuration}), sourceDuration: video.duration, mimeType };
  })()`);
  const targetPath = resolve(output);
  await mkdir(dirname(targetPath), { recursive: true });
  const buffer = Buffer.from(value.data, 'base64');
  await writeFile(targetPath, buffer);
  console.log(`${source}: ${value.width}x${value.height}, ${value.duration.toFixed(2)}s of ${value.sourceDuration.toFixed(2)}s -> ${output} (${buffer.length} bytes, ${value.mimeType})`);
}

await compressVideo('/converter/video/classroom.webm', 'src/ui/assets/backgrounds/classroom-optimized.webm', 600_000, 12);
await compressVideo('/converter/video/balcony.webm', 'src/ui/assets/window/balcony-optimized.webm', 750_000, 15);
socket.close();
