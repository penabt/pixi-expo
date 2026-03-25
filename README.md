# @penabt/pixi-expo

[![npm version](https://img.shields.io/npm/v/@penabt/pixi-expo.svg)](https://www.npmjs.com/package/@penabt/pixi-expo)
[![license](https://img.shields.io/npm/l/@penabt/pixi-expo.svg)](https://github.com/penabt/pixi-expo/blob/main/LICENSE)

**PixiJS v8 adapter for React Native Expo.** Enables hardware-accelerated 2D graphics in your Expo applications using the expo-gl WebGL context.

## Features

- 🚀 **PixiJS v8 Support** - Full compatibility with the latest PixiJS version
- 📱 **Expo Integration** - Works seamlessly with Expo managed and bare workflows
- ⚡ **60 FPS Performance** - Hardware-accelerated WebGL rendering via expo-gl
- 🎮 **Game Ready** - Perfect for 2D games, animations, and interactive graphics
- 📦 **Easy Setup** - Drop-in PixiView component with simple API
- 🔧 **Customizable** - Access to full PixiJS API and expo-gl context

## Installation

```bash
# Install the package
npm install @penabt/pixi-expo

# Install peer dependencies
npx expo install expo-gl expo-asset expo-font pixi.js
```

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

Bundled bitmap fonts need explicit registration because Expo stores assets with hashed filenames — the XML's internal `<page file="atlas.png"/>` reference can't be resolved automatically.

Use `registerBitmapFont()` to register the XML and its atlas page(s), then load via `Assets.load()`:

```tsx
import { Assets, BitmapText, registerBitmapFont } from '@penabt/pixi-expo';

// Register the font XML + atlas PNG(s) — call this at module level
const FONT_KEY = registerBitmapFont(
  require('./assets/myfont.xml'),
  [require('./assets/myfont.png')],
);

// Load inside your PixiView callback
await Assets.load(FONT_KEY);

const score = new BitmapText({
  text: 'Score: 0',
  style: { fontFamily: 'MyFont', fontSize: 32 },
});
app.stage.addChild(score);
```

> **Note:** Multi-page bitmap fonts are supported — pass all atlas PNGs in page order:
> `registerBitmapFont(require('./font.xml'), [require('./page0.png'), require('./page1.png')])`

#### Metro Configuration

Bitmap font files (`.xml`, `.fnt`) must be registered as asset extensions in your `metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [...(config.resolver.assetExts || []), 'xml', 'fnt'];

module.exports = config;
```

## Design Resolution

Fixed coordinate system for your game. Define a virtual resolution and the library automatically scales the stage to fit any device screen.

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

The renderer runs at the device's real screen size for full quality. The stage is transformed (scaled + positioned) so your game logic always works in the design coordinate space.

- **NO_BORDER**: `scale = max(screenW/designW, screenH/designH)` — uniform scale, no gaps, edges cropped
- **SHOW_ALL**: `scale = min(screenW/designW, screenH/designH)` — uniform scale, no crop, bars on short axis
- **EXACT_FIT**: `scaleX = screenW/designW, scaleY = screenH/designH` — non-uniform, fills exactly

### Design Tips

- Match your design resolution to your game's orientation (portrait → tall, landscape → wide)
- For `NO_BORDER`, keep important content away from edges — they may be cropped on different aspect ratios
- Use `e.getLocalPosition(app.stage)` for touch coordinates in design space (not `e.global`)
- Access scale info programmatically: `pixiRef.current?.getDesignScale()`

### Extracting Design Scale

```tsx
import { calculateDesignScale } from '@penabt/pixi-expo';

const scale = calculateDesignScale(720, 1280, screenWidth, screenHeight, 'NO_BORDER');
// scale.scaleX, scale.scaleY, scale.offsetX, scale.offsetY
```

## Performance Tips

1. **Use Shared Ticker** - PixiView enables `sharedTicker` by default for optimal performance

2. **Batch Rendering** - Group similar sprites using `ParticleContainer` for many objects

3. **Texture Atlases** - Use spritesheets instead of individual images

4. **Avoid Text Updates** - Cache text objects, don't create new ones every frame

5. **Production Builds** - Run `npx expo run:ios --configuration Release` for best performance

## Limitations

- **No Canvas 2D** — expo-gl only supports WebGL, not Canvas 2D context
- **No Text** — `Text` (canvas-based) and `HTMLText` are not available. Use `BitmapText` instead
- **Font Loading** — Use `BitmapFont` (`.fnt`/`.xml` + atlas) for in-game text, or `expo-font` for system fonts

## Compatibility

| Package      | Version  |
| ------------ | -------- |
| pixi.js      | ≥ 8.0.0  |
| expo         | ≥ 50.0.0 |
| expo-gl      | ≥ 14.0.0 |
| react-native | ≥ 0.73.0 |

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [Pena Team](https://github.com/penabt)

---

Made with ❤️ by [Pena Team](https://github.com/penabt)
