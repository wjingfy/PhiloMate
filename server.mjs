import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('.', import.meta.url));

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const [, name, rawValue = ''] = match;
    if (process.env[name] !== undefined) continue;

    let value = rawValue.trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    process.env[name] = value;
  }
}

loadEnvFile(resolve(root, '.env'));

const isDev = process.argv.includes('--dev');
const port = Number(process.env.PORT || 5199);
const host = process.env.HOST || '127.0.0.1';
const key = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
const modelDefault = process.env.QWEN_MODEL || 'qwen3.8-max';
const baseUrl = (process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
const syncDirectory = process.env.PHILOMATE_SYNC_DIR ? resolve(process.env.PHILOMATE_SYNC_DIR) : '';

let vite;
if (isDev) {
  const { createServer: createViteServer } = await import('vite');
  vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const bookSearchCache = new Map();
const compressedAssetCache = new Map();
const corpusCache = new Map();
const roleIds = new Set(['confucius', 'socrates', 'wangyangming', 'foucault']);
const syncRequests = new Map();

function allowSyncRequest(req) {
  const address = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (syncRequests.get(address) || []).filter((time) => now - time < 10 * 60_000);
  if (recent.length >= 30) return false;
  recent.push(now);
  syncRequests.set(address, recent);
  return true;
}

function syncIdentifier(req) {
  const value = String(req.headers['x-sync-id'] || '');
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}

function corpusTerms(text) {
  const normalized = String(text || '').toLocaleLowerCase();
  const chars = [...normalized.replace(/[\s，。！？；：、“”‘’（）()【】\[\],.!?;:'"-]+/g, '')];
  const terms = [];
  for (let index = 0; index < chars.length - 1; index += 1) terms.push(chars[index] + chars[index + 1]);
  terms.push(...(normalized.match(/[a-z0-9]{2,}/g) || []));
  return [...new Set(terms)].slice(0, 80);
}

async function loadCorpus(role) {
  if (corpusCache.has(role)) return corpusCache.get(role);
  const built = resolve(root, 'dist', role, 'corpus_annotated.json');
  const source = resolve(root, 'src', 'data', role, 'corpus_annotated.json');
  const payload = JSON.parse(await readFile(existsSync(built) ? built : source, 'utf8'));
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  corpusCache.set(role, entries);
  return entries;
}

async function searchCorpus(role, query, limit) {
  const terms = corpusTerms(query);
  const entries = await loadCorpus(role);
  return entries.map((entry) => {
    const themes = Array.isArray(entry.themes) ? entry.themes : [];
    const categories = Array.isArray(entry.categories) ? entry.categories : [];
    const blob = `${entry.condensed || ''} ${entry.text || ''} ${themes.join(' ')} ${categories.join(' ')}`.toLocaleLowerCase();
    let score = 0;
    for (const term of terms) if (blob.includes(term)) score += term.length > 2 ? 3 : 1;
    for (const key of [...themes, ...categories]) if (query.includes(key)) score += 20 + key.length;
    return { entry, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.entry);
}

function normalizeIsbn(value) {
  const raw = String(value || '').replace(/[^0-9X]/gi, '').toUpperCase();
  return raw.length === 10 || raw.length === 13 ? raw : '';
}

function isValidIsbn13(value) {
  if (!/^97[89]\d{10}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === Number(value[12]);
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { 'user-agent': 'PhiloMate/0.1 book-metadata-search' } });
  if (!response.ok) throw new Error(`metadata_source_${response.status}`);
  return response.json();
}

function googleCandidates(payload) {
  return (payload?.items || []).map((item) => {
    const info = item.volumeInfo || {};
    const ids = Array.isArray(info.industryIdentifiers) ? info.industryIdentifiers : [];
    const isbn13 = ids.find((entry) => entry.type === 'ISBN_13')?.identifier || '';
    const isbn10 = ids.find((entry) => entry.type === 'ISBN_10')?.identifier || '';
    const candidate = {
      id: `google:${item.id}`,
      title: info.title || '',
      subtitle: info.subtitle || '',
      authors: info.authors || [],
      translators: [],
      publisher: info.publisher || '',
      publishedDate: info.publishedDate || '',
      edition: '',
      isbn13,
      isbn10,
      pageCount: Number(info.pageCount) || null,
      language: info.language || '',
      description: info.description || '',
      coverUrl: info.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || '',
      sources: ['Google Books'],
      fetchedAt: new Date().toISOString(),
    };
    candidate.fieldProvenance = Object.fromEntries(Object.entries(candidate).filter(([field, value]) => value && !['id', 'sources', 'fetchedAt'].includes(field)).map(([field]) => [field, 'Google Books']));
    candidate.conflicts = {};
    candidate.confidence = isbn13 ? 0.95 : 0.76;
    return candidate;
  }).filter((item) => item.title);
}

function openLibraryCandidates(payload) {
  return (payload?.docs || []).map((item) => {
    const isbns = Array.isArray(item.isbn) ? item.isbn.map(normalizeIsbn) : [];
    const candidate = {
      id: `openlibrary:${item.key || item.cover_i || item.title}`,
      title: item.title || '',
      subtitle: item.subtitle || '',
      authors: item.author_name || [],
      translators: [],
      publisher: item.publisher?.[0] || '',
      publishedDate: item.publish_date?.[0] || String(item.first_publish_year || ''),
      edition: '',
      isbn13: isbns.find((isbn) => isbn.length === 13) || '',
      isbn10: isbns.find((isbn) => isbn.length === 10) || '',
      pageCount: Number(item.number_of_pages_median) || null,
      language: item.language?.[0] || '',
      description: '',
      coverUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : '',
      sources: ['Open Library'],
      fetchedAt: new Date().toISOString(),
    };
    candidate.fieldProvenance = Object.fromEntries(Object.entries(candidate).filter(([field, value]) => value && !['id', 'sources', 'fetchedAt'].includes(field)).map(([field]) => [field, 'Open Library']));
    candidate.conflicts = {};
    candidate.confidence = candidate.isbn13 ? 0.92 : 0.7;
    return candidate;
  }).filter((item) => item.title);
}

function mergeBookCandidates(items) {
  const merged = new Map();
  for (const item of items) {
    const key = item.isbn13 || `${item.title}|${item.authors.join(',')}|${item.publisher}`.toLocaleLowerCase();
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      continue;
    }
    for (const field of ['subtitle', 'publisher', 'publishedDate', 'edition', 'isbn13', 'isbn10', 'pageCount', 'language', 'description', 'coverUrl']) {
      if (!current[field] && item[field]) {
        current[field] = item[field];
        current.fieldProvenance[field] = item.fieldProvenance[field] || item.sources[0];
      } else if (current[field] && item[field] && String(current[field]) !== String(item[field])) {
        current.conflicts[field] = current.conflicts[field] || [];
        const alternatives = [
          { value: current[field], source: current.fieldProvenance[field] || current.sources[0] },
          { value: item[field], source: item.fieldProvenance[field] || item.sources[0] },
        ];
        for (const alternative of alternatives) {
          if (!current.conflicts[field].some((entry) => String(entry.value) === String(alternative.value))) current.conflicts[field].push(alternative);
        }
      }
    }
    current.sources = [...new Set([...current.sources, ...item.sources])];
    current.confidence = Math.max(current.confidence, item.confidence);
  }
  return [...merged.values()].slice(0, 10);
}

async function searchBooks(query) {
  const normalized = query.trim();
  const isbn = normalizeIsbn(normalized);
  if (isbn.length === 13 && !isValidIsbn13(isbn)) throw new Error('invalid_isbn');
  const cacheKey = isbn || normalized.toLocaleLowerCase();
  const cached = bookSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const googleQuery = isbn ? `isbn:${isbn}` : normalized;
  const openQuery = isbn ? `isbn:${isbn}` : normalized;
  try {
    const results = await Promise.allSettled([
      fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(googleQuery)}&maxResults=10`, controller.signal),
      fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(openQuery)}&limit=10&fields=key,title,subtitle,author_name,publisher,publish_date,first_publish_year,isbn,cover_i,number_of_pages_median,language`, controller.signal),
    ]);
    const candidates = mergeBookCandidates([
      ...(results[0].status === 'fulfilled' ? googleCandidates(results[0].value) : []),
      ...(results[1].status === 'fulfilled' ? openLibraryCandidates(results[1].value) : []),
    ]);
    if (results.every((result) => result.status === 'rejected')) throw new Error('metadata_sources_unavailable');
    const value = { query: normalized, candidates, partial: results.some((result) => result.status === 'rejected') };
    bookSearchCache.set(cacheKey, { value, expiresAt: Date.now() + 10 * 60_000 });
    return value;
  } finally {
    clearTimeout(timer);
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function readSyncBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const value = JSON.parse(raw || '{}');
  if (
    value?.product !== 'PhiloMate'
    || value?.version !== 1
    || value?.algorithm !== 'AES-GCM'
    || value?.kdf !== 'PBKDF2-SHA-256'
    || value?.iterations !== 310000
    || typeof value?.salt !== 'string'
    || typeof value?.iv !== 'string'
    || typeof value?.ciphertext !== 'string'
    || value.salt.length > 128
    || value.iv.length > 128
    || value.ciphertext.length > 44 * 1024 * 1024
  ) throw new Error('sync_envelope_invalid');
  return raw;
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, modelConfigured: Boolean(key), syncConfigured: Boolean(syncDirectory), model: modelDefault });
    return true;
  }
  if (pathname === '/api/sync' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!syncDirectory) {
      sendJson(res, 503, { error: 'sync_not_configured' });
      return true;
    }
    if (!allowSyncRequest(req)) {
      sendJson(res, 429, { error: 'sync_rate_limited' });
      return true;
    }
    const id = syncIdentifier(req);
    if (!id) {
      sendJson(res, 400, { error: 'sync_id_invalid' });
      return true;
    }
    const target = resolve(syncDirectory, `${id}.json`);
    try {
      await mkdir(syncDirectory, { recursive: true });
      if (req.method === 'GET') {
        const body = await readFile(target);
        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        });
        res.end(body);
      } else {
        const body = await readSyncBody(req);
        const temporary = resolve(syncDirectory, `${id}.${process.pid}.${Date.now()}.tmp`);
        await writeFile(temporary, body, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        await rename(temporary, target);
        sendJson(res, 200, { ok: true });
      }
    } catch (error) {
      if (error?.code === 'ENOENT') sendJson(res, 404, { error: 'sync_not_found' });
      else if (error?.message === 'request_too_large') sendJson(res, 413, { error: 'sync_too_large' });
      else if (error instanceof SyntaxError || error?.message === 'sync_envelope_invalid') sendJson(res, 400, { error: 'sync_envelope_invalid' });
      else sendJson(res, 500, { error: 'sync_storage_failed' });
    }
    return true;
  }
  if (pathname === '/api/books/search' && req.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim();
    if (query.length < 2 || query.length > 160) {
      sendJson(res, 400, { error: 'book_query_invalid' });
      return true;
    }
    try {
      sendJson(res, 200, await searchBooks(query));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'book_search_failed';
      sendJson(res, message === 'invalid_isbn' ? 400 : error?.name === 'AbortError' ? 504 : 502, { error: message });
    }
    return true;
  }
  if (pathname === '/api/corpus/search' && req.method === 'GET') {
    const role = url.searchParams.get('role') || '';
    const query = (url.searchParams.get('q') || '').trim();
    const limit = Math.max(5, Math.min(40, Number(url.searchParams.get('limit')) || 24));
    if (!roleIds.has(role) || query.length < 1 || query.length > 600) {
      sendJson(res, 400, { error: 'corpus_query_invalid' });
      return true;
    }
    try {
      sendJson(res, 200, { role, entries: await searchCorpus(role, query, limit) });
    } catch {
      sendJson(res, 503, { error: 'corpus_unavailable' });
    }
    return true;
  }
  if (pathname !== '/api/chat' || req.method !== 'POST') return false;
  if (!key) {
    sendJson(res, 503, { error: 'model_not_configured' });
    return true;
  }

  try {
    const body = await readJsonBody(req);
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (!messages.length) {
      sendJson(res, 400, { error: 'messages_required' });
      return true;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    const requestedModel = typeof body.model === 'string' ? body.model : modelDefault;
    const upstreamBody = {
      model: requestedModel,
      messages,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
      max_tokens: typeof body.maxTokens === 'number' ? body.maxTokens : 500,
      response_format: body.json ? { type: 'json_object' } : undefined,
      top_p: typeof body.topP === 'number' ? body.topP : undefined,
      frequency_penalty: typeof body.frequencyPenalty === 'number' ? body.frequencyPenalty : undefined,
      presence_penalty: typeof body.presencePenalty === 'number' ? body.presencePenalty : undefined,
    };
    if (/^qwen3\.(?:7|8)-/i.test(requestedModel) && typeof body.enableThinking === 'boolean') {
      upstreamBody.enable_thinking = body.enableThinking;
    }
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const payload = await upstream.json();
    if (!upstream.ok) {
      sendJson(res, upstream.status, { error: 'model_request_failed', detail: payload?.error?.message || 'unknown' });
      return true;
    }
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('empty_model_response');
    sendJson(res, 200, { text, model: payload.model || modelDefault });
  } catch (error) {
    sendJson(res, error?.name === 'AbortError' ? 504 : 500, {
      error: error instanceof Error ? error.message : 'chat_failed',
    });
  }
  return true;
}

