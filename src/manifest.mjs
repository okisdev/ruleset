import { surge } from './targets/surge.mjs';
import { mihomo } from './targets/mihomo.mjs';

const targets = { surge, mihomo };
const json = (value) => JSON.stringify(value, null, 2) + '\n';

export function buildArtifacts(source) {
  const files = new Map();
  const lists = source.lists.map((list) => {
    const { path, title, policy, sni } = list;
    const entry = { path, title, policy, sni };
    for (const [name, target] of Object.entries(targets)) {
      entry[name] = target.path(list);
      files.set(entry[name], target.render(list));
    }
    return entry;
  });
  files.set('catalog/services.json', json(source.catalog));
  files.set('protected.json', source.protectedText);

  files.set('manifest.json', json({ lists }));
  return files;
}
