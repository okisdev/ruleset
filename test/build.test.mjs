import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createHostMatcher } from '../src/matcher.mjs';
import { targetRule } from '../src/rules.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = mkdtempSync(join(tmpdir(), 'ruleset-'));
const dist = join(fixture, 'dist');
const source = join(fixture, 'source');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

before(() => {
  for (const dir of ['source', 'scripts', 'src']) cpSync(join(root, dir), join(fixture, dir), { recursive: true });
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture });
});
after(() => rmSync(fixture, { recursive: true, force: true }));

function sourceLists() {
  const definitions = json(join(source, 'lists.json'));
  const rules = new Map(definitions.map(({ path }) => [path, []]));
  for (const file of readdirSync(join(source, 'services')).sort()) {
    for (const service of json(join(source, 'services', file)).services) {
      for (const [path, blocks] of Object.entries(service.lists ?? {})) {
        rules.get(path).push(...blocks.flatMap((block) => block.rules ?? block));
      }
    }
  }
  return definitions.map(({ path, blocks = [] }) => ({
    path,
    rules: [...rules.get(path), ...blocks.flatMap((block) => block.rules)],
  }));
}

function parseLists(target) {
  return json(join(dist, 'manifest.json')).lists.map((entry) => {
    let rules = readFileSync(join(dist, entry[target]), 'utf8').split('\n')
      .filter((line) => line !== '' && !line.startsWith('#'));
    if (target === 'mihomo') {
      assert.equal(rules.shift(), 'payload:', entry.path);
      rules = rules.map((line) => {
        assert.match(line, /^  - "/, entry.path);
        return JSON.parse(line.slice(4));
      });
    }
    return { path: entry.path, rules };
  });
}

test('manifest contains each list in source order with both target paths', () => {
  const manifest = json(join(dist, 'manifest.json'));
  const expected = json(join(source, 'lists.json')).map(({ path, title, policy, sni = false }) => ({
    path, title, policy, sni, surge: 'surge/' + path, mihomo: 'mihomo/' + path.slice(0, -5) + '.yaml',
  }));
  assert.deepEqual(manifest, { lists: expected });
  assert.deepEqual(readFileSync(join(source, 'protected.json')), readFileSync(join(dist, 'protected.json')));
});

for (const target of ['surge', 'mihomo']) {
  test(`${target} round-trips every source rule in order`, () => {
    assert.deepEqual(parseLists(target), sourceLists());
  });
}

test('both targets select the source list for every protected host and catalog domain', () => {
  const hosts = new Set(json(join(dist, 'protected.json')).map(({ host }) => host));
  for (const service of json(join(dist, 'catalog/services.json')).services) {
    for (const domain of service.domains) hosts.add(domain);
  }
  const sourceMatch = createHostMatcher(sourceLists());
  const surgeMatch = createHostMatcher(parseLists('surge'));
  const mihomoMatch = createHostMatcher(parseLists('mihomo'));
  for (const host of hosts) {
    const path = sourceMatch(host)?.path;
    assert.equal(surgeMatch(host)?.path, path, host);
    assert.equal(mihomoMatch(host)?.path, path, host);
  }
});

test('reference matcher respects profile order, label boundaries and domain patterns', () => {
  const match = createHostMatcher([
    { path: 'exact', rules: ['DOMAIN,api.example.org'] },
    { path: 'wildcard', rules: ['DOMAIN-WILDCARD,cdn-?*.example.org'] },
    { path: 'suffix', rules: ['DOMAIN-SUFFIX,example.org'] },
    { path: 'keyword', rules: ['DOMAIN-KEYWORD,cdn'] },
  ]);
  assert.equal(match('api.example.org').path, 'exact');
  assert.equal(match('cdn-a1.example.org').path, 'wildcard');
  assert.equal(match('cdn-.example.org').path, 'suffix');
  assert.equal(match('example.org').path, 'suffix');
  assert.equal(match('cdn.test').path, 'keyword');
  assert.equal(match('myexample.org'), undefined);
});

test('an unsupported rule type or target has no silent fallback', () => {
  assert.throws(() => targetRule('mihomo', 'UNKNOWN,example.org'), /no mapping for UNKNOWN/);
  assert.throws(() => targetRule('other', 'DOMAIN,example.org'), /no mapping for DOMAIN/);
});
