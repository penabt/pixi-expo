/**
 * Design resolution utilities (Cocos2d-style).
 *
 * Instead of scaling the PixiJS stage, we set the renderer to operate in
 * design coordinates and use PixiJS's `resolution` property to bridge
 * the gap to physical pixels. This means:
 *
 * - Textures render at native device resolution (no GPU upscaling)
 * - Game code works in a fixed coordinate space (e.g. 720×1280)
 * - The stage has no scale transform — only a position offset for centering
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

/**
 * Result of the design-to-screen scale calculation.
 *
 * The renderer is initialised at `viewportWidth × viewportHeight` with the
 * returned `resolution`.  Physical backing = viewport × resolution = screen.
 * The stage receives only a position offset (and stageScale for EXACT_FIT).
 */
export interface DesignScaleResult {
  /** PixiJS resolution: physical pixels per logical (design) unit */
  resolution: number;
  /** Logical viewport width for the PixiJS renderer */
  viewportWidth: number;
  /** Logical viewport height for the PixiJS renderer */
  viewportHeight: number;
  /** Stage X position to centre the design area inside the viewport */
  offsetX: number;
  /** Stage Y position to centre the design area inside the viewport */
  offsetY: number;
  /** Stage scale X — 1.0 for SHOW_ALL / NO_BORDER, may differ for EXACT_FIT */
  stageScaleX: number;
  /** Stage scale Y — 1.0 for SHOW_ALL / NO_BORDER, may differ for EXACT_FIT */
  stageScaleY: number;
}

/**
 * Calculate how to set up the PixiJS renderer so that game code can work in
 * a fixed design coordinate space while rendering at native device resolution.
 *
 * @param designWidth  - Fixed design width  (e.g. 720)
 * @param designHeight - Fixed design height (e.g. 1280)
 * @param physicalWidth  - Physical screen width in pixels
 * @param physicalHeight - Physical screen height in pixels
 * @param scaleMode - How to handle aspect-ratio mismatch
 * @returns Values to feed into PixiJS app.init() and stage transform
 */
export function calculateDesignScale(
  designWidth: number,
  designHeight: number,
  physicalWidth: number,
  physicalHeight: number,
  scaleMode: DesignScaleMode,
): DesignScaleResult {
  switch (scaleMode) {
    case 'SHOW_ALL': {
      // Use the smaller ratio so the entire design area is visible.
      // The viewport is larger than the design area on one axis → letterbox.
      const resolution = Math.min(physicalWidth / designWidth, physicalHeight / designHeight);
      const viewportWidth = physicalWidth / resolution;
      const viewportHeight = physicalHeight / resolution;
      return {
        resolution,
        viewportWidth,
        viewportHeight,
        offsetX: (viewportWidth - designWidth) / 2,
        offsetY: (viewportHeight - designHeight) / 2,
        stageScaleX: 1,
        stageScaleY: 1,
      };
    }
    case 'NO_BORDER': {
      // Use the larger ratio so the screen is completely filled.
      // The viewport is smaller than the design area on one axis → edges cropped.
      const resolution = Math.max(physicalWidth / designWidth, physicalHeight / designHeight);
      const viewportWidth = physicalWidth / resolution;
      const viewportHeight = physicalHeight / resolution;
      return {
        resolution,
        viewportWidth,
        viewportHeight,
        offsetX: (viewportWidth - designWidth) / 2,
        offsetY: (viewportHeight - designHeight) / 2,
        stageScaleX: 1,
        stageScaleY: 1,
      };
    }
    case 'EXACT_FIT': {
      // Non-uniform scaling: distort to fill exactly.
      // PixiJS resolution is a single scalar, so we pick the larger axis ratio
      // and compensate the other axis with a stage scale < 1.
      const resX = physicalWidth / designWidth;
      const resY = physicalHeight / designHeight;
      const resolution = Math.max(resX, resY);
      const viewportWidth = physicalWidth / resolution;
      const viewportHeight = physicalHeight / resolution;
      return {
        resolution,
        viewportWidth,
        viewportHeight,
        offsetX: 0,
        offsetY: 0,
        stageScaleX: viewportWidth / designWidth,
        stageScaleY: viewportHeight / designHeight,
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
 * @param insets - Physical safe area insets in logical screen points
 * @param scale - The current design scale result from calculateDesignScale()
 * @param designWidth - The design resolution width
 * @param designHeight - The design resolution height
 * @param pixelRatio - Device pixel ratio (PixelRatio.get())
 * @returns Safe area insets in design resolution coordinates
 */
export function calculateDesignSafeArea(
  insets: SafeAreaInsets,
  scale: DesignScaleResult,
  designWidth: number,
  designHeight: number,
  pixelRatio: number,
): DesignSafeArea {
  const { resolution, viewportWidth, viewportHeight, offsetX, offsetY, stageScaleX, stageScaleY } =
    scale;

  // Physical screen dimensions (recoverable from viewport × resolution)
  const physicalWidth = viewportWidth * resolution;
  const physicalHeight = viewportHeight * resolution;

  // Convert logical inset (screen points) → physical → viewport → design
  //
  // viewport_coord = physical / resolution
  // design_coord   = (viewport_coord - offsetX) / stageScaleX
  //
  // For SHOW_ALL / NO_BORDER stageScale is 1, so design = viewport - offset.

  const left =
    (insets.left * pixelRatio / resolution - offsetX) / stageScaleX;
  const top =
    (insets.top * pixelRatio / resolution - offsetY) / stageScaleY;
  const right =
    designWidth -
    ((physicalWidth - insets.right * pixelRatio) / resolution - offsetX) / stageScaleX;
  const bottom =
    designHeight -
    ((physicalHeight - insets.bottom * pixelRatio) / resolution - offsetY) / stageScaleY;

  // Clamp to zero — if the letterbox bars already cover the unsafe region,
  // the design area is fully safe on that edge.
  return {
    top: Math.max(0, top),
    bottom: Math.max(0, bottom),
    left: Math.max(0, left),
    right: Math.max(0, right),
  };
}
