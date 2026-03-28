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
import {
  calculateDesignScale,
  calculateDesignSafeArea,
  type DesignScaleMode,
  type DesignScaleResult,
  type SafeAreaInsets,
  type DesignSafeArea,
} from '../utils/designResolution';

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

  /**
   * Fixed design width for the virtual coordinate system.
   * When set (along with designHeight), the PixiJS stage is initialized
   * at this size and automatically scaled to fit the screen.
   *
   * All game logic uses this coordinate space regardless of device screen size.
   *
   * @example
   * ```tsx
   * <PixiView designWidth={768} designHeight={1024} scaleMode="SHOW_ALL" />
   * ```
   */
  designWidth?: number;

  /**
   * Fixed design height for the virtual coordinate system.
   * Must be set together with designWidth.
   */
  designHeight?: number;

  /**
   * How the design resolution maps to the physical screen.
   * Only used when designWidth and designHeight are set.
   *
   * - `SHOW_ALL`: Letterbox — entire design area visible, bars on shorter axis (default)
   * - `NO_BORDER`: Fill screen — uniformly scaled, overflowing edges cropped
   * - `EXACT_FIT`: Stretch to fill — may distort aspect ratio
   *
   * @default 'SHOW_ALL'
   */
  scaleMode?: DesignScaleMode;

  /**
   * Physical safe area insets in screen points.
   * Pass the values from `useSafeAreaInsets()` (react-native-safe-area-context)
   * or any other source.
   *
   * When set together with design resolution, `getSafeArea()` on the ref
   * returns these insets converted to design resolution coordinates.
   *
   * @example
   * ```tsx
   * import { useSafeAreaInsets } from 'react-native-safe-area-context';
   *
   * function GameScreen() {
   *   const insets = useSafeAreaInsets();
   *   const pixiRef = useRef<PixiViewHandle>(null);
   *
   *   return (
   *     <PixiView
   *       ref={pixiRef}
   *       designWidth={720}
   *       designHeight={1280}
   *       scaleMode="NO_BORDER"
   *       safeAreaInsets={insets}
   *       onApplicationCreate={(app) => {
   *         const safe = pixiRef.current?.getSafeArea();
   *         // Position UI within safe.top, safe.bottom, safe.left, safe.right
   *       }}
   *     />
   *   );
   * }
   * ```
   */
  safeAreaInsets?: SafeAreaInsets;
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

  /**
   * Get the current design-to-screen scale info.
   * @returns The scale result, or null if design resolution is not active
   */
  getDesignScale: () => DesignScaleResult | null;

  /**
   * Get safe area insets in design resolution coordinates.
   * Requires both design resolution and safeAreaInsets prop to be set.
   * @returns Safe area insets in design coordinates, or null if unavailable
   */
  getSafeArea: () => DesignSafeArea | null;
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
    designWidth,
    designHeight,
    scaleMode = 'SHOW_ALL',
    safeAreaInsets,
  } = props;

  /** Whether design resolution mode is active */
  const hasDesignResolution = designWidth != null && designHeight != null;

  /** Cached pixel ratio for safe area calculations */
  const pixelRatioRef = useRef<number>(PixelRatio.get());

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

  /** Current design resolution scale result */
  const designScaleRef = useRef<DesignScaleResult | null>(null);

  /** Active touch identifiers for multi-touch detection */
  const activeTouchesRef = useRef<Set<number>>(new Set());

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

    getDesignScale: () => designScaleRef.current,

    getSafeArea: () => {
      const scale = designScaleRef.current;
      if (!scale || !safeAreaInsets || !hasDesignResolution) return null;

      return calculateDesignSafeArea(
        safeAreaInsets,
        scale,
        designWidth!,
        designHeight!,
        pixelRatioRef.current,
      );
    },
  }));

  // ===========================================================================
  // LAYOUT HANDLING
  // Resize renderer when component dimensions change.
  // ===========================================================================

  /**
   * Apply design resolution to renderer and stage.
   *
   * Cocos2d-style: the renderer operates in design coordinates,
   * `resolution` bridges to physical pixels. The stage gets only
   * a position offset (no scale for SHOW_ALL / NO_BORDER).
   */
  const applyDesignScale = useCallback(
    (app: Application, physicalWidth: number, physicalHeight: number) => {
      if (!hasDesignResolution) return;

      const scale = calculateDesignScale(
        designWidth!,
        designHeight!,
        physicalWidth,
        physicalHeight,
        scaleMode,
      );
      designScaleRef.current = scale;

      // Set renderer to design-space viewport with native resolution
      app.renderer.resolution = scale.resolution;
      app.renderer.resize(scale.viewportWidth, scale.viewportHeight);

      // Stage: only offset (+ scale for EXACT_FIT, 1.0 otherwise)
      app.stage.scale.set(scale.stageScaleX, scale.stageScaleY);
      app.stage.position.set(scale.offsetX, scale.offsetY);

      if (__DEV__) {
        console.log(
          `[PixiView] Design resolution: ${designWidth}x${designHeight} → ` +
            `viewport(${scale.viewportWidth.toFixed(1)}x${scale.viewportHeight.toFixed(1)}) ` +
            `resolution(${scale.resolution.toFixed(3)}) ` +
            `offset(${scale.offsetX.toFixed(1)}, ${scale.offsetY.toFixed(1)})`,
        );
      }
    },
    [hasDesignResolution, designWidth, designHeight, scaleMode],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      layoutRef.current = { width, height };

      if (appRef.current) {
        const pixelRatio = PixelRatio.get();
        pixelRatioRef.current = pixelRatio;

        if (hasDesignResolution) {
          // Use GL buffer as the source of truth for physical dimensions.
          // layout.width * pixelRatio may differ from drawingBufferWidth due to
          // navigation bars, rounding, or sub-pixel layout — causing a black strip.
          const gl = glRef.current;
          const physW = gl ? gl.drawingBufferWidth : width * pixelRatio;
          const physH = gl ? gl.drawingBufferHeight : height * pixelRatio;
          applyDesignScale(appRef.current, physW, physH);
        } else {
          // No design resolution — resize renderer to logical screen size
          // (renderer multiplies by its own resolution internally with autoDensity)
          appRef.current.renderer.resize(width, height);
        }
      }
    },
    [hasDesignResolution, applyDesignScale],
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
        resolution: 1,
      });
      // Track new touches
      pointerEvents.forEach((e) => activeTouchesRef.current.add(e.pointerId));
      forwardPointerEvent(pointerEvents, 'pointerdown');
    },
    [interactiveEvents, forwardPointerEvent],
  );

  /**
   * Handle touch move events.
   * Also detects new fingers (multi-touch) that arrive as move events
   * because React Native's GestureResponder only fires onResponderGrant
   * for the first finger.
   */
  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!interactiveEvents || !canvasRef.current) return;

      const { nativeEvent } = event;
      const changedTouches = nativeEvent.changedTouches ?? [nativeEvent];
      const activeTouches = activeTouchesRef.current;

      // Separate new touches (pointerdown) from existing touches (pointermove)
      const newTouchIds = new Set<number>();
      for (const touch of changedTouches) {
        const id = Number(touch.identifier);
        if (!activeTouches.has(id)) {
          newTouchIds.add(id);
          activeTouches.add(id);
        }
      }

      if (newTouchIds.size > 0) {
        // Emit pointerdown for newly detected fingers
        const downEvents = convertTouchToPointerEvents(event, 'pointerdown', {
          canvas: canvasRef.current,
          resolution: 1,
        }).filter((e) => newTouchIds.has(e.pointerId));
        forwardPointerEvent(downEvents, 'pointerdown');
      }

      // Emit pointermove for existing fingers
      const moveEvents = convertTouchToPointerEvents(event, 'pointermove', {
        canvas: canvasRef.current,
        resolution: 1,
      }).filter((e) => !newTouchIds.has(e.pointerId));
      if (moveEvents.length > 0) {
        forwardPointerEvent(moveEvents, 'pointermove');
      }
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
        resolution: 1,
      });
      // Remove ended touches from tracking
      pointerEvents.forEach((e) => activeTouchesRef.current.delete(e.pointerId));
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
        resolution: 1,
      });
      forwardPointerEvent(pointerEvents, 'pointercancel');
      activeTouchesRef.current.clear();
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

      const pixelRatio = PixelRatio.get();
      pixelRatioRef.current = pixelRatio;
      const { width: layoutWidth, height: layoutHeight } = layoutRef.current;

      // Physical dimensions from the GL backing store
      const physicalWidth = gl.drawingBufferWidth;
      const physicalHeight = gl.drawingBufferHeight;

      // Determine initial renderer dimensions and resolution
      let initWidth: number;
      let initHeight: number;
      let initRes: number;

      if (hasDesignResolution) {
        // Cocos2d-style: renderer operates in design-space coordinates,
        // resolution bridges to physical pixels.
        const scale = calculateDesignScale(
          designWidth!,
          designHeight!,
          physicalWidth,
          physicalHeight,
          scaleMode,
        );
        designScaleRef.current = scale;
        initWidth = scale.viewportWidth;
        initHeight = scale.viewportHeight;
        initRes = scale.resolution;
      } else {
        // No design resolution — use logical screen dimensions
        initWidth = layoutWidth || physicalWidth / pixelRatio;
        initHeight = layoutHeight || physicalHeight / pixelRatio;
        initRes = resolution || pixelRatio;
      }

      if (__DEV__) {
        console.log(
          `[PixiView] Init: Viewport ${initWidth.toFixed(1)}x${initHeight.toFixed(1)} ` +
            `@ ${initRes.toFixed(3)}x (Physical ${physicalWidth}x${physicalHeight})`,
        );
      }

      // Set up canvas wrapper with PHYSICAL dimensions
      // This ensures ExpoCanvasElement reports the full backing store size
      const canvas = setActiveGLContext(gl, physicalWidth, physicalHeight);

      // Set style to viewport size (PixiJS autoDensity relies on this relation)
      canvas.style.width = `${initWidth}px`;
      canvas.style.height = `${initHeight}px`;

      canvasRef.current = canvas;

      // Notify context creation
      onContextCreate?.(gl);

      try {
        // Create PixiJS Application
        const app = new Application();

        await app.init({
          width: initWidth,
          height: initHeight,
          backgroundColor,
          resolution: initRes,
          antialias,
          canvas: canvas as any,
          autoStart: true,
          sharedTicker: true,
          autoDensity: true,
          hello: true,
        });

        appRef.current = app;

        // Apply stage offset (and scale for EXACT_FIT)
        if (hasDesignResolution) {
          const scale = designScaleRef.current!;
          app.stage.scale.set(scale.stageScaleX, scale.stageScaleY);
          app.stage.position.set(scale.offsetX, scale.offsetY);
        }

        // Ensure EventSystem is properly set up with our canvas
        if (app.renderer.events) {
          const eventSystem = app.renderer.events as any;
          if (eventSystem.setTargetElement) {
            eventSystem.setTargetElement(canvas);
            if (__DEV__) {
              console.log('[PixiView] EventSystem target element set');
            }
          }

          if (__DEV__) {
            setTimeout(() => {
              console.log(
                '[PixiView] Canvas registered events:',
                (canvas as any).getRegisteredEventTypes?.(),
              );
            }, 100);
          }
        }

        // Hook into PixiJS render cycle to call endFrameEXP
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
        if (__DEV__) console.error('PixiJS initialization error:', error);
        onError?.(error as Error);
      }
    },
    [
      backgroundColor,
      resolution,
      antialias,
      hasDesignResolution,
      designWidth,
      designHeight,
      scaleMode,
      onApplicationCreate,
      onContextCreate,
      onError,
    ],
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
          if (__DEV__) console.warn('Error destroying PixiJS application:', error);
        }
        appRef.current = null;
      }

      // Clear GL reference
      glRef.current = null;

      // Clear canvas reference
      canvasRef.current = null;

      // Clear touch tracking state
      activeTouchesRef.current.clear();
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

  // Convert PixiJS hex color to CSS for the container background.
  // This eliminates visible gaps from sub-pixel layout rounding between
  // the React Native View and the GLView.
  const bgStyle = backgroundColor != null
    ? { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}` }
    : undefined;

  return (
    <View
      ref={containerRef}
      style={[styles.container, style, bgStyle]}
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
