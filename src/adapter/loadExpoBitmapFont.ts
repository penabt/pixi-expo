/**
 * Expo Bitmap Font Loader for PixiJS
 *
 * Handles loading bitmap fonts from local require() module IDs in React Native.
 * PixiJS's built-in loadBitmapFont uses fetch() + relative path resolution for
 * atlas textures, which doesn't work with Expo's bundled assets (hashed paths).
 *
 * IMPORTANT — Android release build caveat:
 *   Use `.fnt` (not `.xml`) for the font definition file. React Native's
 *   asset bundler treats `.xml` as an Android drawable resource and routes it
 *   through AAPT2, which compiles it into a binary XML format unreadable by
 *   text parsers. `.fnt` files are bundled as raw assets and round-trip cleanly.
 *   The PixiJS XML parser still works because the file *content* is valid XML.
 */

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import {
  Cache,
  ExtensionType,
  LoaderParserPriority,
  BitmapFont,
  bitmapFontTextParser,
  bitmapFontXMLStringParser,
} from 'pixi.js';

import type { Loader, LoaderParser, ResolvedAsset } from 'pixi.js';

import { materializeToFile, registerModuleId } from './loadExpoAsset';

// =============================================================================
// BITMAP FONT REGISTRY
// =============================================================================

const BMFONT_PREFIX = '__expo_bmfont_';

interface BitmapFontEntry {
  /** require() module ID for the XML/FNT file */
  xmlModuleId: number;
  /** require() module IDs for atlas page textures, in order */
  pageModuleIds: number[];
}

const bitmapFontRegistry = new Map<string, BitmapFontEntry>();
let bmfontCounter = 0;

/**
 * Register a local bitmap font for loading via PixiJS Assets.
 *
 * Because Expo bundles assets with hashed filenames (no directory structure),
 * the XML's internal `<page file="atlas.png"/>` reference can't be resolved
 * automatically. This function registers both the XML and its atlas page
 * textures so the loader can find them.
 *
 * @param xmlModuleId - require() result for the .xml or .fnt file
 * @param pageModuleIds - require() results for the atlas .png files, in page order
 * @returns A string key to pass to `Assets.load()`
 *
 * @example
 * ```ts
 * import { registerBitmapFont, Assets } from '@penabt/pixi-expo';
 *
 * const fontKey = registerBitmapFont(
 *   require('./assets/desyrel.xml'),
 *   [require('./assets/desyrel.png')]
 * );
 * await Assets.load(fontKey);
 *
 * // Now use it with BitmapText
 * const text = new BitmapText({
 *   text: 'Hello!',
 *   style: { fontFamily: 'Desyrel', fontSize: 36 },
 * });
 * ```
 */
export function registerBitmapFont(xmlModuleId: number, pageModuleIds: number[]): string {
  const key = `${BMFONT_PREFIX}${bmfontCounter++}`;
  bitmapFontRegistry.set(key, { xmlModuleId, pageModuleIds });
  return key;
}

// =============================================================================
// LOADER EXTENSION
// =============================================================================

/**
 * Expo Bitmap Font Loader
 *
 * A PixiJS LoadParser that handles local bitmap fonts registered via
 * registerBitmapFont(). Runs at High priority to intercept before
 * PixiJS's built-in loadBitmapFont (which can't handle module IDs).
 */
export const loadExpoBitmapFont = {
  extension: {
    type: ExtensionType.LoadParser,
    priority: LoaderParserPriority.High,
    name: 'loadExpoBitmapFont',
  },

  name: 'loadExpoBitmapFont',

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
      throw new Error(`[loadExpoBitmapFont] No registered bitmap font for key: ${url}`);
    }

    const expoAsset = Asset.fromModule(entry.xmlModuleId);
    await expoAsset.downloadAsync();
    const filePath = await materializeToFile(expoAsset);
    return new File(filePath).text();
  },

  async parse(asset: string, data: ResolvedAsset, loader: Loader): Promise<any> {
    if (__DEV__) console.log(`[loadExpoBitmapFont] parse() called, src=${data.src}`);

    // Parse the font data using PixiJS's built-in parsers
    const bitmapFontData = bitmapFontTextParser.test(asset)
      ? bitmapFontTextParser.parse(asset)
      : bitmapFontXMLStringParser.parse(asset);

    if (__DEV__) {
      console.log(
        `[loadExpoBitmapFont] Parsed font: ${bitmapFontData.fontFamily}, pages: ${bitmapFontData.pages.length}`,
      );
    }

    const src = data.src ?? '';
    const entry = bitmapFontRegistry.get(src);
    if (!entry) {
      throw new Error(`[loadExpoBitmapFont] No registered bitmap font for: ${src}`);
    }

    // Load atlas page textures from registered module IDs
    const { pages } = bitmapFontData;
    const textureOptions = bitmapFontData.distanceField
      ? {
          scaleMode: 'linear' as const,
          alphaMode: 'premultiply-alpha-on-upload' as const,
          autoGenerateMipmaps: false,
          resolution: 1,
        }
      : {};

    // Build texture load requests using registered page module IDs
    const textureUrls: { src: string; data: Record<string, any> }[] = [];

    for (let i = 0; i < pages.length; i++) {
      if (i >= entry.pageModuleIds.length) {
        throw new Error(
          `[loadExpoBitmapFont] Font has ${pages.length} pages but only ${entry.pageModuleIds.length} page module IDs were registered`,
        );
      }

      const pageKey = registerModuleId(entry.pageModuleIds[i]);
      textureUrls.push({ src: pageKey, data: textureOptions });

      if (__DEV__) {
        console.log(`[loadExpoBitmapFont] Page ${i}: ${pages[i].file} → ${pageKey}`);
      }
    }

    if (__DEV__)
      console.log(`[loadExpoBitmapFont] Loading ${textureUrls.length} page texture(s)...`);

    const loadedTextures = await loader.load(textureUrls);

    if (__DEV__) console.log(`[loadExpoBitmapFont] Page textures loaded`);

    const textures = textureUrls.map((url) => loadedTextures[url.src]);

    const bitmapFont = new BitmapFont({ data: bitmapFontData, textures }, src);

    // PixiJS's `bitmapFontCachePlugin` (a CacheParser extension) registers
    // the font under `${fontFamily}-bitmap` in the Cache, which is what
    // BitmapText looks up when resolving its `style.fontFamily`. That plugin
    // doesn't reliably fire for assets coming through our custom loader, so
    // register the keys ourselves — otherwise BitmapText falls back to a
    // dynamically-generated font and renders nothing for our glyphs.
    Cache.set(`${bitmapFont.fontFamily}-bitmap`, bitmapFont);
    Cache.set(`${src}-bitmap`, bitmapFont);

    if (__DEV__) {
      console.log(
        `[loadExpoBitmapFont] Loaded font "${bitmapFont.fontFamily}" with ${pages.length} page(s)`,
      );
    }

    return bitmapFont;
  },

  async unload(bitmapFont: any, _resolvedAsset: ResolvedAsset, loader: Loader): Promise<void> {
    await Promise.all(
      bitmapFont.pages.map((page: any) => loader.unload(page.texture.source._sourceOrigin)),
    );
    bitmapFont.destroy();
  },
} as LoaderParser;
