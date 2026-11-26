import { renderList } from './render.mjs';

export const surge = {
  path: (list) => `surge/${list.path}`,
  render: (list) => renderList(list, 'surge', (rule) => rule),
};
