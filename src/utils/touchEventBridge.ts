/**
 * @fileoverview Bridge between React Native touch events and PixiJS pointer events.
 *
 * This module converts React Native GestureResponder touch events into
 * PointerEvent-like objects that PixiJS's EventSystem can process.
 *
 * @module @penabt/pixi-expo/touchEventBridge
 * @author Pena Team
 * @license MIT
 */

import { type GestureResponderEvent, type NativeTouchEvent, PixelRatio } from 'react-native';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * PointerEvent-like object compatible with PixiJS EventSystem.
 * Implements the subset of PointerEvent interface that PixiJS requires.
 */
export interface NativePointerEvent {
  /** Unique identifier for this pointer/touch */
  pointerId: number;
  /** Pointer type: 'touch', 'mouse', or 'pen' */
  pointerType: 'touch' | 'mouse' | 'pen';
  /** Whether this is the primary pointer */
  isPrimary: boolean;
  /** Mouse button (0 for touch) */
  button: number;
  /** Bitmask of pressed buttons */
  buttons: number;
  /** X coordinate relative to viewport */
  clientX: number;
  /** Y coordinate relative to viewport */
  clientY: number;
  /** X coordinate relative to screen */
  screenX: number;
  /** Y coordinate relative to screen */
  screenY: number;
  /** X coordinate relative to page (same as client for RN) */
  pageX: number;
  /** Y coordinate relative to page (same as client for RN) */
  pageY: number;
  /** X offset from target element */
  offsetX: number;
  /** Y offset from target element */
  offsetY: number;
  /** Layer X coordinate */
  layerX: number;
  /** Layer Y coordinate */
  layerY: number;
  /** X coordinate change since last event */
  movementX: number;
  /** Y coordinate change since last event */
  movementY: number;
  /** Touch/pen pressure (0-1) */
  pressure: number;
  /** Touch width */
  width: number;
  /** Touch height */
  height: number;
  /** Tilt angle X */
  tiltX: number;
  /** Tilt angle Y */
  tiltY: number;
  /** Pen twist angle */
  twist: number;
  /** Original timestamp */
  timeStamp: number;
  /** Event type */
  type: string;
  /** Target element (canvas) */
  target: any;
  /** Current target element */
  currentTarget: any;
  /** Window reference */
  view: any;
  /** Event detail */
  detail: number;
  /** Does the event bubble */
  bubbles: boolean;
  /** Can the event be canceled */
  cancelable: boolean;
  /** Is event trusted */
  isTrusted: boolean;
  /** Has default been prevented */
  defaultPrevented: boolean;
  /** Event phase */
  eventPhase: number;
  /** Prevent default behavior */
  preventDefault: () => void;
  /** Stop propagation */
  stopPropagation: () => void;
  /** Stop immediate propagation */
  stopImmediatePropagation: () => void;
  /** Native event reference */
  nativeEvent: NativeTouchEvent;
  /** Global coordinates (for PixiJS) */
  global?: { x: number; y: number };
  /** Get coalesced events */
  getCoalescedEvents: () => NativePointerEvent[];
  /** Get predicted events */
  getPredictedEvents: () => NativePointerEvent[];
}

/**
 * Options for creating pointer events
 */
export interface TouchEventBridgeOptions {
  /** Canvas element to use as target */
  canvas: any;
  /** Resolution/scale factor */
  resolution?: number;
  /** Canvas offset X from screen origin */
  offsetX?: number;
  /** Canvas offset Y from screen origin */
  offsetY?: number;
}

// =============================================================================
// TOUCH TRACKING
// Store previous positions for movement calculation
// =============================================================================

const touchPositions: Map<number, { x: number; y: number }> = new Map();

// =============================================================================
// POINTER EVENT CREATION
// =============================================================================

/**
 * Create a PointerEvent-like object from a React Native touch.
 *
 * @param touch - React Native touch object
 * @param eventType - PixiJS event type ('pointerdown', 'pointermove', 'pointerup', etc.)
 * @param options - Bridge configuration options
 * @param isPrimary - Whether this is the primary touch
 * @param nativeEvent - The original native touch event
 * @returns PointerEvent-like object for PixiJS
 */
