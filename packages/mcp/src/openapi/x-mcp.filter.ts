function pickFlag(value: any): boolean | undefined {
  if (value === true) return true;
  if (value === false) return false;
  return undefined;
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

export function shouldIncludeOperation(args: {
  root: any;
  pathItem: any;
  operation: any;
  defaultInclude: boolean;
}): boolean {
  const root = pickFlag(args.root?.['x-mcp']);
  const path = pickFlag(args.pathItem?.['x-mcp']);
  const op = pickFlag(args.operation?.['x-mcp']);

  if (typeof op === 'boolean') return op;
  if (typeof path === 'boolean') return path;
  if (typeof root === 'boolean') return root;

  return args.defaultInclude;
}

export function getIncludedOperations(spec: any, defaultInclude: boolean): Array<{ method: string; path: string; operation: any }> {
  const out: Array<{ method: string; path: string; operation: any }> = [];

  for (const [path, pathItem] of Object.entries<any>(spec?.paths ?? {})) {
    for (const [method, operation] of Object.entries<any>(pathItem ?? {})) {
      if (!METHODS.has(method)) continue;
      if (!shouldIncludeOperation({ root: spec, pathItem, operation, defaultInclude })) continue;
      out.push({ method, path, operation });
    }
  }

  return out;
}
