const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

// eslint-disable-next-line no-undef
const config = getDefaultConfig(__dirname);

// Add Firebase module resolution
config.resolver.extraNodeModules = {
  '@firebase/firestore': require.resolve('firebase/firestore'),
  '@firebase/auth': require.resolve('firebase/auth'),
  '@firebase/app': require.resolve('firebase/app'),
};

module.exports = withNativeWind(config, { input: './app/global.css' });
