/**
 * @fileoverview PixiJS DOMAdapter implementation for expo-gl.
 *
 * This module provides the core adapter that bridges PixiJS's browser-based
 * architecture to React Native's expo-gl WebGL implementation.
 *
 * @module @penabt/pixi-expo/ExpoAdapter
 * @author Pena Team
 * @license MIT
 *
 * @description
 * PixiJS uses a DOMAdapter pattern to abstract browser APIs. This adapter
 * implements that interface for React Native:
 *
 * - createCanvas: Returns ExpoCanvasElement wrapping expo-gl context
 * - createImage: Returns image-like object for texture loading
 * - getWebGLRenderingContext: Returns WebGL constructor
 * - fetch: Handles remote and local asset URLs
 * - parseXML: Uses @xmldom/xmldom for SVG and other XML parsing
 *
 * @example Setting up the adapter
 * ```ts
 * import { ExpoAdapter, setActiveGLContext } from '@penabt/pixi-expo';
 * import { DOMAdapter } from 'pixi.js';
 *
 * // Set adapter before creating Application
 * DOMAdapter.set(ExpoAdapter);
 *
 * // In GLView.onContextCreate:
 * const canvas = setActiveGLContext(gl, width, height);
 * ```
 */

import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { ExpoCanvasElement } from './ExpoCanvasElement';
import { DOMParser } from '@xmldom/xmldom';

// =============================================================================
// MODULE STATE
// Tracks the currently active GL context for PixiJS rendering.
// =============================================================================

/** Currently active canvas element wrapper */
let activeCanvas: ExpoCanvasElement | null = null;

/** Currently active expo-gl WebGL context */
let activeGL: ExpoWebGLRenderingContext | null = null;

// =============================================================================
// CONTEXT MANAGEMENT FUNCTIONS
// Public API for managing the active GL context.
// =============================================================================

/**
 * Set the active GL context from expo-gl's GLView.
 *
 * This function must be called in GLView's onContextCreate callback
 * before creating any PixiJS Application or renderer.
 *
 * @param gl - The WebGL context from expo-gl
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @returns ExpoCanvasElement configured with the GL context
 *
 * @example
 * ```tsx
 * <GLView
 *   onContextCreate={(gl) => {
 *     const canvas = setActiveGLContext(
 *       gl,
 *       gl.drawingBufferWidth,
 *       gl.drawingBufferHeight
 *     );
 *     // canvas is now ready for PixiJS
 *   }}
 * />
 * ```
 */
export function setActiveGLContext(
  gl: ExpoWebGLRenderingContext,
  width: number,
  height: number,
): ExpoCanvasElement {
  activeCanvas = new ExpoCanvasElement(width, height);
  activeCanvas.setGLContext(gl);
  activeGL = gl;
  return activeCanvas;
}

/**
 * Get the currently active canvas element.
 *
 * @returns The active ExpoCanvasElement, or null if none is set
 */
export function getActiveCanvas(): ExpoCanvasElement | null {
  return activeCanvas;
}

/**
 * Get the currently active expo-gl WebGL context.
 *
 * @returns The active GL context, or null if none is set
 */
export function getActiveGL(): ExpoWebGLRenderingContext | null {
  return activeGL;
}

/**
 * Clear the active context.
 *
 * Should be called when the GLView unmounts to prevent memory leaks
 * and stale references.
 */
export function clearActiveContext(): void {
  activeCanvas = null;
  activeGL = null;
}

// =============================================================================
// EXPO ADAPTER
// Main adapter object implementing PixiJS's Adapter interface.
// =============================================================================

/**
 * PixiJS DOMAdapter implementation for React Native Expo.
 *
 * This object provides the bridge between PixiJS's browser expectations
 * and React Native's expo-gl environment. It's set as the active adapter
 * via `DOMAdapter.set(ExpoAdapter)`.
 *
 * @remarks
 * Key differences from browser adapter:
 * - Canvas 2D context is not supported (WebGL only)
 * - FontFaceSet is not available (use expo-font)
 * - Base URL is empty (use expo-asset for bundled resources)
 * - XML parsing uses @xmldom/xmldom instead of DOMParser
 */
