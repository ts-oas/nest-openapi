# Changelog

## [0.1.1]

- Added `mapOutputSchema` option to `OpenAPIMcpToolsOptions` (defaults to `true`) to control whether response schemas are mapped to MCP tool output schemas.
- Included `structuredContent` in MCP tool call results when an `outputSchema` is defined and payload is an object. Support mapping `*/*` alongside `application/json` for output schema detection.
- Added support for NestJS 12 (`peerDependencies` updated to `^9.0.0 || ^10.0.0 || ^11.0.0 || ^12.0.0`).
- Added `"types"` condition to package.json `exports` map for `NodeNext` resolution.

## [0.1.0]

- Initial release.
