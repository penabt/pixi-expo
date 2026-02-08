/**
 * @fileoverview React Native component for rendering PixiJS content.
 *
 * PixiView is the main component for integrating PixiJS into Expo applications.
 * It handles GL context management, the render loop, and provides convenient
 * callbacks for application setup.
 *
 * @module @penabt/pixi-expo/PixiView
 * @author Pena Team
 * @license MIT
 *
 * @example Basic Usage
 * ```tsx
 * import { PixiView, Graphics } from '@penabt/pixi-expo';
 *
 * function GameScreen() {
 *   return (
 *     <PixiView
 *       backgroundColor={0x1099bb}
 *       onApplicationCreate={(app) => {
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
 * @example With Ref for Imperative Control
 * ```tsx
 * const pixiRef = useRef<PixiViewHandle>(null);
 *
 * const handleScreenshot = async () => {
 *   const data = await pixiRef.current?.takeSnapshot();
 *   console.log('Screenshot:', data);
 * };
 *
 * <PixiView ref={pixiRef} onApplicationCreate={...} />
 * ```
 */

import { useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  StyleSheet,
  LayoutChangeEvent,
  GestureResponderEvent,
  PixelRatio,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import { GLView } from 'expo-gl';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { Application, Container } from 'pixi.js';
import { setActiveGLContext, clearActiveContext, dispatchWindowEvent } from '../adapter';
import {
  convertTouchToPointerEvents,
  clearTouchTracking,
  type NativePointerEvent,
} from '../utils/touchEventBridge';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Props for the PixiView component.
 */
export interface PixiViewProps {
  /**
   * Custom styles for the container view.
   * Use this to control the component's size and positioning.
   *
   * @default { flex: 1 }
   */
  style?: ViewStyle;

  /**
   * Background color for the PixiJS application.
   * Accepts a hex number (e.g., 0x1099bb).
   *
   * @default 0x000000 (black)
   */
  backgroundColor?: number;

  /**
   * Resolution / device pixel ratio.
   * Higher values = sharper rendering but more GPU load.
   *
   * @default 1
   */
  resolution?: number;

  /**
   * Enable antialiasing for smoother edges.
   * May impact performance on older devices.
   *
   * @default true
   */
  antialias?: boolean;

  /**
   * Enable touch/pointer event handling for PixiJS interactivity.
   * When enabled, touch events are bridged to PixiJS EventSystem.
   *
   * @default true
   */
  interactiveEvents?: boolean;

  /**
   * Callback fired when the PixiJS Application is ready.
   * Use this to add sprites, graphics, and set up your scene.
   *
   * @param app - The initialized PixiJS Application instance
   *
   * @example
   * ```tsx
   * onApplicationCreate={(app) => {
   *   app.stage.addChild(new Sprite(texture));
   *   app.ticker.add(() => { ... });
   * }}
   * ```
   */
  onApplicationCreate?: (app: Application) => void;

  /**
   * Callback fired when the GL context is created.
   * Called before PixiJS initialization - useful for custom GL setup.
   *
   * @param gl - The expo-gl WebGL context
   */
  onContextCreate?: (gl: ExpoWebGLRenderingContext) => void;

  /**
   * Callback fired when an error occurs during initialization.
   *
   * @param error - The error that occurred
   */
  onError?: (error: Error) => void;
}

/**
 * Imperative handle exposed via ref.
 * Use with useRef<PixiViewHandle>() for direct control.
 */
export interface PixiViewHandle {
  /**
   * Get the PixiJS Application instance.
   * @returns The Application, or null if not initialized
   */
  getApplication: () => Application | null;

  /**
   * Get the stage container (root of the display tree).
   * @returns The stage Container, or null if not initialized
   */
  getStage: () => Container | null;

  /**
   * Force an immediate render.
   * Useful when you need to capture the current frame.
   */
  render: () => void;

  /**
   * Take a screenshot of the current canvas.
   * @returns Promise resolving to base64-encoded image data
   */
  takeSnapshot: () => Promise<string>;
}

// =============================================================================
// COMPONENT IMPLEMENTATION
// =============================================================================

/**
 * PixiView - React Native component for rendering PixiJS content.
 *
 * This component wraps expo-gl's GLView and manages:
 * - WebGL context lifecycle
 * - PixiJS Application creation and destruction
 * - Render loop integration with endFrameEXP()
 * - Automatic resizing on layout changes
 *
 * @remarks
 * The component uses PixiJS's built-in ticker for the render loop,
 * which provides better performance than a manual requestAnimationFrame loop.
 * Frame flushing is handled via the postrender runner hook.
 */
export const PixiView = forwardRef<PixiViewHandle, PixiViewProps>((props, ref) => {
  // ===========================================================================
  // PROPS DESTRUCTURING
  // ===========================================================================

  const {
    style,
    backgroundColor = 0x000000,
    resolution,
    antialias = true,
    interactiveEvents = true,
    onApplicationCreate,
    onContextCreate,
    onError,
  } = props;

  // ===========================================================================
  // REFS
  // ===========================================================================

  /** PixiJS Application instance */
  const appRef = useRef<Application | null>(null);

  /** expo-gl WebGL context */
  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);

  /** Animation frame ID (for cleanup) */
  const animationFrameRef = useRef<number | null>(null);

  /** Container view reference */
  const containerRef = useRef<View>(null);

  /** Current layout dimensions */
  const layoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  /** Canvas element reference for touch event bridging */
  const canvasRef = useRef<any>(null);

  // ===========================================================================
  // IMPERATIVE HANDLE
  // Expose methods via ref for parent component control.
  // ===========================================================================

  useImperativeHandle(ref, () => ({
    getApplication: () => appRef.current,

    getStage: () => appRef.current?.stage ?? null,

    render: () => {
      if (appRef.current && glRef.current) {
        appRef.current.render();
        glRef.current.endFrameEXP();
      }
    },

    takeSnapshot: async () => {
      if (!glRef.current) {
        throw new Error('GL context not available');
      }
      // TODO: Implement using expo-gl's GLView.takeSnapshotAsync
      return '';
    },
  }));

  // ===========================================================================
  // LAYOUT HANDLING
  // Resize renderer when component dimensions change.
  // ===========================================================================

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      layoutRef.current = { width, height };

      // Update PixiJS renderer if app exists
      if (appRef.current) {
        const res = resolution || PixelRatio.get();
        appRef.current.renderer.resize(width * res, height * res);
      }
    },
    [resolution],
  );

  // ===========================================================================
  // TOUCH EVENT HANDLING
  // Bridge React Native touch events to PixiJS EventSystem.
  // ===========================================================================

  /**
   * Forward pointer events to PixiJS EventSystem.
   * Dispatches events through both canvas and window for proper PixiJS handling.
   * - pointerdown: dispatched to canvas (PixiJS listens here)
   * - pointermove/pointerup: dispatched to window (PixiJS listens here for global events)
   */
  const forwardPointerEvent = useCallback(
    (
      events: NativePointerEvent[],
      eventType: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      events.forEach((event) => {
        const PointerEventConstructor = (globalThis as any).PointerEvent;
        const eventData = PointerEventConstructor
          ? new PointerEventConstructor(eventType, {
              ...event,
              view: (globalThis as any).window,
              bubbles: true,
              cancelable: true,
            })
          : {
              ...event,
              type: eventType,
              view: (globalThis as any).window,
            };

        // Ensure target is set
        if (eventData) {
          (eventData as any).target = canvas;
          (eventData as any).currentTarget = canvas;
        }

        // Dispatch to canvas
        canvas.dispatchEvent(eventData);

        // ALWAYS dispatch to window as well for global capture
        // PixiJS often uses global handlers for PointerDown too in some configs
        dispatchWindowEvent(eventData);

        if (__DEV__ && eventType === 'pointerdown') {
          console.log(
            `[PixiView] Forwarding ${eventType}, coords: (${event.clientX}, ${event.clientY})`,
          );
        }
      });
    },
    [],
  );

  /**
   * Handle touch start events.
   */
  const handleTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactiveEvents || !canvasRef.current) return;

      const pointerEvents = convertTouchToPointerEvents(event, 'pointerdown', {
        canvas: canvasRef.current,
        resolution: 1, // We use logical units now
      });
      forwardPointerEvent(pointerEvents, 'pointerdown');
    },
    [interactiveEvents, forwardPointerEvent],
  );

  /**
   * Handle touch move events.
   */
  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactiveEvents || !canvasRef.current) return;

      const pointerEvents = convertTouchToPointerEvents(event, 'pointermove', {
        canvas: canvasRef.current,
        resolution: 1, // We use logical units now
      });
      forwardPointerEvent(pointerEvents, 'pointermove');
    },
    [interactiveEvents, forwardPointerEvent],
  );

  /**
   * Handle touch end events.
   */
  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactiveEvents || !canvasRef.current) return;

      const pointerEvents = convertTouchToPointerEvents(event, 'pointerup', {
        canvas: canvasRef.current,
        resolution: 1, // We use logical units now
      });
      forwardPointerEvent(pointerEvents, 'pointerup');
    },
    [interactiveEvents, forwardPointerEvent],
  );

  /**
   * Handle touch cancel events (e.g., when interrupted by system gesture).
   */
  const handleTouchCancel = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactiveEvents || !canvasRef.current) return;

      const pointerEvents = convertTouchToPointerEvents(event, 'pointercancel', {
        canvas: canvasRef.current,
        resolution: 1, // We use logical units now
      });
      forwardPointerEvent(pointerEvents, 'pointercancel');
      clearTouchTracking();
    },
    [interactiveEvents, forwardPointerEvent],
  );

  // ===========================================================================
  // GL CONTEXT HANDLING
  // Initialize PixiJS when expo-gl context is created.
  // ===========================================================================

  const handleContextCreate = useCallback(
    async (gl: ExpoWebGLRenderingContext) => {
      glRef.current = gl;

      // PixiJS resolution handling for high-DPI (Retina) screens:
      // PixiJS resolution handling for high-DPI (Retina) screens:
      const pixelRatio = PixelRatio.get();
      const { width: layoutWidth, height: layoutHeight } = layoutRef.current;

      // Default logical dimensions for PixiJS Application
      const logicalWidth = layoutWidth || gl.drawingBufferWidth / pixelRatio;
      const logicalHeight = layoutHeight || gl.drawingBufferHeight / pixelRatio;

      const res = resolution || pixelRatio;

      // Physical dimensions for the Canvas wrapper
      const physicalWidth = gl.drawingBufferWidth;
      const physicalHeight = gl.drawingBufferHeight;

      if (__DEV__) {
        console.log(
          `[PixiView] Init: Logical ${logicalWidth}x${logicalHeight} @ ${res}x (Physical ${physicalWidth}x${physicalHeight})`,
        );
      }

      // Set up canvas wrapper with PHYSICAL dimensions
      // This ensures ExpoCanvasElement reports the full backing store size
      const canvas = setActiveGLContext(gl, physicalWidth, physicalHeight);

      // Set style to logical size (PixiJS autoDensity relies on this relation)
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;

      canvasRef.current = canvas;

      // Notify context creation
      onContextCreate?.(gl);

      try {
        // Create PixiJS Application
        const app = new Application();

        await app.init({
          width: logicalWidth,
          height: logicalHeight,
          backgroundColor,
          resolution: res,
          antialias,
          canvas: canvas as any,
          autoStart: true,
          sharedTicker: true,
          autoDensity: true, // This will keep canvas.style updated to logical units
          hello: true,
        });

        appRef.current = app;

        // Ensure EventSystem is properly set up with our canvas
        if (app.renderer.events) {
          // Re-set target element to ensure event listeners are attached
          const eventSystem = app.renderer.events as any;
          if (eventSystem.setTargetElement) {
            eventSystem.setTargetElement(canvas);
            if (__DEV__) {
              console.log('[PixiView] EventSystem target element set');
            }
          }

          if (__DEV__) {
            // Debug: log registered events
            setTimeout(() => {
              console.log(
                '[PixiView] Canvas registered events:',
                (canvas as any).getRegisteredEventTypes?.(),
              );
            }, 100);
          }
        }

        // Hook into PixiJS render cycle to call endFrameEXP
        // This is more efficient than a separate render loop
        app.renderer.runners.postrender.add({
          postrender: () => {
            if (glRef.current) {
              glRef.current.endFrameEXP();
            }
          },
        });

        // Notify application creation
        onApplicationCreate?.(app);
      } catch (error) {
        console.error('PixiJS initialization error:', error);
        onError?.(error as Error);
      }
    },
    [backgroundColor, resolution, antialias, onApplicationCreate, onContextCreate, onError],
  );

  // ===========================================================================
  // CLEANUP
  // Properly destroy PixiJS resources on unmount.
  // ===========================================================================

  useEffect(() => {
    return () => {
      // Cancel any pending animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Destroy PixiJS application
      if (appRef.current) {
        try {
          appRef.current.destroy(true, { children: true });
        } catch (error) {
          console.warn('Error destroying PixiJS application:', error);
        }
        appRef.current = null;
      }

      // Clear GL reference
      glRef.current = null;

      // Clear canvas reference
      canvasRef.current = null;

      // Clear touch tracking state
      clearTouchTracking();

      // Clear active context from adapter
      clearActiveContext();
    };
  }, []);

  // ===========================================================================
  // RENDER
  // Touch responder props for interactive event handling.
  // ===========================================================================

  const touchResponderProps = interactiveEvents
    ? {
        onStartShouldSetResponder: () => true,
        onMoveShouldSetResponder: () => true,
        onResponderGrant: handleTouchStart,
        onResponderMove: handleTouchMove,
        onResponderRelease: handleTouchEnd,
        onResponderTerminate: handleTouchCancel,
        onResponderTerminationRequest: () => true,
      }
    : {};

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      onLayout={handleLayout}
      {...touchResponderProps}
    >
      <GLView style={styles.glView} onContextCreate={handleContextCreate} />
    </View>
  );
});

// Display name for React DevTools
PixiView.displayName = 'PixiView';

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  glView: {
    flex: 1,
  },
});

// Default export for convenience
export default PixiView;