export const ExpoAdapter = {
  // ===========================================================================
  // CANVAS CREATION
  // ===========================================================================

  /**
   * Create a canvas element for rendering.
   *
   * If an active canvas exists (from setActiveGLContext), returns it.
   * Otherwise creates a new ExpoCanvasElement that will need a GL context.
   *
   * @param width - Canvas width in pixels
   * @param height - Canvas height in pixels
   * @returns ExpoCanvasElement instance
   */
  createCanvas: (width?: number, height?: number): ExpoCanvasElement => {
    if (activeCanvas) {
      // Update dimensions if provided
      if (width !== undefined) activeCanvas.width = width;
      if (height !== undefined) activeCanvas.height = height;
      return activeCanvas;
    }

    // Create placeholder canvas (will need GL context later)
    return new ExpoCanvasElement(width ?? 1, height ?? 1);
  },

  // ===========================================================================
  // IMAGE CREATION
  // ===========================================================================

  /**
   * Create an image element for texture loading.
   *
   * Returns a minimal HTMLImageElement-like object. For actual texture
   * loading, use the loadExpoAsset loader extension which integrates
   * with expo-asset.
   *
   * @returns Object mimicking HTMLImageElement interface
   */
  createImage: (): any => {
    const image = {
      src: '',
      width: 0,
      height: 0,
      naturalWidth: 0,
      naturalHeight: 0,
      complete: false,
      crossOrigin: '' as string | null,
      onload: null as ((this: any, ev: Event) => any) | null,
      onerror: null as OnErrorEventHandler | null,

      /**
       * Setting source would trigger image loading.
       * Full implementation uses expo-asset or react-native Image.
       */
      set source(value: string) {
        this.src = value;
      },
    };

    return image;
  },

  // ===========================================================================
  // RENDERING CONTEXT ACCESS
  // ===========================================================================

  /**
   * Get the Canvas 2D rendering context constructor.
   *
   * @returns null - Canvas 2D is not supported in expo-gl
   *
   * @remarks
   * expo-gl only provides WebGL contexts. For 2D canvas operations,
   * consider using @shopify/react-native-skia as an alternative.
   */
  getCanvasRenderingContext2D: (): any => {
    console.warn('ExpoAdapter: 2D context is not supported in expo-gl');
    return null;
  },

  /**
   * Get the WebGL rendering context constructor.
   *
   * @returns WebGLRenderingContext constructor
   */
  getWebGLRenderingContext: (): typeof WebGLRenderingContext => {
    return WebGLRenderingContext;
  },

  // ===========================================================================
  // BROWSER API SHIMS
  // ===========================================================================

  /**
   * Get navigator information.
   *
   * Returns minimal navigator object for feature detection.
   * GPU access is not available in React Native.
   *
   * @returns Navigator-like object
   */
  getNavigator: (): { userAgent: string; gpu: GPU | null } => {
    return {
      userAgent: 'expo-gl/react-native',
      gpu: null,
    };
  },

  /**
   * Get the base URL for relative resource loading.
   *
   * @returns Empty string - React Native has no traditional base URL
   *
   * @remarks
   * For bundled assets, use expo-asset's Asset.fromModule(require('./file'))
   * instead of relative URLs.
   */
  getBaseUrl: (): string => {
    return '';
  },

  /**
   * Get the FontFaceSet for CSS font loading.
   *
   * @returns null - FontFaceSet is not available in React Native
   *
   * @remarks
   * Use expo-font's Font.loadAsync() for font loading in Expo apps.
   * The loadExpoFont loader extension provides PixiJS integration.
   */
  getFontFaceSet: (): FontFaceSet | null => {
    return null;
  },

  // ===========================================================================
  // NETWORK REQUESTS
  // ===========================================================================

  /**
   * Fetch a resource from network or local storage.
   *
   * Handles different URL schemes:
   * - http:// / https:// - Standard network fetch
   * - file:// - Local file (requires expo-file-system)
   * - asset:// - Bundled asset (requires expo-asset)
   *
   * @param url - Resource URL or Request object
   * @param options - Fetch options
   * @returns Promise resolving to Response
   *
   * @example
   * ```ts
   * const response = await ExpoAdapter.fetch('https://example.com/data.json');
   * const json = await response.json();
   * ```
   */
  fetch: async (url: RequestInfo, options?: RequestInit): Promise<Response> => {
    const requestUrl = typeof url === 'string' ? url : (url as Request).url;

    // Remote URL - use standard fetch
    if (requestUrl.startsWith('http://') || requestUrl.startsWith('https://')) {
      return fetch(requestUrl, options);
    }

    // Local file URL
    if (requestUrl.startsWith('file://')) {
      console.warn('ExpoAdapter: Local file loading requires expo-file-system');
      return fetch(requestUrl, options);
    }

    // Asset URL or require() number
    if (requestUrl.startsWith('asset://') || typeof url === 'number') {
      console.warn('ExpoAdapter: Asset loading requires expo-asset');
      throw new Error('Asset loading not implemented');
    }

    // Default - try standard fetch
    return fetch(requestUrl, options);
  },

  // ===========================================================================
  // XML PARSING
  // ===========================================================================

  /**
   * Parse an XML string into a Document.
   *
   * Uses @xmldom/xmldom since native DOMParser is not available
   * in React Native. Required for SVG and other XML asset parsing.
   *
   * @param xml - XML string to parse
   * @returns Parsed Document object
   *
   * @example
   * ```ts
   * const svg = '<svg>...</svg>';
   * const doc = ExpoAdapter.parseXML(svg);
   * ```
   */
  parseXML: (xml: string): Document => {
    const parser = new DOMParser();
    return parser.parseFromString(xml, 'text/xml') as unknown as Document;
  },
};
