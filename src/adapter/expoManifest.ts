/**
 * PixiJS Manifest & Bundle utilities for Expo.
 *
 * Transforms Expo-flavored manifests (where `src` can be a require() numeric ID)
 * into standard PixiJS manifests (where `src` is always a string).
 */

import type { UnresolvedAsset, AssetsBundle, AssetsManifest, ArrayOr } from 'pixi.js';
import { registerModuleId, registerAssetUrl } from './loadExpoAsset';

// =============================================================================
// TYPES
// =============================================================================

/** An asset source that accepts Expo require() numeric IDs alongside strings. */
export type ExpoAssetSrc = number | string;

/**
 * An unresolved asset that accepts require() IDs in src.
 * Mirrors PixiJS UnresolvedAsset but src can include numeric module IDs.
 */
export interface ExpoUnresolvedAsset<T = any> {
  alias?: ArrayOr<string>;
  src?: ExpoAssetSrc | ExpoAssetSrc[];
  data?: T;
  format?: string;
  parser?: string;
  [key: string]: any;
}

/** A bundle that accepts Expo require() IDs. */
export interface ExpoAssetsBundle {
  name: string;
  assets:
    | ExpoUnresolvedAsset[]
    | Record<string, ExpoAssetSrc | ExpoAssetSrc[] | ExpoUnresolvedAsset>;
}

/** A manifest that accepts Expo require() IDs. */
export interface ExpoAssetsManifest {
  bundles: ExpoAssetsBundle[];
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function resolveExpoSrc(src: ExpoAssetSrc): string {
  if (typeof src === 'number') {
    return registerModuleId(src);
  }
  // Wrap string URLs with a registry key to prevent PixiJS's resolver
  // from routing them to built-in browser-dependent parsers
  return registerAssetUrl(src);
}

function resolveExpoSrcArray(src: ExpoAssetSrc | ExpoAssetSrc[]): string | string[] {
  if (Array.isArray(src)) {
    return src.map(resolveExpoSrc);
  }
  return resolveExpoSrc(src);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Transform a single Expo asset entry into a standard PixiJS UnresolvedAsset.
 * Numeric require() IDs are registered and converted to string keys.
 */
export function resolveExpoAsset<T = any>(asset: ExpoUnresolvedAsset<T>): UnresolvedAsset<T> {
  const { src, ...rest } = asset;
  if (src === undefined) {
    return rest as UnresolvedAsset<T>;
  }
  return {
    ...rest,
    src: resolveExpoSrcArray(src),
  } as UnresolvedAsset<T>;
}

/**
 * Transform bundle assets for use with `Assets.addBundle()`.
 * Handles both array and Record formats.
 *
 * @example
 * ```ts
 * Assets.addBundle('animals', createExpoBundle([
 *   { alias: 'bunny', src: require('./assets/bunny.png') },
 *   { alias: 'chicken', src: 'https://example.com/chicken.png' },
 * ]));
 * ```
 */
export function createExpoBundle(assets: ExpoAssetsBundle['assets']): AssetsBundle['assets'] {
  if (Array.isArray(assets)) {
    return assets.map(resolveExpoAsset);
  }

  // Record format: Record<string, ExpoAssetSrc | ExpoAssetSrc[] | ExpoUnresolvedAsset>
  const result: Record<string, ArrayOr<string> | UnresolvedAsset> = {};
  for (const [key, value] of Object.entries(assets)) {
    if (typeof value === 'number' || typeof value === 'string') {
      result[key] = resolveExpoSrc(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(resolveExpoSrc);
    } else {
      result[key] = resolveExpoAsset(value);
    }
  }
  return result;
}

/**
 * Transform an Expo-flavored manifest into a standard PixiJS AssetsManifest.
 * Numeric require() IDs in `src` fields are registered and converted to string keys.
 *
 * @example
 * ```ts
 * const manifest = createExpoManifest({
 *   bundles: [
 *     {
 *       name: 'game-screen',
 *       assets: [
 *         { alias: 'character', src: require('./assets/robot.png') },
 *         { alias: 'enemy', src: 'https://example.com/bad-guy.png' },
 *       ],
 *     },
 *   ],
 * });
 *
 * await Assets.init({ manifest });
 * const assets = await Assets.loadBundle('game-screen');
 * ```
 */
export function createExpoManifest(manifest: ExpoAssetsManifest): AssetsManifest {
  return {
    bundles: manifest.bundles.map((bundle) => ({
      name: bundle.name,
      assets: createExpoBundle(bundle.assets),
    })),
  };
}
