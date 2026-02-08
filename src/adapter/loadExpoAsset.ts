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

const validImageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const MODULE_PREFIX = '__expo_module_';

/**
 * Registry mapping stringified keys to original require() module IDs.
 * PixiJS's Resolver converts numeric require() results to strings,
 * so we need this map to recover the original module ID.
 */
const moduleIdRegistry = new Map<string, number>();

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
    const key = `${MODULE_PREFIX}${source}`;
    moduleIdRegistry.set(key, source);
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
      return true;
    }

    // Handle local file URIs
    if (url.startsWith('file://')) {
      return true;
    }

    // Handle URLs with valid image extensions
    const ext = getExtension(url);

    return validImageExtensions.includes(ext);
  },

  /**
   * Load an asset and create a PixiJS Texture
   */
  async load(url: string, _asset?: ResolvedAsset): Promise<Texture> {
    let expoAsset: Asset;

    try {
      if (url.startsWith(MODULE_PREFIX)) {
        // Recover the original require() module ID from registry
        const moduleId = moduleIdRegistry.get(url);

        if (moduleId === undefined) {
          throw new Error(`Module ID not found in registry for key: ${url}`);
        }

        expoAsset = Asset.fromModule(moduleId);
      } else if (isRemoteUrl(url)) {
        expoAsset = Asset.fromURI(url);
      } else {
        expoAsset = Asset.fromURI(url);
      }

      // Download the asset to local storage
      await expoAsset.downloadAsync();

      const localUri = expoAsset.localUri || expoAsset.uri;

      if (!localUri) {
        throw new Error(`Failed to get local URI for asset: ${url}`);
      }

      // Get dimensions from the asset metadata or via Image.getSize
      let width = expoAsset.width;
      let height = expoAsset.height;

      if (!width || !height) {
        const size = await getImageSize(localUri);
        width = size.width;
        height = size.height;
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
      console.error(`Failed to load asset: ${url}`, error);
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
