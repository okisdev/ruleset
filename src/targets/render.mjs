import { targetRule } from '../rules.mjs';

export function renderList(list, target, formatRule, preamble = '') {
  const header = [`# Ruleset: ${list.title}`, ...list.header.flatMap((paragraph) => ['#', `# ${paragraph}`])];
  const blocks = list.blocks.map(({ note, rules }) => {
    const lines = rules.map((rule) => formatRule(targetRule(target, rule)));
    if (note) lines.unshift(`# ${note}`);
    return lines.join('\n');
  });
  return `${header.join('\n')}\n\n${preamble}${blocks.join('\n\n')}\n`;
}
