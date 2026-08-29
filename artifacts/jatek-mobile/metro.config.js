const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const apiClientRoot = path.resolve(workspaceRoot, "lib/api-client-react");
const expoRouterRoot = path.dirname(
  require.resolve("expo-router/entry", { paths: [projectRoot] }),
);
const expoRoot = path.dirname(
  require.resolve("expo/package.json", { paths: [projectRoot] }),
);
const expoCliRoot = path.dirname(
  require.resolve("@expo/cli/package.json", { paths: [expoRoot] }),
);
const expoMetroRuntimeRoot = path.dirname(
  require.resolve("@expo/metro-runtime/package.json", { paths: [projectRoot] }),
);
const expoModulesCoreRoot = path.dirname(
  require.resolve("expo-modules-core/package.json", { paths: [projectRoot] }),
);
const whatwgFetchRoot = path.dirname(
  require.resolve("whatwg-fetch/package.json", { paths: [projectRoot] }),
);
const babelRuntimeRoot = path.dirname(
  require.resolve("@babel/runtime/package.json", { paths: [projectRoot] }),
);
const reactRoot = path.dirname(
  require.resolve("react/package.json", { paths: [projectRoot] }),
);
const reactDomRoot = path.dirname(
  require.resolve("react-dom/package.json", { paths: [projectRoot] }),
);
const reactNativeRoot = path.dirname(
  require.resolve("react-native/package.json", { paths: [projectRoot] }),
);
const appPackage = require(path.join(projectRoot, "package.json"));

function resolvePackageRoot(packageName) {
  try {
    const resolved = require.resolve(packageName, { paths: [projectRoot] });
    let directory = fs.realpathSync(path.dirname(resolved));

    while (directory !== path.dirname(directory)) {
      const packageJsonPath = path.join(directory, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
        if (packageJson.name === packageName) {
          return directory;
        }
      }
      directory = path.dirname(directory);
    }
  } catch {
    // Optional platform packages can be absent from a workspace install.
  }

  return null;
}

function resolveInstalledDependencyRoot(packageRoot, packageName) {
  const dependencyPaths = [
    path.join(packageRoot, "node_modules", packageName),
    path.join(workspaceRoot, "node_modules", ".pnpm", "node_modules", packageName),
    path.join(projectRoot, "node_modules", packageName),
  ];

  for (const dependencyPath of dependencyPaths) {
    try {
      if (!fs.existsSync(dependencyPath)) {
        continue;
      }

      let directory = fs.realpathSync(dependencyPath);
      while (directory !== path.dirname(directory)) {
        const packageJsonPath = path.join(directory, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8"),
          );
          if (packageJson.name === packageName) {
            return directory;
          }
        }
        directory = path.dirname(directory);
      }
    } catch {
      // Try the next pnpm resolution location.
    }
  }

  return null;
}

function collectDependencyRoots(initialRoots) {
  const roots = new Set(initialRoots.filter(Boolean));
  const pending = [...roots];

  while (pending.length > 0) {
    const packageRoot = pending.pop();
    let packageJson;

    try {
      packageJson = JSON.parse(
        fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
      );
    } catch {
      continue;
    }

    const dependencyNames = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.optionalDependencies || {}),
    ];

    for (const dependencyName of dependencyNames) {
      const dependencyRoot = resolveInstalledDependencyRoot(
        packageRoot,
        dependencyName,
      );
      if (dependencyRoot && !roots.has(dependencyRoot)) {
        roots.add(dependencyRoot);
        pending.push(dependencyRoot);
      }
    }
  }

  return [...roots];
}

const metroRuntimePackageNames = [
  ...Object.keys(appPackage.dependencies || {}),
  ...Object.keys(appPackage.devDependencies || {}),
].filter(
  (packageName) =>
    packageName !== "eas-cli" &&
    packageName !== "@expo/cli" &&
    packageName !== "@expo/ngrok" &&
    packageName !== "typescript" &&
    !packageName.startsWith("@types/") &&
    !packageName.startsWith("babel-"),
);
const directPackageRoots = metroRuntimePackageNames
  .map(resolvePackageRoot)
  .filter(Boolean);
const dependencyRoots = collectDependencyRoots([
  apiClientRoot,
  expoRoot,
  expoCliRoot,
  expoRouterRoot,
  expoMetroRuntimeRoot,
  expoModulesCoreRoot,
  whatwgFetchRoot,
  babelRuntimeRoot,
  reactRoot,
  reactDomRoot,
  reactNativeRoot,
  ...directPackageRoots,
]);
const extraNodeModules = {};
const preferredPackageRoots = [
  ...directPackageRoots,
  expoRoot,
  expoCliRoot,
  expoRouterRoot,
  expoMetroRuntimeRoot,
  expoModulesCoreRoot,
  whatwgFetchRoot,
  babelRuntimeRoot,
  reactRoot,
  reactDomRoot,
  reactNativeRoot,
];
for (const packageRoot of [
  ...preferredPackageRoots,
  ...dependencyRoots,
]) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
    );
    if (packageJson.name && !extraNodeModules[packageJson.name]) {
      extraNodeModules[packageJson.name] = packageRoot;
    }
  } catch {
    // Ignore non-package watch roots such as the generated API client.
  }
}

const config = getDefaultConfig(projectRoot);

// Only the generated API client and the resolved Expo Router package are
// imported from outside the app root. Watching the monorepo root makes Metro
// recurse through every workspace node_modules tree; with the Expo and
// static-preview Metro processes running together that exhausts Linux inotify
// watchers and fails with ENOSPC.
config.watchFolders = [
  apiClientRoot,
  ...dependencyRoots,
];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ignoredDirs = [
  path.resolve(workspaceRoot, ".local"),
  path.resolve(workspaceRoot, ".git"),
  path.resolve(workspaceRoot, "dist"),
  path.resolve(workspaceRoot, "build"),
];
config.resolver.blockList = [
  ...ignoredDirs.map((d) => new RegExp(`^${escapeRegExp(d)}(/.*)?$`)),
  // Exclude Expo postinstall temp dirs that pnpm creates then removes
  /_tmp_\d+/,
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = extraNodeModules;

module.exports = config;
