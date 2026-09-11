// Ad-hoc dead i18n key detector for studio-copy.ts.
// Reports keys defined in the English copy block that no source file
// references, accounting for template-literal key prefixes (t(`a.b.${x}`)).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const copySrc = readFileSync('src/shell/renderer/i18n/studio-copy.ts', 'utf8');
const enBlock = copySrc.slice(0, copySrc.indexOf('export type StudioCopyKey'));
const allKeys = [...enBlock.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]);

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name) && !p.endsWith('i18n/studio-copy.ts')) files.push(p);
  }
})('src');
const usedSrc = files.map((f) => readFileSync(f, 'utf8')).join('\n');

const dynamicPrefixes = [...usedSrc.matchAll(/`([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*\.)\$\{/g)]
  .map((m) => m[1])
  .filter((prefix, index, list) => list.indexOf(prefix) === index)
  .sort();
console.log('dynamic prefixes:', JSON.stringify(dynamicPrefixes));

const dead = allKeys.filter((key) => !usedSrc.includes(`'${key}'`) && !dynamicPrefixes.some((p) => key.startsWith(p)));
console.log(`total: ${allKeys.length} dead: ${dead.length}`);
console.log(dead.join('\n'));
