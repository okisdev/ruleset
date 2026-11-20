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

const errors = [];
const fail = (message) => errors.push(message);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

const lists = readJson(join(root, 'source', 'lists.json'));
const listByPath = new Map();
for (const list of lists) {
  if (listByPath.has(list.path)) fail(`${list.path}: listed twice`);
  listByPath.set(list.path, { ...list, blocks: [], rules: new Set() });
  if (!list.title) fail(`${list.path}: title is required`);
  if (list.kind !== 'policy' && list.kind !== 'service') fail(`${list.path}: kind must be policy or service`);
  if (!/^Expects .+?[.,]/.test(list.header?.[0] ?? '')) fail(`${list.path}: the header opens with the policy it expects`);
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
  for (const rule of block.rules) {
    const [type, value] = rule.split(',');
    if (!ruleTypes.has(type) || !value) fail(`${where}: ${rule} is not a rule`);
    if (list.rules.has(rule)) fail(`${where}: ${rule} appears twice in ${path}`);
    list.rules.add(rule);
  }
  list.blocks.push({ ...block, owner });
}

for (const list of lists) {
  for (const block of list.blocks ?? []) addBlock(list.path, block, list.path, undefined);
}

const owners = [];
const services = [];
const serviceNames = new Map();
const domainOwner = new Map();
const serviceIds = new Set();
const files = readdirSync(join(root, 'source', 'services'))
  .filter((name) => name.endsWith('.json'))
  .sort();
for (const file of files) {
  const group = readJson(join(root, 'source', 'services', file));
  const owner = group.owner;
  if (owner !== undefined) {
    if (!id.test(owner.id) || !owner.name) fail(`${file}: owner needs an id and a name`);
    if (`${owner.id}.json` !== file) fail(`${file}: an owner's file is named after its id`);
    if ((group.services ?? []).length < 2) fail(`${file}: an owner groups two or more services`);
    owners.push({ id: owner.id, name: owner.name, ...(owner.zh ? { zh: owner.zh } : {}) });
  }
  for (const service of group.services ?? []) {
    const where = `service ${service.id}`;
    if (!id.test(service.id ?? '')) fail(`${file}: ${service.id} is not a lowercase kebab case id`);
    if (serviceIds.has(service.id)) fail(`${where}: duplicate id`);
    serviceIds.add(service.id);
    if (!service.name) fail(`${where}: name is required`);
    serviceNames.set(service.id, service.name);
    if (!categories.has(service.category)) fail(`${where}: unknown category ${service.category}`);
    if (owner === undefined && `${service.category}.json` !== file)
      fail(`${where}: a service without an owner lives in ${service.category}.json`);
    const names = new Set(service.names ?? []);
    for (const [path, value] of Object.entries(service.lists ?? {})) {
      if (listByPath.get(path)?.kind === 'policy') fail(`${where}: ${path} is a policy list and owns its rules`);
      for (const block of normalizeBlocks(value, `${where} ${path}`)) {
        addBlock(path, block, where, service.id);
        for (const rule of block.rules) {
          const [type, value] = rule.split(',');
          if (type === 'DOMAIN' || type === 'DOMAIN-SUFFIX') names.add(value);
        }
      }
    }
    if (names.size === 0) fail(`${where}: no domain identifies it`);
    for (const name of names) {
      if (!domain.test(name)) fail(`${where}: ${name} is not a lowercase domain`);
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
      domains: [...names],
    });
  }
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
  const headed = new Set();
  const blocks = [...owned, ...list.blocks.filter((b) => !b.owner)].map((block) => {
    let comment = block.note;
    if (named && block.owner && !headed.has(block.owner)) {
      headed.add(block.owner);
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
const strays = readdirSync(surge, { recursive: true })
  .filter((path) => path.endsWith('.list'))
  .map((path) => join(surge, path))
  .filter((path) => !generated.has(path));
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
}
if (unclassified.length > 0) {
  console.log(`Names in service lists that no service claims (${unclassified.length}):`);
  for (const name of unclassified) console.log(`  ${name}`);
}
console.log(`${lists.length} lists, ${services.length} services, ${owners.length} owners, ${domainOwner.size} domains.`);