function createPointerEvent(
  touch: {
    identifier: number;
    pageX: number;
    pageY: number;
    locationX?: number;
    locationY?: number;
  },
  eventType: string,
  options: TouchEventBridgeOptions,
  isPrimary: boolean,
  nativeEvent: NativeTouchEvent,
): NativePointerEvent {
  const { canvas, offsetX = 0, offsetY = 0 } = options;

  // Calculate coordinates relative to canvas
  // In React Native, locationX/Y are relative to the touched view, which is our PixiView.
  // They are in logical points. We convert to physical pixels for PixiJS if needed.
  const ratio = PixelRatio.get();
  const x = (touch.locationX ?? touch.pageX - offsetX) * ratio;
  const y = (touch.locationY ?? touch.pageY - offsetY) * ratio;

  // Calculate movement from previous position
  const prevPos = touchPositions.get(touch.identifier);
  const movementX = prevPos ? x - prevPos.x : 0;
  const movementY = prevPos ? y - prevPos.y : 0;

  // Update stored position
  if (eventType === 'pointerup' || eventType === 'pointercancel') {
    touchPositions.delete(touch.identifier);
  } else {
    touchPositions.set(touch.identifier, { x, y });
  }

  // Determine button state
  const isDown = eventType === 'pointerdown';
  const isUp = eventType === 'pointerup' || eventType === 'pointercancel';
  const button = isDown || isUp ? 0 : -1; // 0 = left button for down/up, -1 for move
  const buttons = isUp ? 0 : 1; // 1 = left button pressed while touching

  // Create the event object with all required properties
  const pointerEvent: NativePointerEvent = {
    // Pointer identification
    pointerId: touch.identifier,
    pointerType: 'touch',
    isPrimary,

    // Button state
    button,
    buttons,

    // Coordinates
    clientX: x,
    clientY: y,
    screenX: touch.pageX,
    screenY: touch.pageY,
    pageX: x,
    pageY: y,
    offsetX: x,
    offsetY: y,
    layerX: x,
    layerY: y,
    movementX,
    movementY,

    // Touch properties
    pressure: isUp ? 0 : 0.5,
    width: 23,
    height: 23,
    tiltX: 0,
    tiltY: 0,
    twist: 0,

    // Event metadata
    timeStamp: nativeEvent.timestamp ?? Date.now(),
    type: eventType,
    target: canvas,
    currentTarget: canvas,
    view: typeof globalThis !== 'undefined' ? (globalThis as any).window : null,
    detail: 0,

    // Event flags
    bubbles: true,
    cancelable: true,
    isTrusted: true,
    defaultPrevented: false,
    eventPhase: 2, // AT_TARGET

    // Methods
    preventDefault: () => {
      pointerEvent.defaultPrevented = true;
    },
    stopPropagation: () => {},
    stopImmediatePropagation: () => {},

    // Native reference
    nativeEvent,

    // PixiJS specific
    global: { x, y },

    // Coalesced/predicted events
    getCoalescedEvents: () => [],
    getPredictedEvents: () => [],
  };

  return pointerEvent;
}

// =============================================================================
// EVENT CONVERSION
// =============================================================================

/**
 * Convert a React Native GestureResponderEvent to PointerEvent-like objects.
 *
 * @param event - React Native gesture responder event
 * @param eventType - PixiJS event type ('pointerdown', 'pointermove', 'pointerup', 'pointercancel')
 * @param options - Bridge configuration options
 * @returns Array of PointerEvent-like objects (one per touch point)
 */
export function convertTouchToPointerEvents(
  event: GestureResponderEvent,
  eventType: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  options: TouchEventBridgeOptions,
): NativePointerEvent[] {
  const { nativeEvent } = event;
  const touches = nativeEvent.changedTouches ?? [nativeEvent];
  const allTouches = nativeEvent.touches ?? [];

  // For multi-touch, the first touch in the list is primary
  const primaryIdentifier =
    allTouches.length > 0 ? allTouches[0].identifier : (touches[0]?.identifier ?? 0);

  return touches.map((touch: any) => {
    const isPrimary = touch.identifier === primaryIdentifier;
    return createPointerEvent(touch, eventType, options, isPrimary, nativeEvent);
  });
}

/**
 * Clear all tracked touch positions.
 * Call this when the component unmounts or touch tracking needs to be reset.
 */
export function clearTouchTracking(): void {
  touchPositions.clear();
}

/**
 * Get the number of currently tracked touches.
 * Useful for debugging multi-touch scenarios.
 */
export function getActiveTouchCount(): number {
  return touchPositions.size;
}
