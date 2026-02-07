/**
 * @fileoverview Canvas element wrapper for expo-gl WebGL context.
 *
 * This class implements the HTMLCanvasElement interface expected by PixiJS,
 * bridging the gap between PixiJS's browser expectations and expo-gl's
 * React Native WebGL implementation.
 *
 * @module @penabt/pixi-expo/ExpoCanvasElement
 * @author Pena Team
 * @license MIT
 *
 * @description
 * PixiJS expects a canvas element with:
 * - width/height properties
 * - style object with CSS properties
 * - getContext() method returning WebGL context
 * - DOM methods (getBoundingClientRect, addEventListener, etc.)
 *
 * This class wraps the expo-gl WebGL context to satisfy these requirements.
 *
 * @example Usage with expo-gl
 * ```ts
 * import { GLView } from 'expo-gl';
 *
 * <GLView
 *   onContextCreate={(gl) => {
 *     const canvas = new ExpoCanvasElement(gl.drawingBufferWidth, gl.drawingBufferHeight);
 *     canvas.setGLContext(gl);
 *     // Canvas is now ready for PixiJS
 *   }}
 * />
 * ```
 */

import type { ExpoWebGLRenderingContext } from 'expo-gl';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** Supported context types for getContext() */
type ContextIds =
    | '2d'
    | 'bitmaprenderer'
    | 'webgl'
    | 'experimental-webgl'
    | 'webgl2'
    | 'experimental-webgl2';

// =============================================================================
// MOCK CANVAS STYLE
// CSS style object compatible with PixiJS canvas expectations.
// =============================================================================

/**
 * Mock CSSStyleDeclaration for canvas.style compatibility.
 *
 * PixiJS accesses properties like:
 * - style.position for positioning
 * - style.cursor for pointer styling
 * - style.touchAction for touch handling
 */
class MockCanvasStyle {
    // Position properties
    position: string = 'absolute';
    left: string = '0px';
    top: string = '0px';

    // Size properties
    width: string = '100%';
    height: string = '100%';

    // Display properties
    display: string = 'block';
    visibility: string = 'visible';
    opacity: string = '1';
    zIndex: string = '0';

    // Interaction properties
    cursor: string = 'default';
    touchAction: string = 'none';
    pointerEvents: string = 'auto';

    // Appearance properties
    backgroundColor: string = 'transparent';
    border: string = 'none';
    margin: string = '0';
    padding: string = '0';
    overflow: string = 'hidden';
    imageRendering: string = 'auto';

    // Transform properties
    transform: string = '';
    transformOrigin: string = 'center';

    /** Dynamic property index signature */
    [key: string]: any;

    /**
     * Set a CSS property value.
     * @param name - CSS property name
     * @param value - Property value
     * @param _priority - Optional priority (ignored)
     */
    setProperty(name: string, value: string, _priority?: string): void {
        this[name] = value;
    }

    /**
     * Get a CSS property value.
     * @param name - CSS property name
     * @returns Property value or empty string
     */
    getPropertyValue(name: string): string {
        return this[name] ?? '';
    }
}

// =============================================================================
// EXPO CANVAS ELEMENT
// Main canvas wrapper class for expo-gl integration.
// =============================================================================

/**
 * Canvas element wrapper for expo-gl WebGL context.
 *
 * Implements the ICanvas interface expected by PixiJS, providing:
 * - Width/height management with resize events
 * - WebGL context access via getContext()
 * - DOM-like event handling
 * - Style object for CSS compatibility
 *
 * @remarks
 * Only WebGL contexts are supported. Canvas 2D (getContext('2d')) is not
 * available in expo-gl. For 2D rendering, consider @shopify/react-native-skia.
 */
export class ExpoCanvasElement {
    // ===========================================================================
    // PUBLIC PROPERTIES
    // ===========================================================================

    /** CSS style object for PixiJS compatibility */
    public style: MockCanvasStyle = new MockCanvasStyle();

    /** Parent node reference (always null in RN) */
    public parentNode: any = null;

    /** Parent element reference (always null in RN) */
    public parentElement: any = null;

