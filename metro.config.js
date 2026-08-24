const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pdf-lib ships a CommonJS build that is compatible with Metro. Without this,
// Metro follows tslib's ESM export map and crashes while loading the bundle.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;