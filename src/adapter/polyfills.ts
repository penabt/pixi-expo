/**
 * @fileoverview Browser API polyfills for React Native environment.
 *
 * PixiJS expects a browser environment with DOM APIs. This module provides
 * minimal polyfills that satisfy PixiJS requirements without full DOM implementation.
 *
 * @module @penabt/pixi-expo/polyfills
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
    callback: FrameRequestCallback,
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
  (globalThis as any).addEventListener = function (type: string, listener: EventListener): void {
    if (!globalListeners.has(type)) {
      globalListeners.set(type, new Set());
    }
    globalListeners.get(type)!.add(listener);
  };
}

if (typeof (globalThis as any).removeEventListener === 'undefined') {
  (globalThis as any).removeEventListener = function (type: string, listener: EventListener): void {
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
  setProperty: () => {},
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
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    removeChild: () => {},
    insertBefore: () => {},
    remove: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    hasAttribute: () => false,
    removeAttribute: () => {},
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
      add: () => {},
      remove: () => {},
      toggle: () => false,
      contains: () => false,
    },
    focus: () => {},
    blur: () => {},
    click: () => {},
    dispatchEvent: () => true,
  };

  // Video elements need canPlayType for PixiJS's video loader test()
  if (tagName.toLowerCase() === 'video') {
    element.canPlayType = () => '';
    element.play = () => Promise.resolve();
    element.pause = () => {};
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
      appendChild: () => {},
      removeChild: () => {},
      insertBefore: () => {},
    },
    head: {
      ...createMockElement('head'),
      appendChild: () => {},
      removeChild: () => {},
    },
    documentElement: {
      ...createMockElement('html'),
      style: createMockStyle(),
    },

    // Event handling
    // Event handling - unified with window/globalThis
    addEventListener: windowAddEventListener,
    removeEventListener: windowRemoveEventListener,
    dispatchEvent: () => true,

    // Font API (used by PixiJS text system)
    fonts: {
      add: () => {},
      delete: () => {},
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

// Window event listeners storage (separate from global)
const windowListeners = new Map<string, Set<any>>();

/**
 * Add event listener to window.
 */
function windowAddEventListener(type: string, listener: any, _options?: any): void {
  if (!windowListeners.has(type)) {
    windowListeners.set(type, new Set());
  }
  windowListeners.get(type)!.add(listener);
  if (__DEV__) {
    console.log(`[Window] addEventListener: ${type}, total: ${windowListeners.get(type)!.size}`);
  }
}

/**
 * Remove event listener from window.
 */
function windowRemoveEventListener(type: string, listener?: any, _options?: any): void {
  if (!listener) {
    windowListeners.delete(type);
    return;
  }
  const listeners = windowListeners.get(type);
  if (listeners) {
    listeners.delete(listener);
  }
}

/**
 * Dispatch an event to window listeners.
 * This is used by PixiView to forward touch events.
 */
export function dispatchWindowEvent(event: { type: string; [key: string]: any }): boolean {
  const listeners = windowListeners.get(event.type);

  if (__DEV__) {
    console.log(`[Window] dispatchEvent: ${event.type}, listeners: ${listeners?.size ?? 0}`);
  }

  if (!listeners || listeners.size === 0) {
    return false;
  }

  const listenersCopy = [...listeners];
  listenersCopy.forEach((listener) => {
    try {
      if (typeof listener === 'function') {
        listener(event);
      } else if (listener?.handleEvent) {
        listener.handleEvent(event);
      }
    } catch (error) {
      console.error('[Window] Error in event listener:', error);
    }
  });

  return true;
}

// Always ensure window exists
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

    // Event handling - actual implementation for PixiJS
    addEventListener: windowAddEventListener,
    removeEventListener: windowRemoveEventListener,
    dispatchEvent: dispatchWindowEvent,

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

    // Pointer/touch event support flags (PixiJS checks these)
    onpointerdown: null,
    onpointermove: null,
    onpointerup: null,
    onpointercancel: null,
    ontouchstart: null,
    ontouchmove: null,
    ontouchend: null,

    // PointerEvent constructor
    PointerEvent: (globalThis as any).PointerEvent,
  };
}

// Always override window event handling with our implementation
// This ensures PixiJS event listeners are captured even if window already existed
(globalThis as any).window.addEventListener = windowAddEventListener;
(globalThis as any).window.removeEventListener = windowRemoveEventListener;
(globalThis as any).window.dispatchEvent = dispatchWindowEvent;