    // ===========================================================================
    // PRIVATE PROPERTIES
    // ===========================================================================

    /** Canvas width in pixels */
    private _width: number;

    /** Canvas height in pixels */
    private _height: number;

    /** expo-gl WebGL context */
    private _gl: ExpoWebGLRenderingContext | null = null;

    /** Event listeners storage */
    private _listeners: Map<string, Set<any>> = new Map();

    // ===========================================================================
    // CONSTRUCTOR
    // ===========================================================================

    /**
     * Create a new ExpoCanvasElement.
     *
     * @param width - Initial canvas width in pixels (default: 1)
     * @param height - Initial canvas height in pixels (default: 1)
     */
    constructor(width = 1, height = 1) {
        this._width = width;
        this._height = height;
    }

    // ===========================================================================
    // SIZE PROPERTIES
    // Width and height with automatic resize event dispatch.
    // ===========================================================================

    /** Canvas width in pixels */
    get width(): number {
        return this._width;
    }

    set width(value: number) {
        this._width = value;
        this.dispatchEvent({ type: 'resize' });
    }

    /** Canvas height in pixels */
    get height(): number {
        return this._height;
    }

    set height(value: number) {
        this._height = value;
        this.dispatchEvent({ type: 'resize' });
    }

    /** Client width (same as width in React Native) */
    get clientWidth(): number {
        return this._width;
    }

    /** Client height (same as height in React Native) */
    get clientHeight(): number {
        return this._height;
    }

    // ===========================================================================
    // BOUNDING RECT
    // Required for PixiJS event coordinate calculations.
    // ===========================================================================

    /**
     * Get the bounding client rectangle.
     * Used by PixiJS for event coordinate mapping.
     *
     * @returns DOMRect with canvas dimensions at origin
     */
    getBoundingClientRect(): DOMRect {
        return {
            x: 0,
            y: 0,
            width: this._width,
            height: this._height,
            top: 0,
            right: this._width,
            bottom: this._height,
            left: 0,
            toJSON: () => ({}),
        } as DOMRect;
    }

    // ===========================================================================
    // DOM COMPATIBILITY METHODS
    // No-op methods for DOM interface compatibility.
    // ===========================================================================

    /**
     * Remove element from parent.
     * No-op: React Native manages component lifecycle.
     */
    remove(): void {
        // No-op: In React Native, the GLView is managed by React
    }

    /**
     * Focus the element.
     * No-op: Not applicable in React Native.
     */
    focus(): void {
        // No-op
    }

    /**
     * Remove focus from the element.
     * No-op: Not applicable in React Native.
     */
    blur(): void {
        // No-op
    }

    // ===========================================================================
    // WEBGL CONTEXT MANAGEMENT
    // Core functionality for expo-gl integration.
    // ===========================================================================

    /**
     * Set the WebGL context from expo-gl.
     * Must be called after GLView.onContextCreate.
     *
     * @param gl - expo-gl WebGL context
     *
     * @example
     * ```ts
     * <GLView
     *   onContextCreate={(gl) => {
     *     canvas.setGLContext(gl);
     *   }}
     * />
     * ```
     */
    setGLContext(gl: ExpoWebGLRenderingContext): void {
        this._gl = gl;
    }

    /**
     * Get the expo-gl WebGL context.
     *
     * @returns The GL context, or null if not set
     */
    getGLContext(): ExpoWebGLRenderingContext | null {
        return this._gl;
    }

