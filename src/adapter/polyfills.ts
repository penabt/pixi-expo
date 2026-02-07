/**
 * @fileoverview Browser API polyfills for React Native environment.
 *
 * PixiJS expects a browser environment with DOM APIs. This module provides
 * minimal polyfills that satisfy PixiJS requirements without full DOM implementation.
 *
 * @module @pena/pixi-expo/polyfills
 * @internal This module is automatically loaded - do not import directly.
 *
 * @description
 * Polyfills provided:
 * - globalThis.requestAnimationFrame / cancelAnimationFrame
 * - globalThis.addEventListener / removeEventListener / dispatchEvent
 * - globalThis.document (createElement, body, head, etc.)
 * - globalThis.window (navigator, location, devicePixelRatio, etc.)
 * - Partial HTMLCanvasElement, HTMLImageElement support
 *
 * @remarks
 * These polyfills are intentionally minimal. They provide just enough
 * functionality for PixiJS to initialize and run, but not full browser
 * compatibility. Features like Canvas 2D context are not supported.
 */

// =============================================================================
// ANIMATION FRAME POLYFILLS
// React Native usually provides these, but we ensure they exist.
// =============================================================================

if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = function requestAnimationFrame(
        callback: FrameRequestCallback
    ): number {
        return setTimeout(() => callback(Date.now()), 1000 / 60) as unknown as number;
    };
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = function cancelAnimationFrame(handle: number): void {
        clearTimeout(handle);
    };
}

// =============================================================================
// GLOBAL EVENT LISTENER POLYFILLS
// Required for PixiJS event system initialization.
// =============================================================================

/** Storage for global event listeners */
const globalListeners = new Map<string, Set<EventListener>>();

if (typeof (globalThis as any).addEventListener === 'undefined') {
    (globalThis as any).addEventListener = function (
        type: string,
        listener: EventListener
    ): void {
        if (!globalListeners.has(type)) {
            globalListeners.set(type, new Set());
        }
        globalListeners.get(type)!.add(listener);
    };
}

if (typeof (globalThis as any).removeEventListener === 'undefined') {
    (globalThis as any).removeEventListener = function (
        type: string,
        listener: EventListener
    ): void {
        const listeners = globalListeners.get(type);
        if (listeners) {
            listeners.delete(listener);
        }
    };
}

if (typeof (globalThis as any).dispatchEvent === 'undefined') {
    (globalThis as any).dispatchEvent = function (event: Event): boolean {
        const listeners = globalListeners.get(event.type);
        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    listener(event);
                } catch (e) {
                    console.error('Error in event listener:', e);
                }
            });
        }
        return true;
    };
}

// =============================================================================
// MOCK STYLE FACTORY
// Creates CSSStyleDeclaration-like objects for DOM element compatibility.
// =============================================================================

/**
 * Creates a mock CSS style object.
 * PixiJS accesses canvas.style.position, style.width, etc.
 */
const createMockStyle = () => ({
    position: '',
    left: '',
    top: '',
    right: '',
    bottom: '',
    width: '',
    height: '',
    display: '',
    visibility: '',
    opacity: '',
    zIndex: '',
    cursor: '',
    touchAction: '',
    pointerEvents: '',
    backgroundColor: '',
    border: '',
    margin: '',
    padding: '',
    overflow: '',
    setProperty: () => { },
    getPropertyValue: () => '',
});

// =============================================================================
// MOCK ELEMENT FACTORY
// Creates HTMLElement-like objects for document.createElement compatibility.
// =============================================================================

/**
 * Creates a mock DOM element.
 * PixiJS creates canvas, div, video and other elements for various purposes.
 *
 * @param tagName - HTML tag name (canvas, div, video, etc.)
 * @returns Mock element with common DOM properties and methods
 */
const createMockElement = (tagName: string) => {
    const element: any = {
        tagName: tagName.toUpperCase(),
        style: createMockStyle(),
        getContext: () => null, // Canvas 2D not supported - use WebGL via expo-gl
        width: 0,
        height: 0,
        addEventListener: () => { },
        removeEventListener: () => { },
        appendChild: () => { },
        removeChild: () => { },
        insertBefore: () => { },
        remove: () => { },
        setAttribute: () => { },
        getAttribute: () => null,
        hasAttribute: () => false,
        removeAttribute: () => { },
        getBoundingClientRect: () => ({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            toJSON: () => ({}),
        }),
        parentNode: null,
        parentElement: null,
        childNodes: [],
        children: [],
        innerHTML: '',
        textContent: '',
        classList: {
            add: () => { },
            remove: () => { },
            toggle: () => false,
            contains: () => false,
        },
        focus: () => { },
        blur: () => { },
        click: () => { },
        dispatchEvent: () => true,
    };

    // Video elements need canPlayType for PixiJS's video loader test()
    if (tagName.toLowerCase() === 'video') {
        element.canPlayType = () => '';
        element.play = () => Promise.resolve();
        element.pause = () => { };
        element.videoWidth = 0;
        element.videoHeight = 0;
        element.paused = true;
        element.ended = false;
        element.src = '';
    }

    return element;
};

