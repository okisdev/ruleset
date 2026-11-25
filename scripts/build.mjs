import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const surge = join(root, 'config', 'Surge');
const check = process.argv.includes('--check');

const categories = new Set([
  'ai',
  'cloud',
  'developer',
  'finance',
  'gaming',
  'lifestyle',
  'music',
  'news',
  'platform',
  'productivity',
  'shopping',
  'social',
  'storage',
  'video',
]);
const ruleTypes = new Set([
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-WILDCARD',
  'IP-CIDR',
  'IP-CIDR6',
  'PROCESS-NAME',
]);
const id = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const domain = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const listPath = /^[A-Za-z0-9]+(\/[A-Za-z0-9]+)*\.list$/;
const ipv4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/([12]?\d|3[0-2])$/;
const ipv6 = /^[0-9a-f:]*:[0-9a-f:]*\/(\d|[1-9]\d|1[01]\d|12[0-8])$/;
const policies = new Set([
  'DIRECT',
  'DIRECT or a proxy policy',
  'a proxy policy',
  'a mainland policy',
  'a reject policy',
  'an AI policy',
  'a streaming policy',
  'a gaming policy',
]);

const errors = [];
const fail = (message) => errors.push(message);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const isText = (value) => typeof value === 'string' && value.trim() !== '' && !/[\r\n|]/.test(value);
const unknownKeys = (object, allowed, where) => {
  if (typeof object !== 'object' || object === null || Array.isArray(object)) return fail(`${where}: must be an object`);
  for (const key of Object.keys(object)) if (!allowed.includes(key)) fail(`${where}: unknown key ${key}`);
};

function checkRule(rule, where) {
  if (typeof rule !== 'string' || /[\r\n]/.test(rule)) return fail(`${where}: ${JSON.stringify(rule)} is not a rule`);
  const [type, value, ...options] = rule.split(',');
  const valid =
    type === 'DOMAIN' || type === 'DOMAIN-SUFFIX'
      ? domain.test(value ?? '') && options.length === 0
      : type === 'DOMAIN-KEYWORD'
        ? /^[a-z0-9.-]+$/.test(value ?? '') && options.length === 0
        : type === 'DOMAIN-WILDCARD'
          ? /^[a-z0-9.*?-]+$/.test(value ?? '') && /[*?]/.test(value) && options.length === 0
          : type === 'IP-CIDR'
            ? ipv4.test(value ?? '') && options.join(',') === 'no-resolve'
            : type === 'IP-CIDR6'
              ? ipv6.test(value ?? '') && options.join(',') === 'no-resolve'
              : type === 'PROCESS-NAME'
                ? (value ?? '').trim() === value && value !== '' && options.length === 0
                : false;
  if (!valid) fail(`${where}: ${rule} is not a valid rule; address rules carry no-resolve`);
}

const lists = readJson(join(root, 'source', 'lists.json'));
const listByPath = new Map();
if (!Array.isArray(lists)) fail('source/lists.json: must be an array');
for (const list of lists) {
  unknownKeys(list, ['path', 'title', 'kind', 'header', 'blocks'], `list ${list?.path}`);
  if (!listPath.test(list.path ?? '')) fail(`${list.path}: a list path is relative, has no dot segments and ends in .list`);
  if (listByPath.has(list.path)) fail(`${list.path}: listed twice`);
  listByPath.set(list.path, { ...list, blocks: [], rules: new Set() });
  if (!isText(list.title)) fail(`${list.path}: title is one line of text`);
  if (list.kind !== 'policy' && list.kind !== 'service') fail(`${list.path}: kind must be policy or service`);
  if (!Array.isArray(list.header) || !list.header.every(isText)) fail(`${list.path}: header is a list of one line paragraphs`);
  const policy = /^Expects (.+?)[.,]/.exec(list.header?.[0] ?? '')?.[1];
  if (policy === undefined || (list.path?.startsWith('Library/') && !policies.has(policy))) fail(`${list.path}: the header opens with a policy kind from the README, found ${policy}`);
}

