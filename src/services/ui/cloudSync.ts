import type { LocalBackup } from './storage';

interface EncryptedEnvelope {
  product: 'PhiloMate';
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  updatedAt: string;
}

const ITERATIONS = 310_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function syncId(recoveryKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`philomate-sync-id:${recoveryKey}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(recoveryKey: string, salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(recoveryKey), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

async function encryptBackup(recoveryKey: string, backup: LocalBackup): Promise<EncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(recoveryKey, salt, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(backup)));
  return {
    product: 'PhiloMate',
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: new Date().toISOString(),
  };
}

function validateEnvelope(value: unknown): EncryptedEnvelope {
  if (!value || typeof value !== 'object') throw new Error('云端备份格式不正确');
  const envelope = value as Partial<EncryptedEnvelope>;
  if (
    envelope.product !== 'PhiloMate'
    || envelope.version !== 1
    || envelope.algorithm !== 'AES-GCM'
    || envelope.kdf !== 'PBKDF2-SHA-256'
    || envelope.iterations !== ITERATIONS
    || typeof envelope.salt !== 'string'
    || typeof envelope.iv !== 'string'
    || typeof envelope.ciphertext !== 'string'
  ) throw new Error('云端备份格式不正确');
  return envelope as EncryptedEnvelope;
}

async function apiError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (response.status === 404) return new Error('尚未上传云端备份，或恢复密钥不正确');
  if (response.status === 413) return new Error('备份超出服务器容量限制');
  if (response.status === 429) return new Error('操作过于频繁，请稍后再试');
  return new Error(payload.error === 'sync_not_configured' ? '服务器未启用加密同步' : '加密同步失败');
}

export async function uploadEncryptedBackup(recoveryKey: string, backup: LocalBackup): Promise<void> {
  if (recoveryKey.length < 12) throw new Error('恢复密钥至少需要 12 个字符');
  const id = await syncId(recoveryKey);
  const envelope = await encryptBackup(recoveryKey, backup);
  const response = await fetch('/api/sync', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-sync-id': id },
    body: JSON.stringify(envelope),
  });
  if (!response.ok) throw await apiError(response);
}

export async function downloadEncryptedBackup(recoveryKey: string): Promise<LocalBackup> {
  if (recoveryKey.length < 12) throw new Error('恢复密钥至少需要 12 个字符');
  const id = await syncId(recoveryKey);
  const response = await fetch('/api/sync', { headers: { 'x-sync-id': id } });
  if (!response.ok) throw await apiError(response);
  const envelope = validateEnvelope(await response.json());
  try {
    const salt = base64ToBytes(envelope.salt);
    const iv = base64ToBytes(envelope.iv);
    const key = await deriveKey(recoveryKey, salt, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      base64ToBytes(envelope.ciphertext).buffer as ArrayBuffer,
    );
    return JSON.parse(decoder.decode(plaintext)) as LocalBackup;
  } catch {
    throw new Error('无法解密备份，请检查恢复密钥');
  }
}
