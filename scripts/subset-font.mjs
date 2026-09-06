import { readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import subsetFont from 'subset-font';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'src/ui/assets/fonts/SourceHanSerifSC.ttf');
const output = resolve(root, 'src/ui/assets/fonts/SourceHanSerifPM.woff2');
async function textSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return textSources(path);
    return ['.ts', '.json', '.css', '.html'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

const uiSources = await textSources(resolve(root, 'src'));
const content = (await Promise.all(uiSources.map((path) => readFile(path, 'utf8')))).join('\n');
const chinese = content.match(/[\u3400-\u9fff\uf900-\ufaff]/g) ?? [];
const punctuation = '。，、；：！？“”‘’（）【】《》—…·→×';
const latin = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 +-/%:,.!?()[]#&;'\"";
const characters = [...new Set([...chinese, ...punctuation, ...latin])].join('');
const font = await subsetFont(await readFile(source), characters, { targetFormat: 'woff2' });
await writeFile(output, font);
console.log(`Created ${output} with ${[...characters].length} glyph inputs (${font.length} bytes).`);
