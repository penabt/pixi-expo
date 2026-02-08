/**
 * @fileoverview Adapter module exports.
 *
 * This barrel file exports all adapter components for the @penabt/pixi-expo package.
 * These are the low-level building blocks that bridge PixiJS to expo-gl.
 *

 * @module @penabt/pixi-expo/adapter
 */

// =============================================================================
// EXPO ADAPTER
// Main DOMAdapter implementation for PixiJS.
// =============================================================================

export {
  /** DOMAdapter implementation for expo-gl */
  ExpoAdapter,
  /** Activate GL context from expo-gl */
  setActiveGLContext,
  /** Get the currently active canvas */
  getActiveCanvas,
  /** Get the currently active GL context */
  getActiveGL,
  /** Clear active context on unmount */
  clearActiveContext,
} from './ExpoAdapter';

// =============================================================================
// EXPO CANVAS ELEMENT
// HTMLCanvasElement wrapper for expo-gl context.
// =============================================================================

export { ExpoCanvasElement } from './ExpoCanvasElement';

// =============================================================================
// POLYFILL UTILITIES
// Functions for dispatching events to polyfilled globals.
// =============================================================================

export { dispatchWindowEvent } from './polyfills';

// =============================================================================
// NOTES
// =============================================================================

/**
 * Asset loaders (loadExpoAsset, loadExpoFont) are NOT exported from this
 * barrel file. They must be imported AFTER DOMAdapter is configured to
 * prevent PixiJS initialization errors.
 *
 * Correct import order in index.ts:
 * 1. Import polyfills
 * 2. Import adapter components (this file)
 * 3. Import from pixi.js and set DOMAdapter
 * 4. Import and register loaders
 *
 * @see src/index.ts for the correct initialization sequence.
 */
