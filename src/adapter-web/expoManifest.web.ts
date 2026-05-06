/**
 * Web variant of the Expo manifest helpers.
 *
 * On web, Metro/webpack resolves `require('./asset.png')` to either a string URL
 * or a numeric asset-registry ID (the same registry react-native-web uses).
 * Either way, we just need to produce string URLs that PixiJS can load directly.
 * No registry/proxying is required because PixiJS's default browser loaders
 * already understand fetch/Image/HTTP URLs.
 */

import type { UnresolvedAsset, AssetsBundle, AssetsManifest, ArrayOr } from 'pixi.js';
import { Asset } from 'expo-asset';

// =============================================================================
// TYPES — kept identical to the native module so call sites are portable.
// =============================================================================

/**
 * What `require('./asset.png')` may evaluate to across bundlers:
 * - native (Metro):              number (asset-registry ID)
 * - Metro web, image assets:     `{ uri, width?, height? }`
 * - Metro web, non-image assets: string URL
 * - hand-written URLs:           string
 */
export type ExpoAssetSrc =
  | number
  | string
  | { uri: string; width?: number; height?: number };

export interface ExpoUnresolvedAsset<T = any> {
  alias?: ArrayOr<string>;
  src?: ExpoAssetSrc | ExpoAssetSrc[];
  data?: T;
  format?: string;
  parser?: string;
  [key: string]: any;
}

export interface ExpoAssetsBundle {
  name: string;
  assets:
    | ExpoUnresolvedAsset[]
    | Record<string, ExpoAssetSrc | ExpoAssetSrc[] | ExpoUnresolvedAsset>;
}

export interface ExpoAssetsManifest {
  bundles: ExpoAssetsBundle[];
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function resolveExpoSrc(src: ExpoAssetSrc): string {
  if (typeof src === 'string') return src;
  if (typeof src === 'object' && src !== null && typeof (src as any).uri === 'string') {
    return (src as any).uri;
  }
  if (typeof src === 'number') {
    // Fallback for environments that hand back numeric asset-registry IDs.
    return Asset.fromModule(src as any).uri;
  }
  return String(src);
}

function resolveExpoSrcArray(src: ExpoAssetSrc | ExpoAssetSrc[]): string | string[] {
  if (Array.isArray(src)) {
    return src.map(resolveExpoSrc);
  }
  return resolveExpoSrc(src);
}

function isImageRequireResult(s: ExpoAssetSrc): boolean {
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof (s as any).uri === 'string' &&
    typeof (s as any).width === 'number' &&
    typeof (s as any).height === 'number'
  );
}

// =============================================================================
// PUBLIC API — same shape as the native module.
// =============================================================================

export function resolveExpoAsset<T = any>(asset: ExpoUnresolvedAsset<T>): UnresolvedAsset<T> {
  const { src, ...rest } = asset;
  if (src === undefined) {
    return rest as UnresolvedAsset<T>;
  }
  // Metro web returns asset URLs like `/assets/?unstable_path=.%2Fassets/icon.png`
  // in dev mode. PixiJS's `loadTextures` parser inspects the path's extension
  // (which is `/assets/` after `?` is stripped) and rejects it, so we explicitly
  // pin the loader to `loadTextures` whenever the source comes from an image
  // require() — which we recognise by the `{ uri, width, height }` shape Metro
  // hands us for image assets.
  const srcArray = Array.isArray(src) ? src : [src];
  const hasImageRequire = srcArray.some(isImageRequireResult);
  const result: any = {
    ...rest,
    src: resolveExpoSrcArray(src),
  };
  if (hasImageRequire && !rest.loadParser && !(rest as any).parser) {
    result.loadParser = 'loadTextures';
  }
  return result as UnresolvedAsset<T>;
}

export function createExpoBundle(assets: ExpoAssetsBundle['assets']): AssetsBundle['assets'] {
  if (Array.isArray(assets)) {
    return assets.map(resolveExpoAsset);
  }

  const result: Record<string, ArrayOr<string> | UnresolvedAsset> = {};
  for (const [key, value] of Object.entries(assets)) {
    if (typeof value === 'number' || typeof value === 'string') {
      result[key] = resolveExpoSrc(value as ExpoAssetSrc);
    } else if (Array.isArray(value)) {
      const srcs = value.map(resolveExpoSrc);
      const hasImageRequire = (value as ExpoAssetSrc[]).some(isImageRequireResult);
      result[key] = hasImageRequire ? ({ src: srcs, loadParser: 'loadTextures' } as UnresolvedAsset) : srcs;
    } else if (isImageRequireResult(value as any)) {
      result[key] = {
        src: resolveExpoSrc(value as any),
        loadParser: 'loadTextures',
      } as UnresolvedAsset;
    } else {
      result[key] = resolveExpoAsset(value as ExpoUnresolvedAsset);
    }
  }
  return result;
}

export function createExpoManifest(manifest: ExpoAssetsManifest): AssetsManifest {
  return {
    bundles: manifest.bundles.map((bundle) => ({
      name: bundle.name,
      assets: createExpoBundle(bundle.assets),
    })),
  };
}
