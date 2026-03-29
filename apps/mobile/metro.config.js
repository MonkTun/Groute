const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Force Metro to follow pnpm symlinks to their real paths so that all imports
// of react/react-native resolve to the same physical file. Without this, Metro
// sees the symlink path and the pnpm store path as separate modules, bundling
// React twice — the second copy evaluates as null, crashing on useRef.
config.resolver.unstable_enableSymlinks = true;

// Nuclear dedup: intercept resolution of react/react-native so every import —
// regardless of where it originates — resolves to the exact same entry file.
const dedupedPackages = {
  react: require.resolve("react", { paths: [projectRoot] }),
  "react-native": require.resolve("react-native", { paths: [projectRoot] }),
  "react-dom": require.resolve("react-dom", { paths: [projectRoot] }),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (dedupedPackages[moduleName]) {
    return {
      type: "sourceFile",
      filePath: dedupedPackages[moduleName],
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
