export function pageNumbers(current, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set([0, count - 1]);
  const start = Math.max(1, Math.min(current - 1, count - 4));
  for (let i = start; i <= Math.min(count - 2, start + 2); i++) pages.add(i);
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, i) => i && page - sorted[i - 1] > 1 ? ['ellipsis-' + page, page] : [page]);
}
