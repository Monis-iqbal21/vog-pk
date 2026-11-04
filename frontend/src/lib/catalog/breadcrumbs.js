export function categoryTrail(category, categories) {
  const trail = [],
    seen = new Set();
  let current = category;
  while (current && trail.length < 32 && !seen.has(current.id)) {
    seen.add(current.id);
    trail.unshift(current);
    current = categories.find((c) => c.id === current.parentId);
  }
  return trail;
}
