/**
 * @fileoverview Main entry point for @penabt/pixi-expo library.
 *
 * This module provides a complete PixiJS v8 adapter for React Native Expo,
 * enabling hardware-accelerated 2D graphics using the expo-gl WebGL context.
 *
 * @module @penabt/pixi-expo
 * @author Pena Team
 * @license MIT
 *
 * @description
 * The adapter works by:
 * 1. Loading polyfills for browser APIs not available in React Native
 * 2. Setting up a custom DOMAdapter that bridges PixiJS to expo-gl
 * 3. Providing a React component (PixiView) that manages the GL context lifecycle
 * 4. Registering custom asset loaders for expo-asset and expo-font
 *
 * @example Basic Usage
 * ```tsx
 * import { PixiView, Graphics, Sprite, Assets } from '@penabt/pixi-expo';
 *
 * function GameScreen() {
 *   return (
 *     <PixiView
 *       backgroundColor={0x1099bb}
 *       onApplicationCreate={(app) => {
 *         // Create and add sprites, graphics, etc.
 *         const circle = new Graphics()
 *           .circle(100, 100, 50)
 *           .fill({ color: 0xff0000 });
 *         app.stage.addChild(circle);
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * @example Loading Assets
 * ```tsx
 * import { Assets, Sprite } from '@penabt/pixi-expo';
 *
 * // Load bundled asset
 * const texture = await Assets.load(require('./assets/bunny.png'));
 *
 * // Load remote asset
 * const remoteTexture = await Assets.load('https://example.com/sprite.png');
 * ```
 */

// =============================================================================
// PHASE 1: POLYFILLS
// Load browser API polyfills before any PixiJS code runs.
// This provides: document, window, requestAnimationFrame, HTMLCanvasElement, etc.
// =============================================================================

import './adapter/polyfills';

// =============================================================================
// PHASE 2: ADAPTER SETUP
// Import adapter components that don't depend on PixiJS.
// These provide the bridge between React Native and PixiJS.
// =============================================================================

import {
    ExpoAdapter,
    setActiveGLContext,
    getActiveCanvas,
    getActiveGL,
    clearActiveContext,
} from './adapter';
import { ExpoCanvasElement } from './adapter';

// =============================================================================
// PHASE 3: PIXIJS CONFIGURATION
// Now that polyfills are loaded, we can safely import from PixiJS
// and configure it to use our custom adapter.
// =============================================================================

import { DOMAdapter, extensions } from 'pixi.js';

// Set the custom adapter before any PixiJS rendering occurs
DOMAdapter.set(ExpoAdapter as any);

// =============================================================================
// PHASE 4: ASSET LOADERS
// Register custom loaders that use Expo's asset system.
// These must be registered after DOMAdapter is configured.
// =============================================================================

import { loadExpoAsset, loadTexture } from './adapter/loadExpoAsset';
import { loadExpoFont } from './adapter/loadExpoFont';

extensions.add(loadExpoAsset);
extensions.add(loadExpoFont);

// =============================================================================
// EXPORTS: ADAPTER UTILITIES
// Low-level adapter components for advanced use cases.
// =============================================================================

export {
    /** Custom DOMAdapter implementation for expo-gl */
    ExpoAdapter,
    /** Canvas element wrapper for expo-gl WebGL context */
    ExpoCanvasElement,
    /** Activate a GL context for PixiJS rendering */
    setActiveGLContext,
    /** Get the currently active canvas element */
    getActiveCanvas,
    /** Get the currently active WebGL context */
    getActiveGL,
    /** Clear the active context (called on unmount) */
    clearActiveContext,
};

// =============================================================================
// EXPORTS: ASSET LOADERS
// Custom PixiJS loader extensions for Expo's asset system.
// =============================================================================

export {
    /** Load textures using expo-asset (supports require() and URLs) */
    loadExpoAsset,
    /** Load a texture from require() module ID or URL (recommended for local assets) */
    loadTexture,
    /** Load fonts using expo-font */
    loadExpoFont,
};

// =============================================================================
// EXPORTS: REACT COMPONENTS
// High-level React Native components for easy integration.
// =============================================================================

