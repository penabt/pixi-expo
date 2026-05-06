/**
 * @fileoverview Web entry point for @penabt/pixi-expo.
 *
 * On web, PixiJS works against the browser's native DOM/WebGL APIs through
 * its built-in BrowserAdapter, so no polyfills, no custom DOMAdapter, and no
 * expo-gl bridging are required. This entry exposes the same public surface
 * as the native build wherever it makes sense (PixiView, manifest helpers,
 * registerBitmapFont, design-resolution utils, PixiJS re-exports), and omits
 * the native-only adapter internals.
 *
 * @module @penabt/pixi-expo
 */

import { Assets as _Assets } from 'pixi.js';
import { Asset } from 'expo-asset';

// =============================================================================
// PATCH Assets.load TO ACCEPT METRO-WEB REQUIRE() VALUES
// Mirrors the native patch: native turns numeric asset-registry IDs into
// registered string keys; web unwraps `{ uri, width, height }` objects that
// Metro web returns for image requires.
// =============================================================================

function isImageRequireResult(input: any): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof input.uri === 'string' &&
    typeof input.width === 'number' &&
    typeof input.height === 'number'
  );
}

/**
 * Normalize a single Metro require() value into something PixiJS Assets can load.
 * Returns a string URL (for already-string sources) or a registered alias key
 * (for image-like requires that need a forced loadParser to bypass the
 * extension-based dispatch failure on Metro web's `?unstable_path=` URLs).
 */
function normalizeWebSrc(input: any): string {
  if (typeof input === 'string') return input;
  if (typeof input === 'number') return Asset.fromModule(input as any).uri;
  if (isImageRequireResult(input)) {
    const uri = input.uri as string;
    // Pre-register so PixiJS knows the loadParser; the alias is the URI itself.
    if (!_Assets.resolver.hasKey(uri)) {
      _Assets.add({ alias: uri, src: uri, loadParser: 'loadTextures' });
    }
    return uri;
  }
  if (typeof input === 'object' && input !== null && typeof input.uri === 'string') {
    return input.uri;
  }
  return String(input);
}

const _originalLoad = _Assets.load.bind(_Assets);
(_Assets as any).load = function patchedLoad(urls: any, onProgress?: any): Promise<any> {
  if (Array.isArray(urls)) {
    const resolved = urls.map(normalizeWebSrc);
    // Match the native patch: return an array (instead of Record) so callers
    // can destructure `const [a, b] = await Assets.load([...])`.
    return _originalLoad(resolved, onProgress).then((record: any) =>
      resolved.map((key: any) => record[key]),
    );
  }
  return _originalLoad(normalizeWebSrc(urls), onProgress);
};

// =============================================================================
// MANIFEST & BUNDLE UTILITIES
// =============================================================================

export {
  createExpoManifest,
  createExpoBundle,
  resolveExpoAsset,
} from './adapter-web/expoManifest.web';
export type {
  ExpoAssetSrc,
  ExpoUnresolvedAsset,
  ExpoAssetsBundle,
  ExpoAssetsManifest,
} from './adapter-web/expoManifest.web';

// =============================================================================
// BITMAP FONT LOADER
// (Importing this module also registers `loadWebBitmapFont` with PixiJS.)
// =============================================================================

export { registerBitmapFont, loadWebBitmapFont } from './adapter-web/registerBitmapFont.web';

// =============================================================================
// REACT COMPONENT
// =============================================================================

export { PixiView } from './components/PixiView.web';
export type { PixiViewProps, PixiViewHandle } from './components/PixiView.web';

// =============================================================================
// DESIGN RESOLUTION
// =============================================================================

export { calculateDesignScale, calculateDesignSafeArea } from './utils/designResolution';
export type {
  DesignScaleMode,
  DesignScaleResult,
  SafeAreaInsets,
  DesignSafeArea,
} from './utils/designResolution';

// =============================================================================
// PIXIJS RE-EXPORTS
// (Same set as the native entry so consumers can swap freely.)
// =============================================================================

export {
  Application,
  Container,
  Sprite,
  Graphics,
  Text,
  TilingSprite,
  AnimatedSprite,
  Mesh,
  NineSliceSprite,
  Texture,
  TextureSource,
  Spritesheet,
  RenderTexture,
  Assets,
  Matrix,
  Point,
  ObservablePoint,
  Rectangle,
  Circle,
  Ellipse,
  Polygon,
  RoundedRectangle,
  Filter,
  BlurFilter,
  ColorMatrixFilter,
  NoiseFilter,
  DisplacementFilter,
  BitmapText,
  TextStyle,
  Batcher,
  FederatedPointerEvent,
  EventBoundary,
  Color,
  Ticker,
  extensions,
  ExtensionType,
  DOMAdapter,
} from 'pixi.js';

export type {
  ApplicationOptions,
  TextureSourceOptions,
  SpritesheetData,
  FilterOptions,
  Renderer,
  AssetsManifest,
  AssetsBundle,
  UnresolvedAsset,
} from 'pixi.js';
