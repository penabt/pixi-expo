/**
 * Expo Font Loader for PixiJS
 *
 * This extension uses expo-font to load fonts in React Native.
 * Fonts loaded with this extension can be used with PixiJS Text objects.
 *
 * Note: For best results with PixiJS, consider using BitmapFont instead
 * of dynamic text rendering, as expo-gl doesn't have 2D canvas context.
 */

import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import { ExtensionType } from 'pixi.js';

import type { LoaderParser, ResolvedAsset } from 'pixi.js';

const validFontExtensions = ['.ttf', '.otf', '.woff', '.woff2'];

/**
 * Font loading data interface
 */
interface FontLoadData {
  /** Font family name to register */
  family?: string;
  /** Font weights to register */
  weights?: string[];
  /** Font style (normal, italic) */
  style?: string;
}

/**
 * Get file extension from a path
 */
function getExtension(url: string | number): string {
  if (typeof url === 'number') {
    return '.ttf'; // Default for bundled fonts
  }

  const cleanUrl = url.split('?')[0].split('#')[0];
  const lastDot = cleanUrl.lastIndexOf('.');

  if (lastDot === -1) return '';

  return cleanUrl.substring(lastDot).toLowerCase();
}

/**
 * Get font family name from URL
 */
function getFontFamilyName(url: string | number): string {
  if (typeof url === 'number') {
    return `font_${url}`;
  }

  const cleanUrl = url.split('?')[0].split('#')[0];
  const lastSlash = Math.max(cleanUrl.lastIndexOf('/'), cleanUrl.lastIndexOf('\\'));
  const filename = cleanUrl.substring(lastSlash + 1);
  const lastDot = filename.lastIndexOf('.');

  if (lastDot === -1) return filename;

  return filename.substring(0, lastDot);
}

/**
 * Check if the URL is a require() module ID
 */
function isModuleId(url: any): url is number {
  return typeof url === 'number';
}

/**
 * Expo Font Loader
 *
 * Loads fonts using expo-font for React Native compatibility.
 */
export const loadExpoFont = {
  extension: ExtensionType.LoadParser,

  name: 'loadExpoFont',

  /**
   * Test if this loader can handle the given URL
   */
  test(url: string | number): boolean {
    if (isModuleId(url)) {
      // Can't determine file type from module ID alone
      // Fonts should typically be loaded with explicit extension
      return false;
    }

    const ext = getExtension(url);

    return validFontExtensions.includes(ext);
  },

  /**
   * Load a font using expo-font
   */
  async load(url: string | number, asset?: ResolvedAsset<FontLoadData>): Promise<string> {
    const familyName = asset?.data?.family || getFontFamilyName(url);

    try {
      let fontSource: any;

      if (isModuleId(url)) {
        // Handle require() module ID
        fontSource = url;
      } else {
        // Handle URL - need to download first using expo-asset
        const expoAsset = Asset.fromURI(url as string);
        await expoAsset.downloadAsync();
        fontSource = expoAsset.localUri || url;
      }

      // Load font using expo-font
      await Font.loadAsync({
        [familyName]: fontSource,
      });

      console.log(`Font loaded: ${familyName}`);

      // Return the font family name
      return familyName;
    } catch (error) {
      console.error(`Failed to load font: ${url}`, error);
      throw error;
    }
  },

  /**
   * Unload a font
   * Note: expo-font doesn't have an unload API
   */
  unload(fontFamily: string): void {
    console.warn(`Font unloading is not supported in expo-font: ${fontFamily}`);
  },
} as LoaderParser<string>;

// Note: Registration is done in index.ts after DOMAdapter is set
// extensions.add(loadExpoFont);
