# Changelog

## [0.1.2]

- Fixed output schema extraction to cover all declared 2xx responses (combining distinct status schemas with `anyOf` and deduplicating identical ones), while safely omitting validation when any response has an empty body (e.g. `204 No Content`) or non-JSON media type.
- Added structured output wrapping (`{ result: payload }`) for non-object responses (arrays, primitives, nullables, and unions) to satisfy MCP object output schema specifications.

## [0.1.1]

- Added `mapOutputSchema` option to `OpenAPIMcpToolsOptions` (defaults to `true`) to control whether response schemas are mapped to MCP tool output schemas.
- Included `structuredContent` in MCP tool call results when an `outputSchema` is defined and payload is an object. Support mapping `*/*` alongside `application/json` for output schema detection.
- Added support for NestJS 12 (`peerDependencies` updated to `^9.0.0 || ^10.0.0 || ^11.0.0 || ^12.0.0`).
- Added `"types"` condition to package.json `exports` map for `NodeNext` resolution.

## [0.1.0]

- Initial release.
