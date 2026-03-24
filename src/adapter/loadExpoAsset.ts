/**
 * Expo Asset Loader for PixiJS
 *
 * This extension uses expo-asset to load textures in React Native.
 * Supports:
 * - require() syntax for bundled assets (via loadTexture helper)
 * - HTTP/HTTPS URLs for remote assets
 * - Local file URIs
 */

import { Asset } from 'expo-asset';
import { Image } from 'react-native';
import { ExtensionType, Texture, ImageSource, LoaderParserPriority } from 'pixi.js';

import type { LoaderParser, ResolvedAsset } from 'pixi.js';

const validImageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif'];
const validImageMIMEs = [
  'image/png',
  'image/jpg',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
];

const MODULE_PREFIX = '__expo_module_';
const URL_PREFIX = '__expo_url_';

/**
 * Registry mapping stringified keys to original require() module IDs.
 * PixiJS's Resolver converts numeric require() results to strings,
 * so we need this map to recover the original module ID.
 */
const moduleIdRegistry = new Map<string, number>();

/**
 * Registry mapping stringified keys to original string URLs.
 * PixiJS's Resolver auto-assigns built-in parsers for known extensions (e.g. .png → loadTextures),
 * bypassing our custom loader's test(). Wrapping URLs with a prefix ensures they always
 * route through loadExpoAsset.
 */
const urlRegistry = new Map<string, string>();
let urlCounter = 0;

/**
 * Register a require() module ID in the registry and return the string key.
 * This key can be used as a `src` in PixiJS Assets system and will be
 * intercepted by the loadExpoAsset loader.
 */
export function registerModuleId(moduleId: number): string {
  const key = `${MODULE_PREFIX}${moduleId}`;
  moduleIdRegistry.set(key, moduleId);
  return key;
}

/**
 * Register a string URL in the registry and return a prefixed key.
 * This prevents PixiJS's resolver from routing the URL to built-in
 * browser-dependent parsers that don't work in React Native.
 */
export function registerAssetUrl(url: string): string {
  const key = `${URL_PREFIX}${urlCounter++}`;
  urlRegistry.set(key, url);
  return key;
}

/**
 * Get file extension from a URL or path
 */
function getExtension(url: string): string {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const lastDot = cleanUrl.lastIndexOf('.');

  if (lastDot === -1) return '';

  return cleanUrl.substring(lastDot).toLowerCase();
}

/**
 * Check if the URL is a remote HTTP(S) URL
 */
function isRemoteUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Get image dimensions using React Native's Image.getSize
 */
function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

/**
 * Load a texture from a require() module ID or string URL.
 *
 * This is the recommended way to load local assets in React Native:
 * ```ts
 * import { loadTexture } from '@penabt/pixi-expo';
 * const texture = await loadTexture(require('./assets/bunny.png'));
 * ```
 *
 * For string URLs, this delegates directly to Assets.load().
 */
export async function loadTexture(source: number | string): Promise<Texture> {
  // Lazy import to avoid circular dependency issues with initialization order
  const { Assets } = await import('pixi.js');

  if (typeof source === 'number') {
    const key = registerModuleId(source);
    return Assets.load(key);
  }

  return Assets.load(source);
}

/**
 * Expo Asset Texture Loader
 *
 * Loads textures using expo-asset for React Native compatibility.
 * Registered at High priority to run before PixiJS's built-in loadTextures
 * parser, which relies on browser APIs (createImageBitmap, new Image()) that
 * don't work in React Native.
 */
