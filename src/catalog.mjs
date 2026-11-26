import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { domain } from './rules.mjs';
import { isText } from './validation.mjs';

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
const id = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function normalizeBlocks(value, where, fail) {
  if (!Array.isArray(value) || value.length === 0) {
    fail(`${where}: rules are required`);
    return [];
  }
  if (value.every((item) => typeof item === 'string')) return [{ rules: value }];
  return value.map((item) => (Array.isArray(item) ? { rules: item } : item));
}

export function loadCatalog(directory, { fail, keys }, addBlock) {
  const owners = [];
  const services = [];
  const domainOwner = new Map();
  const serviceIds = new Set();
  const entries = readdirSync(directory, { withFileTypes: true });
  for (const entry of entries)
    if (!entry.isFile() || !entry.name.endsWith('.json')) fail(`source/services/${entry.name}: only .json files belong here`);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  for (const file of files) {
    const group = JSON.parse(readFileSync(join(directory, file), 'utf8'));
    if (!keys(group, ['owner', 'services'], file)) continue;
    if (!Array.isArray(group.services) || group.services.length === 0) {
      fail(`${file}: services must be a non empty array`);
      continue;
    }
    const owner = group.owner;
    if (owner !== undefined) {
      if (!keys(owner, ['id', 'name', 'zh'], `${file} owner`)) continue;
      if (!id.test(owner.id ?? '') || !isText(owner.name)) fail(`${file}: owner needs an id and a name`);
      if (owner.zh !== undefined && !isText(owner.zh)) fail(`${file}: owner zh is one line of text`);
      if (`${owner.id}.json` !== file) fail(`${file}: an owner's file is named after its id`);
      if (group.services.length < 2) fail(`${file}: an owner groups two or more services`);
      owners.push({ id: owner.id, name: owner.name, ...(owner.zh ? { zh: owner.zh } : {}) });
    }
    for (const service of group.services) {
      const where = `service ${service?.id}`;
      if (!keys(service, ['id', 'name', 'zh', 'category', 'lists', 'names'], where)) continue;
      if (!id.test(service.id ?? '')) fail(`${file}: ${service.id} is not a lowercase kebab case id`);
      if (serviceIds.has(service.id)) fail(`${where}: duplicate id`);
      serviceIds.add(service.id);
      if (!isText(service.name)) fail(`${where}: name is one line of text`);
      if (service.zh !== undefined && !isText(service.zh)) fail(`${where}: zh is one line of text`);
      if (!categories.has(service.category)) fail(`${where}: unknown category ${service.category}`);
      if (owner === undefined && `${service.category}.json` !== file)
        fail(`${where}: a service without an owner lives in ${service.category}.json`);
      if (service.names !== undefined && !Array.isArray(service.names)) fail(`${where}: names must be an array`);
      const names = new Set(Array.isArray(service.names) ? service.names : []);
      for (const [path, value] of Object.entries(service.lists ?? {})) {
        for (const block of normalizeBlocks(value, `${where} ${path}`, fail)) {
          addBlock(path, block, where, service.id);
          for (const rule of Array.isArray(block?.rules) ? block.rules : []) {
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
  return { catalog: { owners, services }, domainOwner };
}

export function unclaimedNames(lists, domainOwner) {
  const unclaimed = [];
  for (const list of lists) {
    if (list.kind !== 'service') continue;
    for (const block of list.blocks) {
      if (block.owner) continue;
      for (const rule of block.rules) {
        const [type, name] = rule.split(',');
        if (type !== 'DOMAIN' && type !== 'DOMAIN-SUFFIX') continue;
        const labels = name.split('.');
        if (!labels.some((_, index) => domainOwner.has(labels.slice(index).join('.')))) {
          unclaimed.push(`${list.path}: ${name}`);
        }
      }
    }
  }
  return unclaimed;
}