export { PixiView } from './components/PixiView';
export type { PixiViewProps, PixiViewHandle } from './components/PixiView';

// =============================================================================
// EXPORTS: PIXIJS RE-EXPORTS
// Convenience re-exports from pixi.js for single-import usage.
// Users can import everything from '@penabt/pixi-expo' instead of 'pixi.js'.
// =============================================================================

export {
    // ---------------------------------------------------------------------------
    // Core Application
    // ---------------------------------------------------------------------------
    /** Main PixiJS application class */
    Application,

    // ---------------------------------------------------------------------------
    // Display Objects
    // ---------------------------------------------------------------------------
    /** Base container for display objects */
    Container,
    /** Sprite for displaying textures */
    Sprite,
    /** Vector graphics drawing */
    Graphics,
    /** Text rendering (requires canvas 2D - limited support) */
    Text,
    /** Repeating/tiling sprite */
    TilingSprite,
    /** Spritesheet animation */
    AnimatedSprite,
    /** Custom mesh geometry */
    Mesh,
    /** 9-slice scaling sprite */
    NineSliceSprite,

    // ---------------------------------------------------------------------------
    // Textures & Resources
    // ---------------------------------------------------------------------------
    /** GPU texture wrapper */
    Texture,
    /** Texture source data */
    TextureSource,
    /** Multiple textures from a single image */
    Spritesheet,
    /** Render to texture */
    RenderTexture,

    // ---------------------------------------------------------------------------
    // Asset Management
    // ---------------------------------------------------------------------------
    /** Asset loading and caching system */
    Assets,

    // ---------------------------------------------------------------------------
    // Geometry & Math
    // ---------------------------------------------------------------------------
    /** 2D transformation matrix */
    Matrix,
    /** 2D point */
    Point,
    /** Observable 2D point */
    ObservablePoint,
    /** Rectangle bounds */
    Rectangle,
    /** Circle shape */
    Circle,
    /** Ellipse shape */
    Ellipse,
    /** Polygon shape */
    Polygon,
    /** Rounded rectangle shape */
    RoundedRectangle,

    // ---------------------------------------------------------------------------
    // Filters & Effects
    // ---------------------------------------------------------------------------
    /** Base filter class */
    Filter,
    /** Gaussian blur filter */
    BlurFilter,
    /** Color adjustment filter */
    ColorMatrixFilter,
    /** Noise filter */
    NoiseFilter,
    /** Displacement map filter */
    DisplacementFilter,

    // ---------------------------------------------------------------------------
    // Text & Fonts
    // ---------------------------------------------------------------------------
    /** Pre-rendered bitmap font text */
    BitmapText,
    /** Text styling options */
    TextStyle,

    // ---------------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------------
    /** Batch rendering system */
    Batcher,

    // ---------------------------------------------------------------------------
    // Events & Interaction
    // ---------------------------------------------------------------------------
    /** Unified pointer/touch/mouse event */
    FederatedPointerEvent,
    /** Event boundary for hit testing */
    EventBoundary,

    // ---------------------------------------------------------------------------
    // Color
    // ---------------------------------------------------------------------------
    /** Color utility class */
    Color,

    // ---------------------------------------------------------------------------
    // Ticker & Animation
    // ---------------------------------------------------------------------------
    /** Frame-based animation ticker */
    Ticker,

    // ---------------------------------------------------------------------------
    // Extension System
    // ---------------------------------------------------------------------------
    /** Plugin/extension management */
    extensions,
    /** Extension type constants */
    ExtensionType,

    // ---------------------------------------------------------------------------
    // Adapter
    // ---------------------------------------------------------------------------
    /** DOM adapter for environment abstraction */
    DOMAdapter,
} from 'pixi.js';

// Re-export types for TypeScript users
export type {
    /** Application initialization options */
    ApplicationOptions,
    /** Texture creation options */
    TextureSourceOptions,
    /** Spritesheet data format */
    SpritesheetData,
    /** Filter options */
    FilterOptions,
    /** Renderer type */
    Renderer,
} from 'pixi.js';
