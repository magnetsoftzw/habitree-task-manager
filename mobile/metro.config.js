const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const nativeOnly = /[\\/]node_modules[\\/].*[\\/](android|ios|ReactAndroid|ReactCommon|third-party-podspecs|__tests__|__mocks__)([\\/].*)?$/;
const existing = config.resolver.blockList;
config.resolver.blockList = [nativeOnly, ...(Array.isArray(existing) ? existing : existing ? [existing] : [])];

module.exports = config;
