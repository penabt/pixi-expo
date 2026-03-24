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

Load `.fnt` or `.xml` bitmap fonts — the atlas texture is loaded automatically:

```tsx
import { Assets, BitmapText } from '@penabt/pixi-expo';

await Assets.load('https://example.com/fonts/myfont.xml');

const score = new BitmapText({
  text: 'Score: 0',
  style: { fontFamily: 'MyFont', fontSize: 32 },
});
app.stage.addChild(score);
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