export const loadExpoAsset = {
  extension: {
    type: ExtensionType.LoadParser,
    priority: LoaderParserPriority.High,
    name: 'loadExpoAsset',
  },

  name: 'loadExpoAsset',

  /**
   * Test if this loader can handle the given URL
   */
  test(url: string): boolean {
    // Handle registered module IDs (from loadTexture helper)
    if (url.startsWith(MODULE_PREFIX)) {
      if (__DEV__) console.log(`[loadExpoAsset] test("${url}") → true (module)`);
      return true;
    }

    // Handle registered URL keys (from createExpoManifest / registerAssetUrl)
    if (url.startsWith(URL_PREFIX)) {
      if (__DEV__) console.log(`[loadExpoAsset] test("${url}") → true (registered url)`);
      return true;
    }

    // Handle local file URIs
    if (url.startsWith('file://')) {
      if (__DEV__) console.log(`[loadExpoAsset] test("${url}") → true (file)`);
      return true;
    }

    // Handle data URLs with valid image MIME types
    if (url.startsWith('data:')) {
      const result = validImageMIMEs.some((mime) => url.startsWith(`data:${mime}`));
      if (__DEV__)
        console.log(`[loadExpoAsset] test("${url.slice(0, 40)}...") → ${result} (data url)`);
      return result;
    }

    // Handle URLs with valid image extensions
    const ext = getExtension(url);
    const result = validImageExtensions.includes(ext);

    if (__DEV__) console.log(`[loadExpoAsset] test("${url}") ext="${ext}" → ${result}`);
    return result;
  },

  /**
   * Load an asset and create a PixiJS Texture
   */
  async load(url: string, _asset?: ResolvedAsset): Promise<Texture> {
    try {
      if (__DEV__) {
        console.log(`[loadExpoAsset] Loading: ${url}`);
      }

      let localUri: string;
      let width: number | undefined;
      let height: number | undefined;

      // Resolve registered URL keys back to original URLs
      const resolvedUrl = url.startsWith(URL_PREFIX) ? (urlRegistry.get(url) ?? url) : url;

      if (url.startsWith(URL_PREFIX) && !urlRegistry.has(url)) {
        throw new Error(`URL not found in registry for key: ${url}`);
      }

      if (resolvedUrl.startsWith(MODULE_PREFIX)) {
        // Recover the original require() module ID from registry
        const moduleId = moduleIdRegistry.get(resolvedUrl);

        if (moduleId === undefined) {
          throw new Error(`Module ID not found in registry for key: ${resolvedUrl}`);
        }

        const expoAsset = Asset.fromModule(moduleId);
        await expoAsset.downloadAsync();

        localUri = expoAsset.localUri || expoAsset.uri;
        width = expoAsset.width ?? undefined;
        height = expoAsset.height ?? undefined;
      } else if (isRemoteUrl(resolvedUrl)) {
        // Download remote image to local cache via expo-asset
        const expoAsset = Asset.fromURI(resolvedUrl);
        await expoAsset.downloadAsync();

        localUri = expoAsset.localUri || expoAsset.uri;
        width = expoAsset.width ?? undefined;
        height = expoAsset.height ?? undefined;
      } else {
        // Local file URI
        const expoAsset = Asset.fromURI(resolvedUrl);
        await expoAsset.downloadAsync();

        localUri = expoAsset.localUri || expoAsset.uri;
        width = expoAsset.width ?? undefined;
        height = expoAsset.height ?? undefined;
      }

      if (!localUri) {
        throw new Error(`Failed to get local URI for asset: ${url}`);
      }

      // Get dimensions via Image.getSize if not already known
      if (!width || !height) {
        const size = await getImageSize(localUri);
        width = size.width;
        height = size.height;
      }

      if (__DEV__) {
        console.log(`[loadExpoAsset] Resolved: ${localUri} (${width}x${height})`);
      }

      // Create an HTMLImageElement instance that:
      // 1. Passes ImageSource.test() (instanceof HTMLImageElement)
      // 2. Has `localUri` so expo-gl's patched texImage2D loads the image natively
      const MockImage = (globalThis as any).HTMLImageElement;
      const img = new MockImage();
      img.width = width;
      img.height = height;
      img.naturalWidth = width;
      img.naturalHeight = height;
      img.complete = true;
      img.src = localUri;
      img.localUri = localUri;

      const source = new ImageSource({
        resource: img,
        width,
        height,
        alphaMode: 'premultiplied-alpha',
      });

      return new Texture({ source });
    } catch (error) {
      console.error(`[loadExpoAsset] Failed to load: ${url}`, error);
      throw error;
    }
  },

  /**
   * Unload/destroy a texture
   */
  unload(texture: Texture): void {
    texture.destroy(true);
  },
} as LoaderParser<Texture>;

// Note: Registration is done in index.ts after DOMAdapter is set
// extensions.add(loadExpoAsset);