// CRITICAL: Also override globalThis event handling
// PixiJS EventSystem uses globalThis.addEventListener directly for global move events
(globalThis as any).addEventListener = windowAddEventListener;
(globalThis as any).removeEventListener = windowRemoveEventListener;
(globalThis as any).dispatchEvent = dispatchWindowEvent;

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
    pause() {}
    // Required for PixiJS source type detection
    canPlayType(_type: string): string {
      return ''; // Empty string means not supported
    }
  };
}

// =============================================================================
// POINTER EVENT POLYFILL
// PixiJS EventSystem checks for PointerEvent support.
// =============================================================================

if (typeof (globalThis as any).PointerEvent === 'undefined') {
  (globalThis as any).PointerEvent = class PointerEvent {
    type: string;
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    button: number;
    buttons: number;
    clientX: number;
    clientY: number;
    pageX: number;
    pageY: number;
    screenX: number;
    screenY: number;
    width: number;
    height: number;
    pressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    target: any;
    currentTarget: any;
    timeStamp: number;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    nativeEvent: any;

    constructor(type: string, init?: any) {
      this.type = type;
      this.pointerId = init?.pointerId ?? 0;
      this.pointerType = init?.pointerType ?? 'touch';
      this.isPrimary = init?.isPrimary ?? true;
      this.button = init?.button ?? 0;
      this.buttons = init?.buttons ?? 1;
      this.clientX = init?.clientX ?? 0;
      this.clientY = init?.clientY ?? 0;
      this.pageX = init?.pageX ?? 0;
      this.pageY = init?.pageY ?? 0;
      this.screenX = init?.screenX ?? 0;
      this.screenY = init?.screenY ?? 0;
      this.width = init?.width ?? 1;
      this.height = init?.height ?? 1;
      this.pressure = init?.pressure ?? 0.5;
      this.tiltX = init?.tiltX ?? 0;
      this.tiltY = init?.tiltY ?? 0;
      this.twist = init?.twist ?? 0;
      this.target = init?.target ?? null;
      this.currentTarget = init?.currentTarget ?? null;
      this.timeStamp = init?.timeStamp ?? Date.now();
      this.bubbles = init?.bubbles ?? true;
      this.cancelable = init?.cancelable ?? true;
      this.defaultPrevented = false;
      this.nativeEvent = init?.nativeEvent ?? null;
    }

    preventDefault() {
      this.defaultPrevented = true;
    }
    stopPropagation() {}
    stopImmediatePropagation() {}
    getCoalescedEvents() {
      return [];
    }
    getPredictedEvents() {
      return [];
    }
  };
}

// =============================================================================
// TOUCH EVENT POLYFILL
// PixiJS may also check for TouchEvent support.
// =============================================================================

if (typeof (globalThis as any).TouchEvent === 'undefined') {
  (globalThis as any).TouchEvent = class TouchEvent {
    type: string;
    touches: any[];
    changedTouches: any[];
    targetTouches: any[];
    target: any;

    constructor(type: string, init?: any) {
      this.type = type;
      this.touches = init?.touches ?? [];
      this.changedTouches = init?.changedTouches ?? [];
      this.targetTouches = init?.targetTouches ?? [];
      this.target = init?.target ?? null;
    }

    preventDefault() {}
    stopPropagation() {}
  };
}

// =============================================================================
// EVENT SUPPORT FLAGS
// PixiJS checks for these to determine event support.
// =============================================================================

// Pointer event support flag (PixiJS checks 'onpointerdown' in globalThis)
if (!('onpointerdown' in globalThis)) {
  (globalThis as any).onpointerdown = null;
}
if (!('onpointermove' in globalThis)) {
  (globalThis as any).onpointermove = null;
}
if (!('onpointerup' in globalThis)) {
  (globalThis as any).onpointerup = null;
}
if (!('onpointercancel' in globalThis)) {
  (globalThis as any).onpointercancel = null;
}

// Touch event support flag (PixiJS may also check these)
if (!('ontouchstart' in globalThis)) {
  (globalThis as any).ontouchstart = null;
}
if (!('ontouchmove' in globalThis)) {
  (globalThis as any).ontouchmove = null;
}
if (!('ontouchend' in globalThis)) {
  (globalThis as any).ontouchend = null;
}

// =============================================================================
// LOGGING
// Confirm polyfills are loaded (useful for debugging).
// =============================================================================

console.log('PixiJS Expo Adapter: Polyfills loaded');
