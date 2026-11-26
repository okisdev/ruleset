export const isText = (value) => typeof value === 'string' && value.trim() !== '' && !/[\r\n|]/.test(value);

export function validation() {
  const errors = [];
  function fail(message) {
    errors.push(message);
  }
  function keys(object, allowed, where) {
    if (typeof object !== 'object' || object === null || Array.isArray(object)) {
      fail(`${where}: must be an object`);
      return false;
    }
    for (const key of Object.keys(object)) {
      if (!allowed.includes(key)) fail(`${where}: unknown key ${key}`);
    }
    return true;
  }
  function finish() {
    if (errors.length) throw new Error(errors.join('\n'));
  }
  return { fail, keys, finish };
}
