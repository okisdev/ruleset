import { renderList } from './render.mjs';

export const mihomo = {
  path: (list) => `mihomo/${list.path.replace(/\.list$/, '.yaml')}`,
  render: (list) => renderList(list, 'mihomo', (rule) => `  - ${JSON.stringify(rule)}`, 'payload:\n'),
};
