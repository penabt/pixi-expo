/**
 * Web variant of PixiView.
 *
 * Renders a real `<canvas>` inside a `<View>` (which resolves to
 * react-native-web's `<div>` on web). PixiJS's default BrowserAdapter handles
 * GL context creation, the render loop, and pointer events directly — no
 * polyfills, no expo-gl, no touch event bridging.
 *
 * Public props/handle types mirror the native PixiView so call sites stay portable.
 */

import { useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import type { ViewStyle, LayoutChangeEvent } from 'react-native';
import { Application, Container } from 'pixi.js';
import {
  calculateDesignScale,
  calculateDesignSafeArea,
  type DesignScaleMode,
  type DesignScaleResult,
  type SafeAreaInsets,
  type DesignSafeArea,
} from '../utils/designResolution';

// =============================================================================
// TYPES — kept structurally compatible with the native PixiView.
// =============================================================================

export interface PixiViewProps {
  style?: ViewStyle;
  backgroundColor?: number;
  resolution?: number;
  antialias?: boolean;
  /**
   * On web, PixiJS's EventSystem attaches to the canvas automatically.
   * The flag is accepted for API parity but only toggles stage interactivity.
   */
  interactiveEvents?: boolean;
  onApplicationCreate?: (app: Application) => void;
  /**
   * Called once the WebGL context has been created.
   * On web this is a `WebGL2RenderingContext` (or `WebGLRenderingContext`).
   */
  onContextCreate?: (gl: WebGL2RenderingContext | WebGLRenderingContext) => void;
  onError?: (error: Error) => void;
  designWidth?: number;
  designHeight?: number;
  scaleMode?: DesignScaleMode;
  safeAreaInsets?: SafeAreaInsets;
}

export interface PixiViewHandle {
  getApplication: () => Application | null;
  getStage: () => Container | null;
  render: () => void;
  takeSnapshot: () => Promise<string>;
  getDesignScale: () => DesignScaleResult | null;
  getSafeArea: () => DesignSafeArea | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export const PixiView = forwardRef<PixiViewHandle, PixiViewProps>((props, ref) => {
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

  const hasDesignResolution = designWidth != null && designHeight != null;

  const appRef = useRef<Application | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const initStartedRef = useRef(false);
  const layoutRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const designScaleRef = useRef<DesignScaleResult | null>(null);
  const dprRef = useRef<number>(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

  // ---------------------------------------------------------------------------
  // Imperative handle — same shape as native.
  // ---------------------------------------------------------------------------

  useImperativeHandle(ref, () => ({
    getApplication: () => appRef.current,
    getStage: () => appRef.current?.stage ?? null,
    render: () => {
      appRef.current?.render();
    },
    takeSnapshot: async () => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');
      // Force a render so the snapshot reflects the current frame.
      appRef.current?.render();
      return canvas.toDataURL('image/png');
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
        dprRef.current,
      );
    },
  }));

  // ---------------------------------------------------------------------------
  // Design-scale application (matches native applyDesignScale).
  // ---------------------------------------------------------------------------

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

      app.renderer.resolution = scale.resolution;
      app.renderer.resize(scale.viewportWidth, scale.viewportHeight);

      app.stage.scale.set(scale.stageScaleX, scale.stageScaleY);
      app.stage.position.set(scale.offsetX, scale.offsetY);
    },
    [hasDesignResolution, designWidth, designHeight, scaleMode],
  );

  // ---------------------------------------------------------------------------
  // Application initialization (declared before handleLayout so the closure
  // captures the latest reference).
  // ---------------------------------------------------------------------------

  const initApplication = useCallback(
    async (cssWidth: number, cssHeight: number, dpr: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const physicalWidth = cssWidth * dpr;
      const physicalHeight = cssHeight * dpr;

      let initWidth: number;
      let initHeight: number;
      let initRes: number;

      if (hasDesignResolution) {
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
        initWidth = cssWidth;
        initHeight = cssHeight;
        initRes = resolution ?? dpr;
      }

      try {
        const app = new Application();
        await app.init({
          canvas,
          width: initWidth,
          height: initHeight,
          backgroundColor,
          resolution: initRes,
          antialias,
          autoStart: true,
          sharedTicker: true,
          // autoDensity hard-codes `canvas.style.width/height` to the renderer's
          // logical width/height, which on web breaks our design-resolution flow
          // (the renderer's logical width is in design units, not CSS pixels).
          // We keep the canvas at `width/height: 100%` via React style and let
          // PixiJS set only the GL backing dimensions via `canvas.width/height`.
          autoDensity: false,
          hello: true,
        });

        appRef.current = app;

        if (hasDesignResolution) {
          const scale = designScaleRef.current!;
          app.stage.scale.set(scale.stageScaleX, scale.stageScaleY);
          app.stage.position.set(scale.offsetX, scale.offsetY);

          // Always re-apply with current real-window dimensions after init.
          // onLayout in RN-web sometimes reports the FIRST layout pass before
          // SafeAreaProvider / outer flex layout has settled, especially when
          // the page loads into an already-fullscreen window. Reading
          // `window.innerWidth/Height` directly is the only fully reliable
          // post-init source. If the canvas's actual offset size differs we
          // re-apply the scale to match.
          const realW =
            typeof window !== 'undefined' ? window.innerWidth : layoutRef.current.width;
          const realH =
            typeof window !== 'undefined' ? window.innerHeight : layoutRef.current.height;
          const realDpr =
            (typeof window !== 'undefined' && window.devicePixelRatio) || dprRef.current;
          if (realW > 0 && realH > 0) {
            applyDesignScale(app, realW * realDpr, realH * realDpr);
          }
        }

        if (!interactiveEvents) {
          app.stage.eventMode = 'none';
        }

        if (onContextCreate) {
          const gl = (app.renderer as any).gl as
            | WebGL2RenderingContext
            | WebGLRenderingContext
            | undefined;
          if (gl) onContextCreate(gl);
        }

        onApplicationCreate?.(app);
      } catch (error) {
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
      interactiveEvents,
      onApplicationCreate,
      onContextCreate,
      onError,
    ],
  );

  // ---------------------------------------------------------------------------
  // Layout handling.
  // ---------------------------------------------------------------------------

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      layoutRef.current = { width, height };
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      dprRef.current = dpr;

      // Initialize on first layout (we need real pixel dimensions).
      if (!initStartedRef.current && width > 0 && height > 0 && canvasRef.current) {
        initStartedRef.current = true;
        void initApplication(width, height, dpr);
        return;
      }

      const app = appRef.current;
      if (!app) return;

      if (hasDesignResolution) {
        applyDesignScale(app, width * dpr, height * dpr);
      } else {
        app.renderer.resolution = resolution ?? dpr;
        app.renderer.resize(width, height);
      }
    },
    [hasDesignResolution, applyDesignScale, resolution, initApplication],
  );

  // ---------------------------------------------------------------------------
  // Window resize fallback.
  //
  // react-native-web's onLayout is supposed to fire on parent resize via an
  // internal ResizeObserver, but in practice it can miss cases where the body
  // height comes from `height: 100vh` and the user resizes the window without
  // changing the View's flex constraints. A direct window listener guarantees
  // we re-apply the design scale on every browser resize.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onWindowResize = () => {
      const app = appRef.current;
      if (!app) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      if (hasDesignResolution) {
        applyDesignScale(app, w * dpr, h * dpr);
      } else {
        app.renderer.resolution = resolution ?? dpr;
        app.renderer.resize(w, h);
      }
    };
    window.addEventListener('resize', onWindowResize);
    // Visual viewport resize (mobile zoom, browser UI show/hide) — extra signal
    if (typeof (window as any).visualViewport !== 'undefined') {
      (window as any).visualViewport.addEventListener('resize', onWindowResize);
    }
    return () => {
      window.removeEventListener('resize', onWindowResize);
      if (typeof (window as any).visualViewport !== 'undefined') {
        (window as any).visualViewport.removeEventListener('resize', onWindowResize);
      }
    };
  }, [hasDesignResolution, applyDesignScale, resolution]);

  // ---------------------------------------------------------------------------
  // Cleanup.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      const app = appRef.current;
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch {
          // swallow — destruction errors during unmount are non-fatal.
        }
        appRef.current = null;
      }
      canvasRef.current = null;
      initStartedRef.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render.
  // ---------------------------------------------------------------------------

  const bgStyle =
    backgroundColor != null
      ? { backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}` }
      : undefined;

  return (
    <View style={[styles.container, style, bgStyle]} onLayout={handleLayout}>
      <canvas
        ref={(el) => {
          canvasRef.current = el;
        }}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      />
    </View>
  );
});

PixiView.displayName = 'PixiView';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
});

export default PixiView;
