---
name: Metro pnpm mobile preview
description: Non-obvious Metro resolution constraints for the Jatek mobile static preview in this pnpm monorepo.
---

For the Jatek mobile static preview, Metro must not watch the monorepo root: the Expo and static-preview processes together can exhaust Linux inotify watchers. In pnpm layouts, `watchFolders` alone does not make package imports resolvable; Metro also needs `extraNodeModules` mappings to the real installed package roots, with application-direct packages taking precedence when multiple versions exist. Expo web development additionally needs every installed `metro-runtime` version and the internal `@expo/metro` package watched and mapped, because Metro may resolve its fallback/HMR modules from a different transitive version than the app.

**Why:** The workspace virtual store hoists many transitive packages without placing links in the mobile package's local `node_modules`. A global mapping can also select an incompatible duplicate version, such as Babel's `semver` 6.x instead of Reanimated's 7.x.

**How to apply:** Keep watch folders limited to the generated API client and the recursively collected installed dependency roots, plus all installed Metro runtime roots and `@expo/metro`. Build the module map with direct application packages first, then transitive roots, and allow a valid bundle to contain zero local asset references when its manifests and bundles are present.