function staticCacheHeaders(pathname, extension, info) {
  const hashedAsset = pathname.startsWith('/assets/');
  const cacheControl = hashedAsset
    ? 'public, max-age=31536000, immutable'
    : extension === '.json'
      ? 'public, max-age=3600, must-revalidate'
      : 'no-cache, must-revalidate';
  return {
    'cache-control': cacheControl,
    'etag': `W/"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`,
    'last-modified': info.mtime.toUTCString(),
    'vary': 'Accept-Encoding',
  };
}

function requestCacheIsFresh(req, etag, modifiedAt) {
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch !== undefined) {
    return String(ifNoneMatch).split(',').map((value) => value.trim()).some((value) => value === '*' || value === etag);
  }
  const ifModifiedSince = req.headers['if-modified-since'];
  if (!ifModifiedSince) return false;
  const since = Date.parse(String(ifModifiedSince));
  return Number.isFinite(since) && Math.floor(modifiedAt / 1000) <= Math.floor(since / 1000);
}

async function serveBuilt(req, res, pathname) {
  const dist = resolve(root, 'dist');
  const requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  let target = resolve(dist, requested);
  if (target !== dist && !target.startsWith(`${dist}${sep}`)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    let info = await stat(target);
    if (info.isDirectory()) {
      target = resolve(target, 'index.html');
      info = await stat(target);
    }
    const extension = extname(target);
    const contentType = MIME[extension] || 'application/octet-stream';
    const cacheHeaders = staticCacheHeaders(pathname, extension, info);
    const headers = {
      'content-type': contentType,
      ...cacheHeaders,
    };
    if (requestCacheIsFresh(req, cacheHeaders.etag, info.mtimeMs)) {
      res.writeHead(304, cacheHeaders);
      res.end();
      return;
    }
    const body = await readFile(target);
    const accepts = req.headers['accept-encoding'] || '';
    const compressible = body.length > 1024 && /^(?:text\/|application\/(?:json|javascript))/.test(contentType);
    let output = body;
    if (compressible && accepts.includes('br')) {
      const cacheKey = `br:${target}:${info.mtimeMs}:${info.size}`;
      output = compressedAssetCache.get(cacheKey) || brotliCompressSync(body, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 } });
      compressedAssetCache.set(cacheKey, output);
      headers['content-encoding'] = 'br';
    } else if (compressible && accepts.includes('gzip')) {
      const cacheKey = `gzip:${target}:${info.mtimeMs}:${info.size}`;
      output = compressedAssetCache.get(cacheKey) || gzipSync(body, { level: 6 });
      compressedAssetCache.set(cacheKey, output);
      headers['content-encoding'] = 'gzip';
    }
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : output);
  } catch {
    const fallback = resolve(dist, 'index.html');
    const info = await stat(fallback);
    const cacheHeaders = staticCacheHeaders('/', '.html', info);
    if (requestCacheIsFresh(req, cacheHeaders.etag, info.mtimeMs)) {
      res.writeHead(304, cacheHeaders);
      res.end();
      return;
    }
    const body = await readFile(fallback);
    res.writeHead(200, { 'content-type': MIME['.html'], ...cacheHeaders });
    res.end(req.method === 'HEAD' ? undefined : body);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (await handleApi(req, res, url)) return;
  if (vite) {
    vite.middlewares(req, res, (error) => {
      if (error) {
        vite.ssrFixStacktrace(error);
        res.writeHead(500).end(error.message);
      }
    });
    return;
  }
  await serveBuilt(req, res, url.pathname);
});

server.listen(port, host, () => {
  console.log(`PhiloMate ${isDev ? 'dev' : 'production'}: http://${host}:${port}`);
  console.log(`Model: ${key ? modelDefault : 'offline fallback'}`);
});
