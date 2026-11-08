export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function compareArtifacts(left, right) {
  const normalize = artifacts => Object.fromEntries(artifacts.map(a => [a.name, canonical(a.data)]).sort(([a], [b]) => a.localeCompare(b)));
  const a = normalize(left), b = normalize(right);
  const firstDifference = (x, y, path = '') => {
    if (Object.is(x, y)) return null;
    if (!x || !y || typeof x !== 'object' || typeof y !== 'object' || Array.isArray(x) !== Array.isArray(y)) return path;
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
    for (const key of keys) {
      const next = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(x, key) || !Object.hasOwn(y, key)) return next;
      const difference = firstDifference(x[key], y[key], next);
      if (difference !== null) return difference;
    }
    return null;
  };
  const difference = firstDifference(a, b);
  return { matches: difference === null, difference, names: Object.keys(a) };
}