    /**
     * Get a rendering context (HTMLCanvasElement interface).
     *
     * Only WebGL contexts are supported in expo-gl.
     * Canvas 2D ('2d') is not supported.
     *
     * @param type - Context type ('webgl', 'webgl2', etc.)
     * @param _options - Context attributes (ignored)
     * @returns WebGL context or null
     */
    getContext(
        type: ContextIds,
        _options?: WebGLContextAttributes
    ): WebGLRenderingContext | null {
        switch (type) {
            case 'webgl':
            case 'experimental-webgl':
                if (!this._gl) {
                    console.warn(
                        'ExpoCanvasElement: WebGL context not available. ' +
                        'Make sure GLView.onContextCreate has been called first.'
                    );
                    return null;
                }
                return this._gl as unknown as WebGLRenderingContext;

            case '2d':
                console.warn(
                    'ExpoCanvasElement: 2D context is not supported in expo-gl. ' +
                    'Consider using @shopify/react-native-skia for 2D rendering.'
                );
                return null;

            case 'webgl2':
            case 'experimental-webgl2':
                console.warn(
                    'ExpoCanvasElement: WebGL2 is not fully supported in expo-gl. ' +
                    'Falling back to WebGL1.'
                );
                return this._gl as unknown as WebGLRenderingContext;

            default:
                return null;
        }
    }

    // ===========================================================================
    // DATA EXPORT METHODS
    // Limited support for canvas data export.
    // ===========================================================================

    /**
     * Convert canvas content to data URL.
     *
     * @param _type - Image MIME type (ignored)
     * @param _quality - Image quality 0-1 (ignored)
     * @returns Empty string (not fully implemented)
     *
     * @remarks
     * Full implementation would require reading pixels from GL context
     * and encoding to PNG/JPEG, which needs additional native modules.
     */
    toDataURL(_type?: string, _quality?: number): string {
        if (!this._gl) {
            console.warn('ExpoCanvasElement: Cannot create data URL without GL context');
            return '';
        }

        // Read pixels from the GL context
        const width = this._width;
        const height = this._height;
        const pixels = new Uint8Array(width * height * 4);

        this._gl.readPixels(0, 0, width, height, this._gl.RGBA, this._gl.UNSIGNED_BYTE, pixels);

        // Note: Full implementation would require encoding to PNG/JPEG
        console.warn(
            'ExpoCanvasElement: toDataURL requires additional implementation for encoding'
        );

        return '';
    }

    /**
     * Convert canvas content to Blob.
     * Not implemented in React Native.
     *
     * @param callback - Callback receiving null
     * @param _type - Image MIME type (ignored)
     * @param _quality - Image quality (ignored)
     */
    toBlob(
        callback: (blob: Blob | null) => void,
        _type?: string,
        _quality?: number
    ): void {
        console.warn('ExpoCanvasElement: toBlob is not implemented');
        callback(null);
    }

    // ===========================================================================
    // EVENT HANDLING
    // DOM-compatible event system for PixiJS interaction.
    // ===========================================================================

    /**
     * Add an event listener.
     *
     * @param type - Event type (e.g., 'resize', 'contextlost')
     * @param listener - Event handler function
     */
    addEventListener(type: string, listener: any): void {
        if (!this._listeners.has(type)) {
            this._listeners.set(type, new Set());
        }
        this._listeners.get(type)!.add(listener);
    }

    /**
     * Remove an event listener.
     *
     * @param type - Event type
     * @param listener - Event handler to remove (optional, removes all if omitted)
     */
    removeEventListener(type: string, listener?: any): void {
        if (!listener) {
            this._listeners.delete(type);
            return;
        }

        const listeners = this._listeners.get(type);
        if (listeners) {
            listeners.delete(listener);
        }
    }

    /**
     * Dispatch an event to registered listeners.
     *
     * @param event - Event object with type property
     * @returns true if event had listeners, false otherwise
     */
    dispatchEvent(event: { type: string;[key: string]: any }): boolean {
        const listeners = this._listeners.get(event.type);
        if (!listeners || listeners.size === 0) {
            return false;
        }

        event.target = this;

        listeners.forEach((listener) => {
            if (typeof listener === 'function') {
                listener(event);
            } else if (listener.handleEvent) {
                listener.handleEvent(event);
            }
        });

        return true;
    }

    // ===========================================================================
    // UNSUPPORTED METHODS
    // Methods that throw or warn about unsupported features.
    // ===========================================================================

    /**
     * Transfer control to offscreen canvas.
     * Not supported in React Native.
     *
     * @throws Always throws - feature not available
     */
    transferControlToOffscreen(): never {
        throw new Error('ExpoCanvasElement: transferControlToOffscreen is not supported');
    }
}
