import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSource } from '../src/load.mjs';
import { buildArtifacts } from '../src/manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');

function build(check) {
  const source = loadSource(join(root, 'source'));
  const files = buildArtifacts(source);
  const entries = existsSync(dist) ? readdirSync(dist, { recursive: true, withFileTypes: true }) : [];
  const strays = entries.filter((entry) => !entry.isDirectory())
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((path) => !files.has(path));
  if (check) {
    const stale = [...files.keys()].filter((path) => {
      const file = join(dist, path);
      return !existsSync(file) || readFileSync(file, 'utf8') !== files.get(path);
    });
    for (const path of [...stale, ...strays]) console.error(`out of date: dist/${path}`);
    if (stale.length + strays.length) throw new Error('Rebuild dist/ with node scripts/build.mjs.');
  } else {
    if (strays.length) throw new Error(strays.map((path) => `not generated from source, remove it: dist/${path}`).join('\n'));
    for (const [path, content] of files) {
      const file = join(dist, path);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  if (source.unclassified.length) {
    console.log(`Names in service lists that no service claims (${source.unclassified.length}):`);
    for (const name of source.unclassified) console.log(`  ${name}`);
  }
  const { owners, services } = source.catalog;
  console.log(`${source.lists.length} lists, ${services.length} services, ${owners.length} owners, ${source.domainCount} domains.`);
}

try {
  build(process.argv.includes('--check'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
