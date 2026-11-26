export const domain = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const ipv4 = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/([12]?\d|3[0-2])$/;
const ipv6 = /^[0-9a-f:]*:[0-9a-f:]*\/(\d|[1-9]\d|1[01]\d|12[0-8])$/;

const types = new Map([
  ['DOMAIN', { surge: 'DOMAIN', mihomo: 'DOMAIN', value: domain }],
  ['DOMAIN-SUFFIX', { surge: 'DOMAIN-SUFFIX', mihomo: 'DOMAIN-SUFFIX', value: domain }],
  ['DOMAIN-KEYWORD', { surge: 'DOMAIN-KEYWORD', mihomo: 'DOMAIN-KEYWORD', value: /^[a-z0-9.-]+$/ }],
  ['DOMAIN-WILDCARD', { surge: 'DOMAIN-WILDCARD', mihomo: 'DOMAIN-WILDCARD', value: /^(?=.*[*?])[a-z0-9.*?-]+$/ }],
  ['IP-CIDR', { surge: 'IP-CIDR', mihomo: 'IP-CIDR', value: ipv4, option: 'no-resolve' }],
  ['IP-CIDR6', { surge: 'IP-CIDR6', mihomo: 'IP-CIDR6', value: ipv6, option: 'no-resolve' }],
  ['PROCESS-NAME', { surge: 'PROCESS-NAME', mihomo: 'PROCESS-NAME', value: /^\S(?:[\s\S]*\S)?$/ }],
]);

export function validRule(rule) {
  if (typeof rule !== 'string' || /[\r\n]/.test(rule)) return false;
  const [type, value, option, ...extra] = rule.split(',');
  const spec = types.get(type);
  return spec !== undefined && value !== undefined && spec.value.test(value) && option === spec.option && extra.length === 0;
}

export function targetRule(target, rule) {
  const comma = rule.indexOf(',');
  const type = rule.slice(0, comma);
  const mapped = types.get(type)?.[target];
  if (typeof mapped !== 'string') throw new Error(`${target} has no mapping for ${type}`);
  return mapped + rule.slice(comma);
}
