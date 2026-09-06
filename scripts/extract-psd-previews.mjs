import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

function uint16(buffer, offset) {
  return buffer.readUInt16BE(offset);
}

function uint32(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function imageResourcesOffset(buffer) {
  let offset = 26;
  offset += 4 + uint32(buffer, offset);
  return offset + 4;
}

function extractThumbnail(buffer) {
  let offset = imageResourcesOffset(buffer);
  const resourceEnd = offset + uint32(buffer, offset - 4);
  while (offset + 12 <= resourceEnd) {
    if (buffer.toString('ascii', offset, offset + 4) !== '8BIM') break;
    const id = uint16(buffer, offset + 4);
    const nameLength = buffer[offset + 6] ?? 0;
    offset += 7 + nameLength;
    if (offset % 2 !== 0) offset += 1;
    const size = uint32(buffer, offset);
    offset += 4;
    if ((id === 1033 || id === 1036) && size > 28 && uint32(buffer, offset) === 1) {
      return buffer.subarray(offset + 28, offset + size);
    }
    offset += size + (size % 2);
  }
  return null;
}

const outputDir = resolve(process.argv[2] || '.ui-audit');
const files = process.argv.slice(3);
if (!files.length) throw new Error('Usage: node scripts/extract-psd-previews.mjs OUTPUT_DIR FILE...');
await mkdir(outputDir, { recursive: true });

for (const file of files) {
  const source = resolve(file);
  const thumbnail = extractThumbnail(await readFile(source));
  if (!thumbnail) {
    console.warn(`No embedded thumbnail: ${source}`);
    continue;
  }
  const target = join(outputDir, `${basename(source, '.psd')}.jpg`);
  await writeFile(target, thumbnail);
  console.log(target);
}
