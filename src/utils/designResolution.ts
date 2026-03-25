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

/** Physical safe area insets in screen points (from react-native-safe-area-context or similar). */
export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Safe area insets converted to design resolution coordinates. */
export interface DesignSafeArea {
  /** Inset from the top edge of the design coordinate space */
  top: number;
  /** Inset from the bottom edge of the design coordinate space */
  bottom: number;
  /** Inset from the left edge of the design coordinate space */
  left: number;
  /** Inset from the right edge of the design coordinate space */
  right: number;
}

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

/**
 * Convert physical safe area insets (screen points) to design resolution coordinates.
 *
 * The returned insets represent how far from each edge of the design coordinate
 * space content should be placed to remain within the device safe area.
 *
 * In NO_BORDER mode, the design area extends beyond the screen edges,
 * so safe area insets will be larger to account for the cropped region.
 * In SHOW_ALL mode with letterboxing, insets may be zero if the bars
 * already cover the unsafe region.
 *
 * @param insets - Physical safe area insets in screen points
 * @param scale - The current design scale result from calculateDesignScale()
 * @param designWidth - The design resolution width
 * @param designHeight - The design resolution height
 * @param screenWidth - The physical screen width in points
 * @param screenHeight - The physical screen height in points
 * @returns Safe area insets in design resolution coordinates
 */
export function calculateDesignSafeArea(
  insets: SafeAreaInsets,
  scale: DesignScaleResult,
  designWidth: number,
  designHeight: number,
  screenWidth: number,
  screenHeight: number,
): DesignSafeArea {
  // Convert screen-space safe boundaries to design coordinates.
  //
  // Screen point → design point: (screenPt - offset) / scale
  //
  // Safe boundaries in screen space:
  //   safeLeft   = insets.left
  //   safeTop    = insets.top
  //   safeRight  = screenWidth - insets.right
  //   safeBottom = screenHeight - insets.bottom
  //
  // In design space:
  //   safeLeft_d   = (insets.left - offsetX) / scaleX
  //   safeTop_d    = (insets.top - offsetY) / scaleY
  //   safeRight_d  = (screenWidth - insets.right - offsetX) / scaleX
  //   safeBottom_d = (screenHeight - insets.bottom - offsetY) / scaleY
  //
  // Design insets = distance from design edges (0,0)→(designWidth,designHeight):
  //   left   = safeLeft_d
  //   top    = safeTop_d
  //   right  = designWidth - safeRight_d
  //   bottom = designHeight - safeBottom_d

  const left = (insets.left - scale.offsetX) / scale.scaleX;
  const top = (insets.top - scale.offsetY) / scale.scaleY;
  const right = designWidth - (screenWidth - insets.right - scale.offsetX) / scale.scaleX;
  const bottom = designHeight - (screenHeight - insets.bottom - scale.offsetY) / scale.scaleY;

  // Clamp to zero — if the letterbox bars already cover the unsafe region,
  // the design area is fully safe on that edge.
  return {
    top: Math.max(0, top),
    bottom: Math.max(0, bottom),
    left: Math.max(0, left),
    right: Math.max(0, right),
  };
}
