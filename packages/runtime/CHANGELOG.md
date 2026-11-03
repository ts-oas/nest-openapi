# Changelog

## [0.1.3]

- Added support for NestJS 12 (`peerDependencies` updated to `^9.0.0 || ^10.0.0 || ^11.0.0 || ^12.0.0`).
- Added `"types"` condition to package.json `exports` map for `NodeNext` resolution.
- Exported `type HttpArgumentsHost = ReturnType<ArgumentsHost['switchToHttp']>` in `PlatformUtil` to eliminate deprecated `@nestjs/common/interfaces` deep import across all NestJS versions.
- Preserved `request.baseUrl` when resolving route paths in `PlatformUtil.getRoutePath`.

## [0.1.2]

- Patch release with bug fixes and stability improvements.

## [0.1.0]

- Initial release.
