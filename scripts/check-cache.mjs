const baseUrl = (process.env.PHILOMATE_TEST_URL || 'http://127.0.0.1:5199').replace(/\/$/, '');
const page = await fetch(`${baseUrl}/`);
if (!page.ok) throw new Error(`Homepage returned ${page.status}`);
const html = await page.text();
const assetPath = html.match(/src="([^"]+\.js)"/)?.[1];
if (!assetPath) throw new Error('Built JavaScript asset not found');

const first = await fetch(`${baseUrl}${assetPath}`);
const etag = first.headers.get('etag');
if (!first.ok || !etag) throw new Error('Initial asset response is missing an ETag');
const javascript = await first.text();
const second = await fetch(`${baseUrl}${assetPath}`, { headers: { 'if-none-match': etag } });
const imagePath = javascript.match(/\/assets\/[A-Za-z0-9_.-]+\.webp/)?.[0];
if (!imagePath) throw new Error('Built image asset not found');
const image = await fetch(`${baseUrl}${imagePath}`);
const imageEtag = image.headers.get('etag');
if (!image.ok || !imageEtag) throw new Error('Initial image response is missing an ETag');
await image.arrayBuffer();
const imageSecond = await fetch(`${baseUrl}${imagePath}`, { headers: { 'if-none-match': imageEtag } });
const pageEtag = page.headers.get('etag');
const pageSecond = await fetch(`${baseUrl}/`, { headers: { 'if-none-match': pageEtag ?? '' } });
const result = {
  assetPath,
  initialStatus: first.status,
  cacheControl: first.headers.get('cache-control'),
  etag,
  repeatStatus: second.status,
  repeatBytes: (await second.arrayBuffer()).byteLength,
  imagePath,
  imageCacheControl: image.headers.get('cache-control'),
  imageRepeatStatus: imageSecond.status,
  imageRepeatBytes: (await imageSecond.arrayBuffer()).byteLength,
  pageCacheControl: page.headers.get('cache-control'),
  pageRepeatStatus: pageSecond.status,
};
console.log(JSON.stringify(result, null, 2));
if (
  second.status !== 304
  || result.repeatBytes !== 0
  || imageSecond.status !== 304
  || result.imageRepeatBytes !== 0
  || pageSecond.status !== 304
) process.exitCode = 1;
