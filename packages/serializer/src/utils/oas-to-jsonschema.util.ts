/**
 * Normalize an OpenAPI response schema so it is usable by fast-json-stringify (FJS).
 * - OpenAPI 3.1 is JSON Schema – pass through.
 * - OpenAPI 3.0: translate `nullable`, drop writeOnly, respect readOnly for responses.
 */
export function normalizeForResponse(
  schema: any,
  { openapiVersion }: { openapiVersion: string },
): any {
  if (!schema) return undefined;
  const version = (openapiVersion || "3.0").toString();
  const root = deepClone(schema);

  // Remove writeOnly everywhere for responses; keep readOnly
  stripKeywords(root, ["writeOnly"]);

  if (version.startsWith("3.1")) {
    return root; // already JSON Schema
  }

  // Handle 3.0 nullable -> type union
  transformNullable(root);

  // Small helpers: allOf/oneOf/anyOf recurse
  recurse(root, (node) => node);
  return root;
}

/**
 * Bundle a response schema with a "$ref" context so FJS can resolve
 * refs like "#/components/schemas/Foo" even when compiling only the media schema.
 * We merge the spec's components onto the root we pass to FJS.
 */
export function bundleWithComponents(schema: any, spec: any): any {
  if (!schema) return schema;
  const bundled = deepClone(schema);
  const components = deepClone(spec?.components || {});
  if (components && Object.keys(components).length) {
    (bundled as any).components = {
      ...(bundled as any).components,
      ...components,
    };
  }
  return bundled;
}

function deepClone<T>(v: T): T {
  return v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : (v as T);
}

function stripKeywords(node: any, keys: string[]) {
  recurse(node, (obj) => {
    for (const k of keys) if (k in obj) delete obj[k];
    return obj;
  });
}

function transformNullable(node: any) {
  recurse(node, (obj) => {
    if (obj && typeof obj === "object" && "nullable" in obj) {
      const t = obj.type;
      if (obj.nullable === true) {
        if (Array.isArray(t)) {
          if (!t.includes("null")) obj.type = [...t, "null"]; // keep unique
        } else if (typeof t === "string") {
          obj.type = [t, "null"];
        } else if (!("type" in obj)) {
          // no explicit type (e.g., oneOf) – add anyOf null
          obj.anyOf = [...(obj.anyOf || []), { type: "null" }];
        }
      }
      delete obj.nullable;
    }
    return obj;
  });
}

function recurse(node: any, fn: (o: any) => any) {
  if (!node || typeof node !== "object") return;
  fn(node);
  for (const key of Object.keys(node)) {
    const val = (node as any)[key];
    if (val && typeof val === "object") recurse(val, fn);
  }
}
