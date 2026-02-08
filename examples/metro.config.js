const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '..');

// Watch the parent directory where @penabt/pixi-expo source is located
config.watchFolders = [monorepoRoot];

// Ensure all dependencies resolve from the project's node_modules
// This prevents duplicate React instances
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

// Map @penabt/pixi-expo to the parent directory's src
config.resolver.extraNodeModules = new Proxy(
  {
    '@penabt/pixi-expo': monorepoRoot,
  },
  {
    get: (target, name) => {
      if (target.hasOwnProperty(name)) {
        return target[name];
      }
      // Redirect all other modules to this project's node_modules
      return path.join(projectRoot, 'node_modules', name);
    },
  },
);

// Block duplicate modules from parent directory
config.resolver.blockList = [
  // Block node_modules from the parent directory
  new RegExp(`${monorepoRoot}/node_modules/react/.*`),
  new RegExp(`${monorepoRoot}/node_modules/react-native/.*`),
  new RegExp(`${monorepoRoot}/node_modules/pixi.js/.*`),
];

module.exports = config;
