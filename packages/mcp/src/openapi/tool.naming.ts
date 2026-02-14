export function withStableUniqueNames<T extends { name: string }>(tools: T[]): T[] {
  const counts = new Map<string, number>();

  return tools.map((tool) => {
    const count = counts.get(tool.name) ?? 0;
    counts.set(tool.name, count + 1);

    if (count === 0) return tool;
    return { ...tool, name: `${tool.name}__${count + 1}` };
  });
}
