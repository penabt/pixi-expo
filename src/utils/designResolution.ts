/**
 * Design resolution scaling utilities.
 *
 * Provides design resolution support: define a fixed logical
 * size (e.g. 768×1024) and the library automatically scales the PixiJS stage
 * to fit the device screen.
 */

/** How the design resolution maps to the physical screen. */
export type DesignScaleMode =
  /** Letterbox — entire design area visible, bars on shorter axis */
  | 'SHOW_ALL'
  /** Fill screen, uniformly scaled — overflowing edges are cropped */
  | 'NO_BORDER'
  /** Stretch to fill — may distort aspect ratio */
  | 'EXACT_FIT';

/** Result of the design-to-screen scale calculation. */
export interface DesignScaleResult {
  /** Scale factor applied to stage X axis */
  scaleX: number;
  /** Scale factor applied to stage Y axis */
  scaleY: number;
  /** X offset for centering the stage (positive = letterbox, negative = crop) */
  offsetX: number;
  /** Y offset for centering the stage */
  offsetY: number;
}

/**
 * Calculate how to transform the PixiJS stage so that a fixed design
 * resolution maps onto the actual screen dimensions.
 *
 * The renderer stays at the real screen size for full-quality rendering;
 * the returned values are applied to `app.stage.scale` and `app.stage.position`.
 */
export function calculateDesignScale(
  designWidth: number,
  designHeight: number,
  screenWidth: number,
  screenHeight: number,
  scaleMode: DesignScaleMode,
): DesignScaleResult {
  switch (scaleMode) {
    case 'SHOW_ALL': {
      const scale = Math.min(screenWidth / designWidth, screenHeight / designHeight);
      return {
        scaleX: scale,
        scaleY: scale,
        offsetX: (screenWidth - designWidth * scale) / 2,
        offsetY: (screenHeight - designHeight * scale) / 2,
      };
    }
    case 'NO_BORDER': {
      const scale = Math.max(screenWidth / designWidth, screenHeight / designHeight);
      return {
        scaleX: scale,
        scaleY: scale,
        offsetX: (screenWidth - designWidth * scale) / 2,
        offsetY: (screenHeight - designHeight * scale) / 2,
      };
    }
    case 'EXACT_FIT': {
      return {
        scaleX: screenWidth / designWidth,
        scaleY: screenHeight / designHeight,
        offsetX: 0,
        offsetY: 0,
      };
    }
  }
}
