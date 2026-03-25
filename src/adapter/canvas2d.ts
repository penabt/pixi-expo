/**
 * @fileoverview Mock Canvas 2D rendering context for React Native.
 *
 * Provides a minimal CanvasRenderingContext2D implementation that satisfies
 * PixiJS's text measurement pipeline (CanvasTextMetrics, BitmapFont.from,
 * @pixi/ui text components). expo-gl only supports WebGL, so actual pixel
 * drawing is not possible — but PixiJS needs the context to exist so it can
 * set `context.font` and call `measureText()`.
 *
 * @module @penabt/pixi-expo/canvas2d
 * @internal
 */

/** Parse font size from a CSS font string (e.g. "bold 24px Arial" → 24). */
function parseFontSize(font: string): number {
  const match = font.match(/(\d+(?:\.\d+)?)\s*px/);
  return match ? parseFloat(match[1]) : 10;
}

/** No-op gradient with addColorStop. */
function createMockGradient() {
  return { addColorStop: () => {} };
}

/**
 * Create a mock CanvasRenderingContext2D.
 *
 * The `measureText` implementation approximates character widths using
 * `fontSize * 0.6` per character, which is close enough for layout purposes.
 *
 * @param canvas - The owning canvas element (or any object with width/height).
 */
export function createMockCanvas2DContext(canvas: any) {
  let _font = '10px sans-serif';

  const ctx: any = {
    // -- Back-reference to owning canvas --
    canvas,

    // -- Font / text properties (critical for CanvasTextMetrics) --
    get font() {
      return _font;
    },
    set font(value: string) {
      _font = value;
    },
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    direction: 'ltr',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    letterSpacing: '0px',
    wordSpacing: '0px',
    fontKerning: 'auto',
    textRendering: 'auto',

    // -- Text measurement (primary reason this mock exists) --
    measureText(text: string) {
      const fontSize = parseFontSize(_font);
      const width = text.length * fontSize * 0.6;
      const ascent = fontSize * 0.8;
      const descent = fontSize * 0.2;
      return {
        width,
        actualBoundingBoxAscent: ascent,
        actualBoundingBoxDescent: descent,
        fontBoundingBoxAscent: ascent,
        fontBoundingBoxDescent: descent,
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: width,
        alphabeticBaseline: 0,
        emHeightAscent: ascent,
        emHeightDescent: descent,
        hangingBaseline: ascent * 0.8,
        ideographicBaseline: -descent,
      };
    },

    // -- Text drawing (no-op) --
    fillText: () => {},
    strokeText: () => {},

    // -- State stack --
    save: () => {},
    restore: () => {},

    // -- Rect operations (no-op) --
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},

    // -- Path operations (no-op) --
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    arc: () => {},
    arcTo: () => {},
    ellipse: () => {},
    rect: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    isPointInPath: () => false,
    isPointInStroke: () => false,

    // -- Transform (no-op) --
    scale: () => {},
    rotate: () => {},
    translate: () => {},
    transform: () => {},
    setTransform: () => {},
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    resetTransform: () => {},

    // -- Drawing images (no-op) --
    drawImage: () => {},

    // -- Pixel manipulation --
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => {},

    // -- Gradients / Patterns --
    createLinearGradient: () => createMockGradient(),
    createRadialGradient: () => createMockGradient(),
    createConicGradient: () => createMockGradient(),
    createPattern: () => null,

    // -- Line dash --
    setLineDash: () => {},
    getLineDash: () => [],
    lineDashOffset: 0,
  };

  return ctx;
}
