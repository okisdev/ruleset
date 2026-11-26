function hostPredicate(rule) {
  const [type, value] = rule.split(',');
  if (type === 'DOMAIN') return (host) => host === value;
  if (type === 'DOMAIN-SUFFIX') return (host) => host === value || host.endsWith(`.${value}`);
  if (type === 'DOMAIN-KEYWORD') return (host) => host.includes(value);
  if (type === 'DOMAIN-WILDCARD') {
    const pattern = value.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${pattern}$`);
    return (host) => regex.test(host);
  }
}

export function createHostMatcher(lists) {
  const rules = [];
  for (const list of lists) {
    for (const rule of list.rules) {
      const matches = hostPredicate(rule);
      if (matches) rules.push({ matches, path: list.path, rule });
    }
  }
  return (host) => rules.find((entry) => entry.matches(host));
}
