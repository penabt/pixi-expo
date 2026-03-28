/**
 * Expo Bitmap Font Loader for PixiJS
 *
 * Handles loading bitmap fonts (.xml/.fnt) from local require() module IDs
 * in React Native. PixiJS's built-in loadBitmapFont uses fetch() + relative
 * path resolution for atlas textures, which doesn't work with Expo's bundled
 * assets (hashed file paths, no directory structure).
 *
 * This loader:
 * 1. Resolves the XML/FNT module ID to a local URI via expo-asset
 * 2. Reads the font data via fetch on the local URI
 * 3. Parses the font data using PixiJS's built-in parsers
 * 4. Resolves atlas page textures from pre-registered module IDs
 * 5. Creates a BitmapFont with the loaded textures
 */

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform, NativeModules } from 'react-native';
import {
  ExtensionType,
  LoaderParserPriority,
  BitmapFont,
  bitmapFontTextParser,
  bitmapFontXMLStringParser,
} from 'pixi.js';

import type { Loader, LoaderParser, ResolvedAsset } from 'pixi.js';

import { registerModuleId } from './loadExpoAsset';

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
/** Read text from a URI using the most appropriate method */
async function readTextFromUri(uri: string): Promise<string> {
  console.log(`[bmfont] readTextFromUri: ${uri}`);

  // android_asset or http(s) → use fetch (RN's fetch supports file:///android_asset/)
  if (uri.startsWith('file:///android_asset/') || uri.startsWith('http://') || uri.startsWith('https://')) {
    console.log(`[bmfont] Using fetch for: ${uri}`);
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${uri}`);
    const text = await response.text();
    console.log(`[bmfont] Fetch OK, length: ${text.length}`);
    return text;
  }

  // file:// or absolute path → use expo-file-system File API
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    const fileUri = uri.startsWith('/') ? `file://${uri}` : uri;
    console.log(`[bmfont] Using File API for: ${fileUri}`);
    const file = new File(fileUri);
    const content = await file.text();
    console.log(`[bmfont] File read OK, length: ${content.length}`);
    return content;
  }

  throw new Error(`Unsupported URI scheme: ${uri.substring(0, 30)}`);
}

/**
 * Get Metro dev server base URL from the JS bundle source URL.
 * Returns null if not available (e.g., production build).
 */
function getMetroBaseUrl(): string | null {
  try {
    const scriptURL: string | undefined =
      NativeModules.SourceCode?.getConstants?.()?.scriptURL ??
      (NativeModules.SourceCode as any)?.scriptURL;
    if (scriptURL) {
      // scriptURL is like "http://192.168.1.105:8081/index.bundle?platform=android&..."
      const match = scriptURL.match(/^(https?:\/\/[^/]+)/);
      if (match) return match[1];
    }
  } catch {}
  return null;
}

/**
 * Generate candidate URIs for reading a font asset on Android.
 * Includes both Metro HTTP URLs (dev) and APK asset paths (prod).
 */
function getAndroidAssetCandidates(asset: Asset): string[] {
  const candidates: string[] = [];
  const name = asset.name;
  const type = asset.type;
  const hash = asset.hash;

  // In dev builds, Metro serves assets over HTTP
  const metroBase = getMetroBaseUrl();
  if (metroBase && name && type) {
    // Metro asset URL patterns
    candidates.push(`${metroBase}/assets/assets/fonts/${name}.${type}?platform=android`);
    candidates.push(`${metroBase}/assets/fonts/${name}.${type}?platform=android`);
  }

  // file:///android_asset/ patterns for production builds
  if (name && type) {
    candidates.push(`file:///android_asset/assets/fonts/${name}.${type}`);
    candidates.push(`file:///android_asset/fonts/${name}.${type}`);
    candidates.push(`file:///android_asset/${name}.${type}`);
  }
  if (hash && type) {
    candidates.push(`file:///android_asset/${hash}.${type}`);
  }

  return candidates;
}

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
    const errors: string[] = [];

    console.log(`[bmfont] === Loading ${url} ===`);
    console.log(`[bmfont] moduleId: ${entry.xmlModuleId}`);
    console.log(`[bmfont] name: ${expoAsset.name}`);
    console.log(`[bmfont] type: ${expoAsset.type}`);
    console.log(`[bmfont] hash: ${expoAsset.hash}`);
    console.log(`[bmfont] localUri: ${expoAsset.localUri}`);
    console.log(`[bmfont] uri: ${expoAsset.uri}`);
    console.log(`[bmfont] downloaded: ${expoAsset.downloaded}`);
    console.log(`[bmfont] Platform: ${Platform.OS}`);

    // Strategy 1: localUri already available (iOS native builds)
    if (expoAsset.localUri) {
      console.log(`[bmfont] Strategy 1: localUri`);
      try {
        return await readTextFromUri(expoAsset.localUri);
      } catch (e: any) { console.log(`[bmfont] Strategy 1 FAILED: ${e.message}`); errors.push(`localUri: ${e.message}`); }
    }

    // Strategy 2: Android bundled asset — try multiple path patterns
    if (Platform.OS === 'android') {
      const candidates = getAndroidAssetCandidates(expoAsset);
      console.log(`[bmfont] Strategy 2: trying ${candidates.length} android_asset candidates`);
      console.log(`[bmfont] httpServerLocation: ${(expoAsset as any).httpServerLocation}`);
      for (const candidate of candidates) {
        try {
          console.log(`[bmfont] Trying: ${candidate}`);
          const content = await readTextFromUri(candidate);
          console.log(`[bmfont] SUCCESS with: ${candidate}`);
          return content;
        } catch (e: any) {
          console.log(`[bmfont] Failed: ${candidate} → ${e.message}`);
        }
      }
      errors.push(`android_asset: all ${candidates.length} candidates failed`);
    }

    // Strategy 3: downloadAsync → localUri (works in Expo Go / dev client)
    console.log(`[bmfont] Strategy 3: downloadAsync`);
    try {
      await expoAsset.downloadAsync();
      console.log(`[bmfont] downloadAsync OK, localUri: ${expoAsset.localUri}`);
      const uri = expoAsset.localUri || expoAsset.uri;
      if (uri) return await readTextFromUri(uri);
    } catch (e: any) { console.log(`[bmfont] Strategy 3 FAILED: ${e.message}`); errors.push(`downloadAsync: ${e.message}`); }

    // Strategy 4: expo-asset uri (may be HTTP in dev, or asset:// scheme)
    if (expoAsset.uri) {
      console.log(`[bmfont] Strategy 4: uri → ${expoAsset.uri}`);
      try {
        return await readTextFromUri(expoAsset.uri);
      } catch (e: any) { console.log(`[bmfont] Strategy 4 FAILED: ${e.message}`); errors.push(`uri(${expoAsset.uri.substring(0, 50)}): ${e.message}`); }
    }

    throw new Error(`[loadExpoBitmapFont] All strategies failed for ${url}: ${errors.join('; ')}`);
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
