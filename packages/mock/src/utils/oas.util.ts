export function normalizeNullable(schema: any): any {
  if (!schema) return schema;
  recurse(schema, (obj) => {
    if (obj && typeof obj === "object" && "nullable" in obj) {
      const t = obj.type;
      if (obj.nullable === true) {
        if (Array.isArray(t)) {
          if (!t.includes("null")) obj.type = [...t, "null"];
        } else if (typeof t === "string") {
          obj.type = [t, "null"];
        } else if (!("type" in obj)) {
          obj.anyOf = [...(obj.anyOf || []), { type: "null" }];
        }
      }
      delete obj.nullable;
    }
    return obj;
  });
  return schema;
}

export function stripKeywords(node: any, keys: string[]) {
  recurse(node, (obj) => {
    for (const k of keys) if (k in obj) delete obj[k];
    return obj;
  });
}

export function recurse(node: any, fn: (o: any) => any) {
  if (!node || typeof node !== "object") return;
  fn(node);
  for (const key of Object.keys(node)) {
    const val = (node as any)[key];
    if (val && typeof val === "object") recurse(val, fn);
  }
}

export function deepClone<T>(v: T): T {
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : (v as T);
}

export function normalizeForResponseLocal(schema: any, openapiVersion: string) {
  if (!schema) return undefined;
  const root = deepClone(schema);
  stripKeywords(root, ["writeOnly"]);
  if (!String(openapiVersion || "3.0").startsWith("3.1")) normalizeNullable(root);
  recurse(root, (n) => n);
  return root;
}

export function bundleWithComponentsLocal(schema: any, spec: any): any {
  if (!schema) return schema;
  const bundled = deepClone(schema);
  const components = deepClone(spec?.components || {});
  if (components && Object.keys(components).length) {
    (bundled as any).components = { ...(bundled as any).components, ...components };
  }
  return bundled;
}

