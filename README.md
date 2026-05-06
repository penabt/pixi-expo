# @penabt/pixi-expo

[![npm version](https://img.shields.io/npm/v/@penabt/pixi-expo.svg)](https://www.npmjs.com/package/@penabt/pixi-expo)
[![license](https://img.shields.io/npm/l/@penabt/pixi-expo.svg)](https://github.com/penabt/pixi-expo/blob/main/LICENSE)

**PixiJS v8 adapter for Expo — iOS, Android, and Web.** Enables hardware-accelerated 2D graphics in your Expo applications. Native targets render through the `expo-gl` WebGL context; the web target renders through a real `<canvas>` and PixiJS's built-in `BrowserAdapter` — same `<PixiView>` and asset API on every platform.

## Features

- 🚀 **PixiJS v8 Support** - Full compatibility with the latest PixiJS version
- 📱 **Expo Integration** - Works seamlessly with Expo managed and bare workflows
- 🌐 **Cross-platform** - Single API across iOS, Android, and Web (`expo start --web` / `expo export --platform web`)
- ⚡ **60 FPS Performance** - Hardware-accelerated WebGL rendering on every target
- 🎮 **Game Ready** - Perfect for 2D games, animations, and interactive graphics
- 📦 **Easy Setup** - Drop-in PixiView component with simple API
- 🔧 **Customizable** - Access to full PixiJS API and (on native) the expo-gl context

## Installation

```bash
# Install the package
npm install @penabt/pixi-expo

# Native (iOS / Android) peer dependencies
npx expo install expo-gl expo-asset expo-font pixi.js

# Add these too if you also target web
npx expo install react-dom react-native-web @expo/metro-runtime
```

## Web Support

`@penabt/pixi-expo` ships separate native and web bundles selected automatically
through `package.json` `exports` conditions. The same imports work on every
platform:

```tsx
import { PixiView, createExpoManifest, registerBitmapFont } from '@penabt/pixi-expo';
```

- **Native (iOS / Android)** — uses `expo-gl`'s `GLView`, the custom
  `DOMAdapter`, and the asset/font loaders backed by `expo-asset` / `expo-font`.
- **Web** — uses a real `<canvas>` plus PixiJS's built-in `BrowserAdapter`. No
  polyfills or `expo-gl` are pulled into the web bundle.

### What works on both platforms

`PixiView`, `PixiViewHandle`, `createExpoManifest`, `createExpoBundle`,
`resolveExpoAsset`, `registerBitmapFont`, `calculateDesignScale`,
`calculateDesignSafeArea`, plus all PixiJS re-exports.

### Native-only APIs

The low-level adapter helpers — `ExpoAdapter`, `ExpoCanvasElement`,
`setActiveGLContext` / `getActiveCanvas` / `getActiveGL` /
`clearActiveContext`, the touch event bridge utilities, and the loader
extensions (`loadExpoAsset`, `loadTexture`, `loadExpoFont`,
`loadExpoBitmapFont`) — exist only in the native build. They have no analogue
on the web because PixiJS already speaks browser APIs natively.

### Running the web target

```bash
npx expo start --web
# or for a static export
npx expo export --platform web
```

Bundlers outside Expo (raw webpack / Vite) need to alias `react-native` to
`react-native-web` for `PixiView`'s container `<View>` to work.

### Bitmap fonts on web

`registerBitmapFont(fntFile, [pageFile, ...])` keeps the same shape. Bundlers
hash asset filenames, so the `<page file="..."/>` references inside the `.fnt`
cannot be auto-resolved — pass each page texture in the order the `.fnt`
declares them, exactly as on native.

## Quick Start

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PixiView, Graphics, Application } from '@penabt/pixi-expo';

export default function GameScreen() {
  const handleAppCreate = (app: Application) => {
    // Create a red circle
    const circle = new Graphics().circle(0, 0, 50).fill({ color: 0xff0000 });

    circle.position.set(200, 300);
    app.stage.addChild(circle);

    // Animate with the ticker
    app.ticker.add(() => {
      circle.rotation += 0.01;
    });
  };

  return (
    <View style={styles.container}>
      <PixiView
        style={styles.game}
        backgroundColor={0x1099bb}
        onApplicationCreate={handleAppCreate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  game: { flex: 1 },
});
```

## API Reference

### PixiView Component

The main component for rendering PixiJS content.

```tsx
<PixiView
  style={ViewStyle} // Container styles
  backgroundColor={0x000000} // Background color (hex)
  resolution={1} // Device pixel ratio
  antialias={true} // Enable antialiasing
  onApplicationCreate={(app) => {}} // Called when app is ready
  onContextCreate={(gl) => {}} // Called when GL context created
  onError={(error) => {}} // Called on initialization error
/>
```

### PixiView Ref Handle

Access the PixiJS Application imperatively:

```tsx
const pixiRef = useRef<PixiViewHandle>(null);

// Get the application
const app = pixiRef.current?.getApplication();

// Get the stage
const stage = pixiRef.current?.getStage();

// Force render
pixiRef.current?.render();

// Take screenshot
const base64 = await pixiRef.current?.takeSnapshot();
```

### Re-exported from PixiJS

For convenience, common PixiJS exports are available directly:

```tsx
import {
  // Display Objects
  Application,
  Container,
  Sprite,
  Graphics,
  Text,
  TilingSprite,
  AnimatedSprite,
  Mesh,
  NineSliceSprite,

  // Textures
  Texture,
  RenderTexture,
  Assets,

  // Geometry
  Matrix,
  Point,
  Rectangle,
  Circle,
  Polygon,

  // Filters
  Filter,
  BlurFilter,
  ColorMatrixFilter,

  // Animation
  Ticker,

  // And more...
} from '@penabt/pixi-expo';
```

## Loading Assets

All asset loading goes through the Expo-compatible loader. PixiJS's browser-dependent `loadTextures` parser is replaced automatically — you don't need to do anything special.

Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.gif`, `data:image/*`

### Direct Loading — `Assets.load()`

Works with both `require()` (local bundled) and string URLs (remote):

```tsx
import { Assets, Sprite } from '@penabt/pixi-expo';

// Local asset via require()
const bunny = await Assets.load(require('./assets/bunny.png'));
const sprite = new Sprite(bunny);

// Remote asset via URL
const remote = await Assets.load('https://example.com/sprite.png');
```

### Array Loading — `Assets.load([])`

Load multiple assets at once with array destructuring:

```tsx
import { Assets, Sprite } from '@penabt/pixi-expo';

// Mix require() and remote URLs in a single call
const [frame1, frame2, enemy] = await Assets.load([
  require('./assets/frame-1.png'),
  require('./assets/frame-2.png'),
  'https://example.com/enemy.png',
]);

const sprite1 = new Sprite(frame1);
const sprite2 = new Sprite(frame2);
```

> **Note:** Unlike standard PixiJS (which returns a `Record<string, Texture>` for arrays), `@penabt/pixi-expo` returns an array in the same order as the input — enabling convenient destructuring.

### Manifest & Bundles — `createExpoManifest()`

For larger projects, group assets into bundles and load them on demand:

```tsx
import { Assets, createExpoManifest } from '@penabt/pixi-expo';

const manifest = createExpoManifest({
  bundles: [
    {
      name: 'load-screen',
      assets: [{ alias: 'logo', src: require('./assets/logo.png') }],
    },
    {
      name: 'game',
      assets: [
        { alias: 'hero', src: require('./assets/hero.png') },
        { alias: 'enemy', src: 'https://cdn.example.com/enemy.png' },
      ],
    },
  ],
});

// Initialize once
await Assets.init({ manifest });

// Load bundles on demand
const loadAssets = await Assets.loadBundle('load-screen');
const gameAssets = await Assets.loadBundle('game');
const heroSprite = new Sprite(gameAssets.hero);
```

### Dynamic Bundles — `createExpoBundle()`

Register bundles at runtime:

```tsx
import { Assets, createExpoBundle } from '@penabt/pixi-expo';

Assets.addBundle(
  'powerups',
  createExpoBundle([
    { alias: 'shield', src: require('./assets/shield.png') },
    { alias: 'speed', src: 'https://cdn.example.com/speed.png' },
  ]),
);

const powerups = await Assets.loadBundle('powerups');
```

### BitmapFont

#### Remote Fonts

Load `.fnt` or `.xml` bitmap fonts from a URL — the atlas texture is resolved automatically:

```tsx
import { Assets, BitmapText } from '@penabt/pixi-expo';

await Assets.load('https://example.com/fonts/myfont.xml');

const score = new BitmapText({
  text: 'Score: 0',
  style: { fontFamily: 'MyFont', fontSize: 32 },
});
app.stage.addChild(score);
```

#### Local Fonts — `registerBitmapFont()`

Bundled bitmap fonts need explicit registration because Expo stores assets with hashed filenames — the font definition's internal `<page file="atlas.png"/>` reference can't be resolved automatically.

Use `registerBitmapFont()` to register the font definition and its atlas page(s), then load via `Assets.load()`:

```tsx
import { Assets, BitmapText, registerBitmapFont } from '@penabt/pixi-expo';

// Register the font + atlas PNG(s) — call this at module level
const FONT_KEY = registerBitmapFont(require('./assets/myfont.fnt'), [
  require('./assets/myfont.png'),
]);

// Load inside your PixiView callback
await Assets.load(FONT_KEY);

const score = new BitmapText({
  text: 'Score: 0',
  style: { fontFamily: 'MyFont', fontSize: 32 },
});
app.stage.addChild(score);
```

> **Note:** Multi-page bitmap fonts are supported — pass all atlas PNGs in page order:
> `registerBitmapFont(require('./font.fnt'), [require('./page0.png'), require('./page1.png')])`

#### ⚠️ Use `.fnt`, not `.xml` — Android prebuild caveat

**Always save your font definition file with the `.fnt` extension**, even if its content is XML (BMFont's XML format is valid `.fnt` content).

In Android prebuild release builds, React Native's asset bundler treats `.xml` files as Android **drawable resources** and routes them to `res/drawable-mdpi/`. AAPT2 then compiles them into a binary XML format that text parsers can't read — the file would silently load but render as empty glyphs at runtime. `.fnt` files have no special meaning to AAPT2 and are bundled as raw bytes into `assets/`, so they round-trip cleanly to PixiJS's XML parser.

If you're migrating from a `.xml` font file, just rename the file:

```sh
mv assets/myfont.xml assets/myfont.fnt
```

The file content stays the same — PixiJS detects the format from the bytes, not the extension.

This only affects local bundled fonts in **release builds** with prebuild. Dev mode and Expo Go work with either extension because Metro serves the file directly over HTTP, bypassing AAPT2.

#### Metro Configuration

Bitmap font files must be registered as asset extensions in your `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...(config.resolver.assetExts || []), 'fnt'];

module.exports = config;
```

> If you must keep `.xml` for some reason (e.g. remote fonts), include it too:
> `[...assetExts, 'fnt', 'xml']`. Local `.xml` fonts will still break in Android prebuild release builds — see the caveat above.

## Design Resolution

fFixed coordinate system for your game. Define a virtual resolution and the library renders at native device quality — no GPU texture stretching.

```tsx
<PixiView
  designWidth={720}
  designHeight={1280}
  scaleMode="NO_BORDER"
  backgroundColor={0x1a1a2e}
  onApplicationCreate={(app) => {
    // All coordinates are in 720x1280 space — same on every device
    const sprite = new Sprite(texture);
    sprite.position.set(360, 640); // always center
    app.stage.addChild(sprite);
  }}
/>
```

### Scale Modes

| Mode        | Behavior                                            | Best For              |
| ----------- | --------------------------------------------------- | --------------------- |
| `SHOW_ALL`  | Entire design area visible, letterbox bars on edges | UI-heavy apps, menus  |
| `NO_BORDER` | Fills screen, edges may be cropped                  | Most games            |
| `EXACT_FIT` | Stretches to fill, may distort aspect ratio         | Pixel-perfect layouts |

### How It Works

The renderer operates directly in design coordinates and uses PixiJS's `resolution` property to bridge to physical pixels. Textures render at native device resolution with no GPU upscaling artifacts.

- **NO_BORDER**: `resolution = max(physicalW/designW, physicalH/designH)` — viewport smaller than design, edges cropped
- **SHOW_ALL**: `resolution = min(physicalW/designW, physicalH/designH)` — viewport larger than design, letterbox bars
- **EXACT_FIT**: `resolution = max(resX, resY)` with per-axis stage scale compensation for the non-uniform axis

### Design Tips

- Match your design resolution to your game's orientation (portrait → tall, landscape → wide)
- For `NO_BORDER`, keep important content away from edges — they may be cropped on different aspect ratios
- Use `e.getLocalPosition(app.stage)` for touch coordinates in design space (not `e.global`)
- Access scale info programmatically: `pixiRef.current?.getDesignScale()`

### Extracting Design Scale

```tsx
import { calculateDesignScale } from '@penabt/pixi-expo';

const scale = calculateDesignScale(720, 1280, physicalWidth, physicalHeight, 'NO_BORDER');
// scale.resolution, scale.viewportWidth, scale.viewportHeight, scale.offsetX, scale.offsetY
```

## Safe Area

Built-in safe area support for positioning UI elements away from notches, dynamic islands, and home indicators — all in design resolution coordinates.

### Setup

Pass physical safe area insets to `PixiView` and read them back in design coordinates via the ref handle:

```tsx
import { useRef } from 'react';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PixiView, PixiViewHandle, BitmapText } from '@penabt/pixi-expo';

function GameScreen() {
  const insets = useSafeAreaInsets();
  const pixiRef = useRef<PixiViewHandle>(null);

  return (
    <PixiView
      ref={pixiRef}
      designWidth={720}
      designHeight={1280}
      scaleMode="NO_BORDER"
      safeAreaInsets={insets}
      onApplicationCreate={(app) => {
        // Insets are in design coordinates (720x1280 space)
        const safe = pixiRef.current?.getSafeArea();
        if (!safe) return;

        // Position HUD within safe area
        const score = new BitmapText({ text: 'Score: 0', style: { fontFamily: 'MyFont', fontSize: 32 } });
        score.position.set(safe.left + 20, safe.top + 10);
        app.stage.addChild(score);

        // Bottom button above home indicator
        const button = new BitmapText({ text: 'PLAY', style: { fontFamily: 'MyFont', fontSize: 48 } });
        button.anchor.set(0.5);
        button.position.set(360, 1280 - safe.bottom - 30);
        app.stage.addChild(button);
      }}
    />
  );
}

// Wrap your app with SafeAreaProvider
export default function App() {
  return (
    <SafeAreaProvider>
      <GameScreen />
    </SafeAreaProvider>
  );
}
```

### How It Works

`getSafeArea()` converts physical screen insets to your design coordinate space through the resolution pipeline:

```
viewport_coord = physicalInset × pixelRatio / resolution
design_coord   = (viewport_coord - stageOffset) / stageScale
```

- **NO_BORDER**: Insets are larger because the cropped edges are accounted for
- **SHOW_ALL**: Insets may be zero if the letterbox bars already cover the unsafe region
- **EXACT_FIT**: Insets are scaled per-axis to match the stretch

### Standalone Utility

Use `calculateDesignSafeArea()` outside of `PixiView` for custom setups:

```tsx
import { calculateDesignScale, calculateDesignSafeArea } from '@penabt/pixi-expo';
import { PixelRatio } from 'react-native';

const scale = calculateDesignScale(720, 1280, physicalW, physicalH, 'NO_BORDER');
const safe = calculateDesignSafeArea(insets, scale, 720, 1280, PixelRatio.get());
// safe.top, safe.bottom, safe.left, safe.right — all in 720x1280 space
```

### API

| Prop / Method | Type | Description |
| --- | --- | --- |
| `safeAreaInsets` | `SafeAreaInsets` | Physical insets `{ top, bottom, left, right }` in screen points |
| `getSafeArea()` | `() => DesignSafeArea \| null` | Returns insets in design coordinates (ref handle method) |
| `calculateDesignSafeArea()` | `(insets, scale, dw, dh, pixelRatio) => DesignSafeArea` | Standalone conversion utility |

## Performance Tips

1. **Use Shared Ticker** - PixiView enables `sharedTicker` by default for optimal performance

2. **Batch Rendering** - Group similar sprites using `ParticleContainer` for many objects

3. **Texture Atlases** - Use spritesheets instead of individual images

4. **Avoid Text Updates** - Cache text objects, don't create new ones every frame

5. **Production Builds** - Run `npx expo run:ios --configuration Release` for best performance

## Limitations

- **No Canvas 2D on native** — expo-gl only supports WebGL, not Canvas 2D context. (The web build uses real browser APIs, where Canvas 2D is available — but PixiJS still renders via WebGL there.)
- **No Text on native** — `Text` (canvas-based) and `HTMLText` are not available on native. Use `BitmapText` instead. (`Text` works on web.)
- **Font Loading** — Use `BitmapFont` (`.fnt` + atlas) for in-game text, or `expo-font` for system fonts on native. On Android prebuild release, prefer `.fnt` over `.xml` for the font definition file (see [BitmapFont caveat](#%EF%B8%8F-use-fnt-not-xml--android-prebuild-caveat))
- **Android prebuild — bundled assets** — In release builds, `Asset.fromModule(require('./image.png'))` initially returns a bare resource name (e.g. `assets_icon`) instead of a real `file://` path because the asset is compiled into Android's resource table, not extracted to disk. `loadExpoAsset` and `loadExpoBitmapFont` handle this by force-materializing each asset to the cache directory (`<cacheDir>/pixi-expo/<hash>.<ext>`) on first use, so you don't need to do anything in your app code — it Just Works™. Mentioned here only because it's surprising if you read the source or debug logs

## Compatibility

| Package          | Version  | Notes                                  |
| ---------------- | -------- | -------------------------------------- |
| pixi.js          | ≥ 8.0.0  |                                        |
| expo             | ≥ 50.0.0 |                                        |
| expo-gl          | ≥ 14.0.0 | Native only                            |
| react-native     | ≥ 0.73.0 |                                        |
| react-native-web | ≥ 0.19.0 | Web only (optional peer)               |
| react-dom        | ≥ 18.0.0 | Web only (optional peer)               |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Pena Team](https://github.com/penabt)

---

Made with ❤️ by [Pena Team](https://github.com/penabt)
