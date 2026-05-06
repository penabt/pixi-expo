/**
 * Web variant of the bitmap font loader.
 *
 * Mirrors `src/adapter/loadExpoBitmapFont.ts` but uses `fetch()` for the .fnt
 * file and string URLs (instead of expo-asset module IDs) for the atlas pages.
 *
 * Why we still need a custom loader on web:
 *   Bundlers hash asset filenames (e.g. `desyrel.png` → `/static/media/desyrel.[hash].png`),
 *   so the `<page file="desyrel.png"/>` reference inside the .fnt cannot be resolved
 *   relative to the .fnt URL the way PixiJS's built-in `loadBitmapFont` expects.
 *   The caller hands us the page URLs explicitly via `registerBitmapFont(...)`.
 */

import { Asset } from 'expo-asset';
import {
  Cache,
  ExtensionType,
  LoaderParserPriority,
  BitmapFont,
  bitmapFontTextParser,
  bitmapFontXMLStringParser,
  extensions,
} from 'pixi.js';
import type { Loader, LoaderParser, ResolvedAsset } from 'pixi.js';

// =============================================================================
// REGISTRY
// =============================================================================

const BMFONT_PREFIX = '__expo_bmfont_';

interface BitmapFontEntry {
  fntUrl: string;
  pageUrls: string[];
}

const bitmapFontRegistry = new Map<string, BitmapFontEntry>();
let bmfontCounter = 0;

type BundlerAssetRef =
  | string
  | number
  | { uri: string; width?: number; height?: number };

function toUrl(input: BundlerAssetRef): string {
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input !== null && typeof input.uri === 'string') {
    return input.uri;
  }
  if (typeof input === 'number') {
    return Asset.fromModule(input as any).uri;
  }
  return String(input);
}

/**
 * Register a local bitmap font for loading via PixiJS Assets (web variant).
 *
 * Same signature as the native function — the values produced by `require()`
 * differ per platform but this helper accepts either form.
 *
 * @param fntFile - require() / URL for the .xml or .fnt file
 * @param pageFiles - require() / URLs for the atlas .png files, in page order
 * @returns A string key to pass to `Assets.load()`
 */
export function registerBitmapFont(
  fntFile: BundlerAssetRef,
  pageFiles: BundlerAssetRef[],
): string {
  const key = `${BMFONT_PREFIX}${bmfontCounter++}`;
  bitmapFontRegistry.set(key, {
    fntUrl: toUrl(fntFile),
    pageUrls: pageFiles.map(toUrl),
  });
  return key;
}

// =============================================================================
// LOADER EXTENSION
// =============================================================================

export const loadWebBitmapFont = {
  extension: {
    type: ExtensionType.LoadParser,
    priority: LoaderParserPriority.High,
    name: 'loadWebBitmapFont',
  },

  name: 'loadWebBitmapFont',

  test(url: string): boolean {
    return url.startsWith(BMFONT_PREFIX);
  },

  async testParse(data: string): Promise<boolean> {
    if (typeof data !== 'string') return false;
    return bitmapFontTextParser.test(data) || bitmapFontXMLStringParser.test(data);
  },

  async load(url: string): Promise<string> {
    const entry = bitmapFontRegistry.get(url);
    if (!entry) {
      throw new Error(`[loadWebBitmapFont] No registered bitmap font for key: ${url}`);
    }

    const response = await fetch(entry.fntUrl);
    if (!response.ok) {
      throw new Error(
        `[loadWebBitmapFont] Failed to fetch ${entry.fntUrl}: ${response.status} ${response.statusText}`,
      );
    }
    return response.text();
  },

  async parse(asset: string, data: ResolvedAsset, loader: Loader): Promise<any> {
    const bitmapFontData = bitmapFontTextParser.test(asset)
      ? bitmapFontTextParser.parse(asset)
      : bitmapFontXMLStringParser.parse(asset);

    const src = data.src ?? '';
    const entry = bitmapFontRegistry.get(src);
    if (!entry) {
      throw new Error(`[loadWebBitmapFont] No registered bitmap font for: ${src}`);
    }

    const { pages } = bitmapFontData;
    const textureOptions = bitmapFontData.distanceField
      ? {
          scaleMode: 'linear' as const,
          alphaMode: 'premultiply-alpha-on-upload' as const,
          autoGenerateMipmaps: false,
          resolution: 1,
        }
      : {};

    if (pages.length > entry.pageUrls.length) {
      throw new Error(
        `[loadWebBitmapFont] Font has ${pages.length} pages but only ${entry.pageUrls.length} page URL(s) were registered`,
      );
    }

    // `loadParser: 'loadTextures'` is needed because Metro web's dev-mode URLs
    // (`/assets/?unstable_path=...desyrel.png`) don't expose a recognisable
    // extension to PixiJS's parser dispatcher. Setting loadParser bypasses the
    // extension test entirely.
    const textureUrls: {
      src: string;
      loadParser: string;
      data: Record<string, any>;
    }[] = pages.map((_, i) => ({
      src: entry.pageUrls[i],
      loadParser: 'loadTextures',
      data: textureOptions,
    }));

    const loadedTextures = await loader.load(textureUrls);
    const textures = textureUrls.map((u) => loadedTextures[u.src]);

    const bitmapFont = new BitmapFont({ data: bitmapFontData, textures }, src);

    // Same Cache registration trick as the native loader: ensure BitmapText can
    // resolve the font by its family name without relying on the
    // bitmapFontCachePlugin (which doesn't fire reliably for custom loaders).
    Cache.set(`${bitmapFont.fontFamily}-bitmap`, bitmapFont);
    Cache.set(`${src}-bitmap`, bitmapFont);

    return bitmapFont;
  },

  async unload(bitmapFont: any, _resolvedAsset: ResolvedAsset, loader: Loader): Promise<void> {
    await Promise.all(
      bitmapFont.pages.map((page: any) => loader.unload(page.texture.source._sourceOrigin)),
    );
    bitmapFont.destroy();
  },
} as LoaderParser;

// Side effect: register the loader so consumers don't need to do it manually.
extensions.add(loadWebBitmapFont);
