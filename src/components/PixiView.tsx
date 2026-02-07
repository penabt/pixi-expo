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

import {
    useCallback,
    useRef,
    useEffect,
    useImperativeHandle,
    forwardRef,
} from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import type { ViewStyle } from 'react-native';
import { GLView } from 'expo-gl';
import type { ExpoWebGLRenderingContext } from 'expo-gl';
import { Application, Container } from 'pixi.js';
import { setActiveGLContext, clearActiveContext } from '../adapter';

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
        resolution = 1,
        antialias = true,
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
                appRef.current.renderer.resize(width * resolution, height * resolution);
            }
        },
        [resolution]
    );

    // ===========================================================================
    // GL CONTEXT HANDLING
    // Initialize PixiJS when expo-gl context is created.
    // ===========================================================================

    const handleContextCreate = useCallback(
        async (gl: ExpoWebGLRenderingContext) => {
            glRef.current = gl;

            // Get viewport dimensions from GL context
            const width = gl.drawingBufferWidth;
            const height = gl.drawingBufferHeight;

            // Set up canvas wrapper for PixiJS
            const canvas = setActiveGLContext(gl, width, height);

            // Notify context creation (before PixiJS init)
            onContextCreate?.(gl);

            try {
                // Create PixiJS Application
                const app = new Application();

                await app.init({
                    width,
                    height,
                    backgroundColor,
                    resolution,
                    antialias,
                    // Use our expo canvas wrapper
                    canvas: canvas as any,
                    // Let PixiJS handle the render loop
                    autoStart: true,
                    // Use shared ticker for better performance
                    sharedTicker: true,
                });

                appRef.current = app;

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
        [backgroundColor, resolution, antialias, onApplicationCreate, onContextCreate, onError]
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

            // Clear active context from adapter
            clearActiveContext();
        };
    }, []);

    // ===========================================================================
    // RENDER
    // ===========================================================================

    return (
        <View ref={containerRef} style={[styles.container, style]} onLayout={handleLayout}>
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