// =============================================================================
// DOCUMENT POLYFILL
// Minimal document object for PixiJS initialization.
// =============================================================================

if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
        // Element creation
        createElement: createMockElement,
        createElementNS: (_namespace: string, tagName: string) => createMockElement(tagName),
        createComment: () => createMockElement('comment'),
        createTextNode: () => ({ textContent: '' }),

        // Document structure
        body: {
            ...createMockElement('body'),
            appendChild: () => { },
            removeChild: () => { },
            insertBefore: () => { },
        },
        head: {
            ...createMockElement('head'),
            appendChild: () => { },
            removeChild: () => { },
        },
        documentElement: {
            ...createMockElement('html'),
            style: createMockStyle(),
        },

        // Event handling
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => true,

        // Font API (used by PixiJS text system)
        fonts: {
            add: () => { },
            delete: () => { },
            check: () => true,
            ready: Promise.resolve(),
        },

        // Document properties
        baseURI: '',
        URL: '',
        location: { href: '' },
        readyState: 'complete',

        // Query methods (return empty results)
        getElementById: () => null,
        getElementsByTagName: () => [],
        getElementsByClassName: () => [],
        querySelector: () => null,
        querySelectorAll: () => [],
    };
}

// =============================================================================
// WINDOW POLYFILL
// Minimal window object for PixiJS initialization.
// =============================================================================

if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
        ...globalThis,
        document: (globalThis as any).document,

        // Navigator (used for feature detection)
        navigator: {
            userAgent: 'expo-gl/react-native',
            platform: 'ReactNative',
            language: 'en',
            languages: ['en'],
            onLine: true,
            maxTouchPoints: 10,
        },

        // Location (used for asset URL resolution)
        location: {
            href: '',
            protocol: 'https:',
            host: '',
            hostname: '',
            pathname: '/',
        },

        // Event handling
        addEventListener: () => { },
        removeEventListener: () => { },

        // Animation
        requestAnimationFrame: globalThis.requestAnimationFrame,
        cancelAnimationFrame: globalThis.cancelAnimationFrame,

        // Display properties
        devicePixelRatio: 1,
        innerWidth: 0,
        innerHeight: 0,
        outerWidth: 0,
        outerHeight: 0,

        // Scroll (not applicable in RN)
        scrollX: 0,
        scrollY: 0,
        pageXOffset: 0,
        pageYOffset: 0,

        // Performance timing
        performance: globalThis.performance,
    };
}

// =============================================================================
// HTML ELEMENT CONSTRUCTOR POLYFILLS
// PixiJS checks for these constructors to determine environment capabilities.
// =============================================================================

if (typeof (globalThis as any).HTMLCanvasElement === 'undefined') {
    (globalThis as any).HTMLCanvasElement = class HTMLCanvasElement {
        width = 0;
        height = 0;
        style = createMockStyle();
        getContext() {
            return null;
        }
    };
}

if (typeof (globalThis as any).HTMLImageElement === 'undefined') {
    (globalThis as any).HTMLImageElement = class HTMLImageElement {
        src = '';
        width = 0;
        height = 0;
        complete = false;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
    };
}

if (typeof (globalThis as any).HTMLVideoElement === 'undefined') {
    (globalThis as any).HTMLVideoElement = class HTMLVideoElement {
        src = '';
        width = 0;
        height = 0;
        videoWidth = 0;
        videoHeight = 0;
        paused = true;
        ended = false;
        play() {
            return Promise.resolve();
        }
        pause() { }
        // Required for PixiJS source type detection
        canPlayType(_type: string): string {
            return ''; // Empty string means not supported
        }
    };
}

// =============================================================================
// LOGGING
// Confirm polyfills are loaded (useful for debugging).
// =============================================================================

console.log('PixiJS Expo Adapter: Polyfills loaded');
