/**
 * True when a TOML or INI file declares the given table/section, including
 * subtables: hasSection(pyproject, "tool.ruff") matches [tool.ruff.lint] too.
 */
export function hasSection(content: string | undefined, name: string): boolean {
  if (!content) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*\\[${escaped}(\\.[^\\]]+)?\\]\\s*$`, "m").test(content);
}

/** Runs `fn` over items with at most `limit` in flight, keeping file handles bounded. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
