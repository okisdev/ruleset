import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCatalog, unclaimedNames } from './catalog.mjs';
import { createHostMatcher } from './matcher.mjs';
import { domain, validRule } from './rules.mjs';
import { isText, validation } from './validation.mjs';

const listPath = /^[A-Za-z0-9]+(\/[A-Za-z0-9]+)*\.list$/;
const policies = new Map([
  ['direct', 'DIRECT'],
  ['direct-or-proxy', 'DIRECT or a proxy policy'],
  ['proxy', 'a proxy policy'],
  ['mainland', 'a mainland policy'],
  ['reject', 'a reject policy'],
  ['ai', 'an AI policy'],
  ['streaming', 'a streaming policy'],
  ['gaming', 'a gaming policy'],
]);

function checkProtected(entries, lists, { fail, keys }) {
  if (!Array.isArray(entries)) return fail('source/protected.json: must be an array');
  const matchers = new Map(lists.map((list) => [list.path, createHostMatcher([list])]));
  for (const [index, entry] of entries.entries()) {
    const where = `source/protected.json[${index}]`;
    if (!keys(entry, ['host', 'list', 'reason'], where)) continue;
    if (!isText(entry.reason)) fail(`${where}: reason is required`);
    if (typeof entry.host !== 'string' || !domain.test(entry.host)) {
      fail(`${where}: host must be a domain`);
      continue;
    }
    for (const [path, match] of matchers) {
      if (!path.startsWith('Library/Reject/')) continue;
      const hit = match(entry.host);
      if (hit) fail(`${where}: ${entry.host} is protected but ${path} rejects it with ${hit.rule}`);
    }
    if (entry.list !== undefined) {
      if (!matchers.has(entry.list)) fail(`${where}: ${entry.list} is not a list`);
      else if (!matchers.get(entry.list)(entry.host)) fail(`${where}: ${entry.list} does not match ${entry.host}`);
    }
  }
}

export function loadSource(directory) {
  const checks = validation();
  const { fail, keys } = checks;
  const definitions = JSON.parse(readFileSync(join(directory, 'lists.json'), 'utf8'));
  if (!Array.isArray(definitions)) throw new Error('source/lists.json: must be an array');
  const listByPath = new Map();

  function addBlock(path, block, where, owner) {
    const list = listByPath.get(path);
    if (!list) return fail(`${where}: unknown list ${path}`);
    if (owner !== undefined && list.kind === 'policy') fail(`${where}: ${path} is a policy list and owns its rules`);
    if (!keys(block, ['note', 'rules'], `${where} ${path}`)) return;
    if (block.note !== undefined && !isText(block.note)) fail(`${where} ${path}: a note is one line of text`);
    if (!Array.isArray(block.rules) || !block.rules.length) return fail(`${where} ${path}: a block needs rules`);
    for (const rule of block.rules) {
      if (!validRule(rule)) fail(`${where} ${path}: ${rule} is not a valid rule; address rules carry no-resolve`);
      if (list.rules.has(rule)) fail(`${where}: ${rule} appears twice in ${path}`);
      list.rules.add(rule);
    }
    list.blocks.push({ ...block, owner });
  }

  for (const definition of definitions) {
    if (!keys(definition, ['path', 'title', 'kind', 'policy', 'sni', 'policySuffix', 'intro', 'header', 'blocks'], `list ${definition?.path}`)) continue;
    const { path, title, kind, policy, sni = false, policySuffix = '', intro, header, blocks = [] } = definition;
    if (typeof path !== 'string' || !listPath.test(path)) fail(`${path}: a list path is relative, has no dot segments and ends in .list`);
    if (listByPath.has(path)) fail(`${path}: listed twice`);
    if (!isText(title)) fail(`${path}: title is one line of text`);
    if (kind !== 'policy' && kind !== 'service') fail(`${path}: kind must be policy or service`);
    if (!policies.has(policy)) fail(`${path}: unknown policy ${policy}`);
    if (typeof sni !== 'boolean') fail(`${path}: sni must be a boolean`);
    if (definition.policySuffix !== undefined && !(isText(policySuffix) && /^(, | )\S/.test(policySuffix))) {
      fail(`${path}: policySuffix must continue the policy phrase`);
    }
    if (intro !== undefined && !isText(intro)) fail(`${path}: intro is one line of text`);
    if (!Array.isArray(header) || !header.every(isText)) {
      fail(`${path}: header is a list of one line paragraphs`);
      continue;
    }
    const opening = `Expects ${policies.get(policy)}${policySuffix}.`;
    listByPath.set(path, {
      path, title, kind, policy, sni,
      header: [intro ? `${opening} ${intro}` : opening, ...header],
      blocks: [],
      rules: new Set(),
    });
    if (!Array.isArray(blocks)) fail(`${path}: blocks must be an array`);
    else for (const block of blocks) addBlock(path, block, path);
  }

  const { catalog, domainOwner } = loadCatalog(join(directory, 'services'), checks, addBlock);
  checks.finish();
  const lists = [...listByPath.values()];
  const protectedText = readFileSync(join(directory, 'protected.json'), 'utf8');
  checkProtected(JSON.parse(protectedText), lists, checks);
  const unclassified = unclaimedNames(lists, domainOwner);
  const serviceNames = new Map(catalog.services.map((service) => [service.id, service.name]));
  for (const list of lists) {
    if (!list.blocks.length) fail(`${list.path}: no rules`);
    const owned = list.blocks.filter((block) => block.owner);
    const named = new Set(owned.map((block) => block.owner)).size > 1;
    list.blocks = [...owned, ...list.blocks.filter((block) => !block.owner)].map(({ owner, note, rules }) => {
      if (named && owner) {
        const name = serviceNames.get(owner);
        note = note ? `${name}. ${note}` : name;
      }
      return { note, rules };
    });
  }
  checks.finish();
  return { lists, catalog, protectedText, unclassified, domainCount: domainOwner.size };
}
