# EAS Build Fixes — iOS Crash on Launch

> Resolved: 2026-03-28 | Affects: v0.1.0–v0.1.6 | Fixed in: v0.1.7

## Symptom

App crashed immediately on launch (~130ms) when built via EAS cloud (`eas build --platform ios`) and installed through TestFlight. Local Xcode builds (`expo run:ios`) worked perfectly.

- **Crash type:** `RCTFatal` — unhandled JS exception
- **Error message:** `Cannot read property 'useRef' of null`
- **Stack trace origin:** `@react-navigation/elements` → `useFrameSize` → `SceneView` → React's `renderWithHooks`

## Root Cause: Duplicate React in the Bundle

Metro bundled **two copies** of `react/index.js` into `main.jsbundle`. The second copy's hooks dispatcher was `null` (only set by the renderer referencing the first copy), so any hook call (`useRef`, `useState`, etc.) from a component linked to the wrong copy crashed.

### Why two copies existed

The pnpm monorepo uses `node-linker=hoisted`, which creates symlinks:

```
apps/mobile/node_modules/react/  →  symlink  →  .pnpm/react@18.3.1/…
node_modules/react/              →  symlink  →  .pnpm/react@18.3.1/…
```

Same physical file, but **two different path strings**. Metro's production bundler uses the path string as the module key. Two paths = two modules in the bundle.

`metro.config.js` had `watchFolders: [monorepoRoot]`, which exposed the root `node_modules/` to Metro, giving it a second path to discover `react`.

### Why it only crashed on EAS (not local Xcode)

| Environment | Build type | JS loading | React dedup? |
|---|---|---|---|
| `expo run:ios` (local) | Debug | Metro dev server serves modules over HTTP, one at a time | Yes — Node.js `require.resolve` follows symlinks natively, one module |
| `eas build` (cloud) | Release | Metro traverses full dependency graph upfront, serializes into single `main.jsbundle` | No — two path strings = two modules |

The dev server never has a "bundle" with two copies because modules are served on-demand and deduplicated by the server process. The production bundler serializes everything into one file and uses raw path strings as keys.

## Fix (3 parts)

### 1. Metro config — force single React instance (`metro.config.js`)

```js
// Follow pnpm symlinks to real paths for dedup
config.resolver.unstable_enableSymlinks = true;

// Nuclear dedup: intercept all react/react-native imports
const dedupedPackages = {
  react: require.resolve("react", { paths: [projectRoot] }),
  "react-native": require.resolve("react-native", { paths: [projectRoot] }),
  "react-dom": require.resolve("react-dom", { paths: [projectRoot] }),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (dedupedPackages[moduleName]) {
    return { type: "sourceFile", filePath: dedupedPackages[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};
```

`resolveRequest` fires before Metro's normal resolution for every `require`/`import` in the entire dependency graph. All imports of `react` — from app code, `@react-navigation`, `expo-router`, any nested dependency — get the exact same file path. One path = one module.

`unstable_enableSymlinks` is belt-and-suspenders: it tells Metro to resolve symlinks to real paths before using them as module keys.

**Verified:** sourcemap analysis of the production bundle shows exactly 1 entry for `react/index.js` and 1 entry for `react-native/index.js`.

### 2. Env var resolution (`app.config.ts`)

Separate issue that would have caused broken Supabase credentials in production (not the crash, but the app wouldn't work):

- Local `.env` uses `NEXT_PUBLIC_SUPABASE_URL`
- EAS cloud env vars were set as `SUPABASE_URL` (no prefix)
- `dotenv` can't load `../../.env` on EAS (file doesn't exist)
- Result: all env vars baked as `undefined` into the bundle

**Fix:** `env()` helper checks both `NEXT_PUBLIC_X` and `X`. `dotenv` import wrapped in try/catch.

### 3. Global error handler (`index.js`)

React error boundaries only catch render errors. Module-init crashes (like this one) happen before React renders. Added `ErrorUtils.setGlobalHandler` before any app code loads (using `require()` to avoid `import` hoisting).

## Files Changed

| File | Change |
|------|--------|
| `apps/mobile/metro.config.js` | `resolveRequest` dedup + `unstable_enableSymlinks` |
| `apps/mobile/app.config.ts` | Safe `dotenv` import, dual env var resolution, version bump |
| `apps/mobile/index.js` | Global error handler with `require()` instead of `import` |
| `apps/mobile/app/_layout.tsx` | React error boundary (added earlier) |

## How to Verify

Check the production bundle's sourcemap for duplicate React entries:

```bash
npx expo export --platform ios --dump-sourcemap
node -e "
const map = JSON.parse(require('fs').readFileSync('dist/_expo/static/js/ios/<hash>.hbc.map', 'utf8'));
const reactEntries = map.sources.filter(s => s.endsWith('/react/index.js'));
console.log('React copies:', reactEntries.length); // Should be 1
reactEntries.forEach(s => console.log(' ', s));
"
```

## Lessons Learned

1. **pnpm monorepos need explicit Metro dedup.** `watchFolders: [monorepoRoot]` is necessary for monorepo resolution but creates duplicate module paths. Always pair it with `resolveRequest` pinning for `react` and `react-native`.
2. **Local dev ≠ production bundle.** The Metro dev server and production bundler have fundamentally different module resolution behavior. Always test with `expo export` or `eas build --local` before submitting to TestFlight.
3. **EAS env vars don't have the `NEXT_PUBLIC_` prefix.** When sharing a `.env` file between Next.js and Expo, the config must handle both naming conventions.
4. **`import` hoisting defeats execution order.** Use `require()` in entry files when code must run before imports.