function normalizeBlocks(value, where) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${where}: rules are required`);
    return [];
  }
  if (value.every((item) => typeof item === 'string')) return [{ rules: value }];
  return value.map((item) => (Array.isArray(item) ? { rules: item } : item));
}

function addBlock(path, block, where, owner) {
  const list = listByPath.get(path);
  if (list === undefined) return fail(`${where}: unknown list ${path}`);
  unknownKeys(block, ['note', 'rules'], `${where} ${path}`);
  if (block.note !== undefined && !isText(block.note)) fail(`${where} ${path}: a note is one line of text`);
  if (!Array.isArray(block.rules) || block.rules.length === 0) return fail(`${where} ${path}: a block needs rules`);
  for (const rule of block.rules) {
    checkRule(rule, `${where} ${path}`);
    if (list.rules.has(rule)) fail(`${where}: ${rule} appears twice in ${path}`);
    list.rules.add(rule);
  }
  list.blocks.push({ ...block, owner });
}

for (const list of lists) {
  if (list.blocks !== undefined && !Array.isArray(list.blocks)) fail(`${list.path}: blocks must be an array`);
  for (const block of list.blocks ?? []) addBlock(list.path, block, list.path, undefined);
}

const owners = [];
const services = [];
const serviceNames = new Map();
const domainOwner = new Map();
const serviceIds = new Set();
const entries = readdirSync(join(root, 'source', 'services'), { withFileTypes: true });
for (const entry of entries)
  if (!entry.isFile() || !entry.name.endsWith('.json')) fail(`source/services/${entry.name}: only .json files belong here`);
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .sort();
for (const file of files) {
  const group = readJson(join(root, 'source', 'services', file));
  unknownKeys(group, ['owner', 'services'], file);
  if (!Array.isArray(group.services) || group.services.length === 0) {
    fail(`${file}: services must be a non empty array`);
    continue;
  }
  const owner = group.owner;
  if (owner !== undefined) {
    unknownKeys(owner, ['id', 'name', 'zh'], `${file} owner`);
    if (!id.test(owner.id ?? '') || !isText(owner.name)) fail(`${file}: owner needs an id and a name`);
    if (owner.zh !== undefined && !isText(owner.zh)) fail(`${file}: owner zh is one line of text`);
    if (`${owner.id}.json` !== file) fail(`${file}: an owner's file is named after its id`);
    if (group.services.length < 2) fail(`${file}: an owner groups two or more services`);
    owners.push({ id: owner.id, name: owner.name, ...(owner.zh ? { zh: owner.zh } : {}) });
  }
  for (const service of group.services) {
    const where = `service ${service?.id}`;
    unknownKeys(service, ['id', 'name', 'zh', 'category', 'lists', 'names'], where);
    if (!id.test(service.id ?? '')) fail(`${file}: ${service.id} is not a lowercase kebab case id`);
    if (serviceIds.has(service.id)) fail(`${where}: duplicate id`);
    serviceIds.add(service.id);
    if (!isText(service.name)) fail(`${where}: name is one line of text`);
    if (service.zh !== undefined && !isText(service.zh)) fail(`${where}: zh is one line of text`);
    serviceNames.set(service.id, service.name);
    if (!categories.has(service.category)) fail(`${where}: unknown category ${service.category}`);
    if (owner === undefined && `${service.category}.json` !== file)
      fail(`${where}: a service without an owner lives in ${service.category}.json`);
    if (service.names !== undefined && !Array.isArray(service.names)) fail(`${where}: names must be an array`);
    const names = new Set(Array.isArray(service.names) ? service.names : []);
    for (const [path, value] of Object.entries(service.lists ?? {})) {
      if (listByPath.get(path)?.kind === 'policy') fail(`${where}: ${path} is a policy list and owns its rules`);
      for (const block of normalizeBlocks(value, `${where} ${path}`)) {
        addBlock(path, block, where, service.id);
        for (const rule of Array.isArray(block.rules) ? block.rules : []) {
          const [type, value] = String(rule).split(',');
          if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') names.add(value);
        }
      }
    }
    if (names.size === 0) fail(`${where}: no domain identifies it`);
    for (const name of names) {
      if (typeof name !== 'string' || !domain.test(name)) fail(`${where}: ${name} is not a lowercase domain`);
      const previous = domainOwner.get(name);
      if (previous !== undefined && previous !== service.id) fail(`${where}: ${name} already belongs to ${previous}`);
      domainOwner.set(name, service.id);
    }
    services.push({
      id: service.id,
      name: service.name,
      ...(service.zh ? { zh: service.zh } : {}),
      ...(owner ? { owner: owner.id } : {}),
      category: service.category,
      domains: [...names].sort(),
    });
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

function classify(host) {
  const labels = host.split('.');
  for (let index = 0; index < labels.length; index += 1) {
    if (domainOwner.has(labels.slice(index).join('.'))) return true;
  }
  return false;
}

const outputs = new Map();
for (const list of listByPath.values()) {
  if (list.blocks.length === 0) fail(`${list.path}: no rules`);
  const header = [`# Ruleset: ${list.title}`, ...list.header.flatMap((paragraph) => ['#', `# ${paragraph}`])];
  const owned = list.blocks.filter((b) => b.owner);
  const named = new Set(owned.map((b) => b.owner)).size > 1;
  const blocks = [...owned, ...list.blocks.filter((b) => !b.owner)].map((block) => {
    let comment = block.note;
    if (named && block.owner) {
      const name = serviceNames.get(block.owner);
      comment = comment ? `${name}. ${comment}` : name;
    }
    return [...(comment ? [`# ${comment}`] : []), ...block.rules].join('\n');
  });
  outputs.set(join(surge, list.path), `${header.join('\n')}\n\n${blocks.join('\n\n')}\n`);
}

const library = [...listByPath.values()].filter((list) => list.path.startsWith('Library/'));
const sections = new Map();
for (const list of library) {
  const section = list.path.split('/')[1];
  sections.set(section, [...(sections.get(section) ?? []), list]);
}
const index = [
  '# Library index',
  '',
  `${library.length} first-party rule sets. The expected policy is a kind, defined in [\`../README.md\`](../README.md#policies); the profile binds it to a group of its own.`,
];
for (const [section, entries] of sections) {
  index.push('', `### ${section}`, '', '| File | Title | Expected policy | Rules |', '| --- | --- | --- | ---: |');
  for (const list of entries) {
    const file = list.path.slice('Library/'.length);
    const policy = /^Expects (.+?)[.,]/.exec(list.header[0])[1];
    index.push(`| [\`${file}\`](${file}) | ${list.title} | ${policy} | ${list.rules.size} |`);
  }
}
outputs.set(join(surge, 'Library', 'INDEX.md'), `${index.join('\n')}\n`);
outputs.set(join(root, 'catalog', 'services.json'), `${JSON.stringify({ owners, services }, null, 2)}\n`);

const unclassified = [];
for (const list of listByPath.values()) {
  if (list.kind !== 'service') continue;
  for (const block of list.blocks.filter((b) => !b.owner)) {
    for (const rule of block.rules) {
      const [type, value] = rule.split(',');
      if ((type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') && !classify(value)) unclassified.push(`${list.path}: ${value}`);
    }
  }
}

const matches = (rule, host) => {
  const [type, value] = rule.split(',');
  if (type === 'DOMAIN') return host === value;
  if (type === 'DOMAIN-SUFFIX') return host === value || host.endsWith(`.${value}`);
  if (type === 'DOMAIN-KEYWORD') return host.includes(value);
  if (type === 'DOMAIN-WILDCARD') {
    const pattern = value.replace(/[.]/g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`).test(host);
  }
  return false;
};
const protectedHosts = readJson(join(root, 'source', 'protected.json'));
if (!Array.isArray(protectedHosts)) fail('source/protected.json: must be an array');
for (const [index, entry] of (Array.isArray(protectedHosts) ? protectedHosts : []).entries()) {
  const where = `source/protected.json[${index}]`;
  unknownKeys(entry, ['host', 'list', 'reason'], where);
  if (!domain.test(entry?.host ?? '')) fail(`${where}: host must be a domain`);
  if (!isText(entry?.reason)) fail(`${where}: reason is required`);
  for (const list of listByPath.values()) {
    if (!list.path.startsWith('Library/Reject/')) continue;
    const rule = [...list.rules].find((candidate) => matches(candidate, entry?.host ?? ''));
    if (rule) fail(`${where}: ${entry.host} is protected but ${list.path} rejects it with ${rule}`);
  }
  if (entry?.list !== undefined) {
    const list = listByPath.get(entry.list);
    if (list === undefined) fail(`${where}: ${entry.list} is not a list`);
    else if (![...list.rules].some((rule) => matches(rule, entry.host))) fail(`${where}: ${entry.list} does not match ${entry.host}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const onDisk = (path) => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
};
const generated = new Set(outputs.keys());
const strays = readdirSync(surge, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .filter((path) => !generated.has(path) && !(path.endsWith('.md') && !path.endsWith('INDEX.md')));
const stale = [...outputs].filter(([path, content]) => onDisk(path) !== content).map(([path]) => path);

if (check) {
  for (const path of [...stale, ...strays]) console.error(`out of date: ${path.slice(root.length + 1)}`);
  if (stale.length + strays.length > 0) {
    console.error('Run node scripts/build.mjs and commit the result.');
    process.exit(1);
  }
} else {
  for (const path of strays) console.error(`not generated from source, remove it: ${path.slice(root.length + 1)}`);
  for (const path of stale) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, outputs.get(path));
  }
  if (strays.length > 0) process.exitCode = 1;
}
if (unclassified.length > 0) {
  console.log(`Names in service lists that no service claims (${unclassified.length}):`);
  for (const name of unclassified) console.log(`  ${name}`);
}
console.log(`${lists.length} lists, ${services.length} services, ${owners.length} owners, ${domainOwner.size} domains.`);
