import { useCallback, useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PixiView,
  Sprite,
  Application,
  Container,
  FederatedPointerEvent,
  Rectangle,
  Texture,
  Graphics,
  Assets,
  Text as PixiText,
  TextStyle,
  BitmapText,
  createExpoManifest,
  registerBitmapFont,
} from '@penabt/pixi-expo';

// =============================================================================
// MANIFEST — bundle-based loading
// =============================================================================

const manifest = createExpoManifest({
  bundles: [
    {
      name: 'load-screen',
      assets: [{ alias: 'logo', src: require('./assets/icon.png') }],
    },
    {
      name: 'game-screen',
      assets: [
        { alias: 'bunny-local', src: require('./assets/bunny.png') },
        { alias: 'bunny-remote', src: 'https://pixijs.com/assets/bunny.png' },
      ],
    },
  ],
});

// BitmapFont — local require() with registerBitmapFont
// XML references "desyrel.png" internally, but Expo bundles with hashed paths,
// so we register both the XML and its atlas page explicitly.
const BITMAP_FONT_KEY = registerBitmapFont(require('./assets/desyrel.xml'), [
  require('./assets/desyrel.png'),
]);

// =============================================================================
// DESIGN RESOLUTION
// Fixed coordinate system — all positions are in this space regardless of device
// =============================================================================

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

// =============================================================================
// BUNNY CONFIG
// =============================================================================

const BUNNIES = [
  { alias: 'bunny-local', border: 0xff0000, label: 'Bundle\nLocal' },
  { alias: 'bunny-remote', border: 0x3399ff, label: 'Bundle\nRemote' },
  { alias: 'direct-local', border: 0xff8800, label: 'Direct\nLocal' },
  { alias: 'direct-remote', border: 0x33cc33, label: 'Direct\nRemote' },
];

function createBorder(w: number, h: number, color: number): Graphics {
  return new Graphics().rect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8).stroke({ color, width: 3 });
}

export default function App() {
  const fpsRef = useRef(0);
  const [displayFps, setDisplayFps] = useState(0);
  const [touchInfo, setTouchInfo] = useState<string>('Loading assets...');

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayFps(fpsRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleAppCreate = useCallback(async (app: Application) => {
    console.log('PixiJS Application created!');

    // Use fixed design resolution coordinates — these are the same on every device
    const screenWidth = DESIGN_WIDTH;
    const screenHeight = DESIGN_HEIGHT;

    // =========================================================================
    // PHASE 1: Load screen bundle
    // =========================================================================

    await Assets.init({ manifest });
    const loadScreenAssets = await Assets.loadBundle('load-screen');
    console.log('Load screen bundle loaded:', Object.keys(loadScreenAssets));

    const logo = new Sprite(loadScreenAssets.logo);
    logo.anchor.set(0.5);
    logo.position.set(screenWidth / 2, screenHeight / 2);
    logo.scale.set(0.5);
    app.stage.addChild(logo);

    // =========================================================================
    // PHASE 2: Load BitmapFont (local require() via registerBitmapFont)
    // =========================================================================

    await Assets.load(BITMAP_FONT_KEY);
    console.log('BitmapFont loaded (local)');

    // =========================================================================
    // PHASE 3: Game screen bundle (local + remote textures)
    // =========================================================================

    const gameAssets = await Assets.loadBundle('game-screen');
    console.log('Game bundle loaded:', Object.keys(gameAssets));

    // =========================================================================
    // PHASE 4: Direct Assets.load — array with require() + remote URL
    // =========================================================================

    const [directLocal, directRemote] = await Assets.load([
      require('./assets/bunny.png'),
      'https://pixijs.com/assets/bunny.png',
    ]);
    console.log('Direct array load done:', !!directLocal, !!directRemote);

    const textures: Record<string, Texture> = {
      'bunny-local': gameAssets['bunny-local'],
      'bunny-remote': gameAssets['bunny-remote'],
      'direct-local': directLocal,
      'direct-remote': directRemote,
    };

    // Remove loading logo
    app.stage.removeChild(logo);
    logo.destroy();

    // =========================================================================
    // PHASE 5: Build game scene with BitmapText labels
    // =========================================================================

    const bg = new Sprite(Texture.WHITE);
    bg.width = screenWidth;
    bg.height = screenHeight;
    bg.tint = 0x222222;
    bg.eventMode = 'static';
    app.stage.addChild(bg);

    app.stage.eventMode = 'static';
    app.stage.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);

    const mainContainer = new Container();
    app.stage.addChild(mainContainer);

    const dot = new Graphics().circle(0, 0, 10).fill(0xff0000);
    dot.visible = false;
    app.stage.addChild(dot);

    const draggingMap = new Map<number, Container>();

    const positions = [
      { col: -1, row: -1 },
      { col: 1, row: -1 },
      { col: -1, row: 1 },
      { col: 1, row: 1 },
    ];

    for (let i = 0; i < BUNNIES.length; i++) {
      const { alias, border: borderColor, label } = BUNNIES[i];
      const texture = textures[alias];

      const bunnyContainer = new Container();
      const { col, row } = positions[i];
      bunnyContainer.position.set(screenWidth / 2 + col * 80, screenHeight / 2 + row * 80);

      // Bunny sprite
      const bunny = new Sprite(texture);
      bunny.anchor.set(0.5);
      bunny.scale.set(4);
      bunnyContainer.addChild(bunny);

      // Border
      const scaledW = texture.width * 4;
      const scaledH = texture.height * 4;
      const borderGfx = createBorder(scaledW, scaledH, borderColor);
      bunnyContainer.addChild(borderGfx);

      // BitmapText label below the bunny
      const lines = label.split('\n');
      lines.forEach((line, lineIdx) => {
        const bitmapLabel = new BitmapText({
          text: line,
          style: {
            fontFamily: 'Desyrel',
            fontSize: 24,
          },
        });
        bitmapLabel.anchor.set(0.5);
        bitmapLabel.tint = borderColor;
        bitmapLabel.position.set(0, scaledH / 2 + 14 + lineIdx * 22);
        bunnyContainer.addChild(bitmapLabel);
      });

      // Interaction
      bunnyContainer.eventMode = 'static';
      bunnyContainer.cursor = 'pointer';
      bunnyContainer.hitArea = new Rectangle(
        -scaledW / 2 - 4,
        -scaledH / 2 - 4,
        scaledW + 8,
        scaledH + 60,
      );

      bunnyContainer.on('pointerdown', (e: FederatedPointerEvent) => {
        draggingMap.set(e.pointerId, bunnyContainer);
        bunnyContainer.alpha = 0.5;
        setTouchInfo(`Dragging ${lines.join(' ')}`);
        e.stopPropagation();
      });

      mainContainer.addChild(bunnyContainer);
    }

    // Title text at top
    const title = new BitmapText({
      text: 'Bundle + Direct Load',
      style: { fontFamily: 'Desyrel', fontSize: 36 },
    });
    title.anchor.set(0.5);
    title.tint = 0xffffff;
    title.position.set(screenWidth / 2, 30);
    app.stage.addChild(title);

    // =========================================================================
    // CANVAS 2D POLYFILL TEST
    // PixiJS Text uses CanvasTextMetrics internally (context.font + measureText).
    // The mock Canvas2D context prevents crashes — fillText is a no-op so the
    // texture is transparent, but measureText() returns valid metrics.
    // =========================================================================

    // Create a PixiJS Text object to exercise the Canvas2D polyfill path.
    // This will NOT be visible (mock fillText is no-op) but must not crash.
    const _polyfillTest = new PixiText({
      text: 'Canvas2D Polyfill OK',
      style: new TextStyle({ fontSize: 20, fill: 0x00ff88 }),
    });
    console.log('Canvas2D polyfill test: Text created, measured width =', _polyfillTest.width);
    _polyfillTest.destroy();

    // Visible confirmation via BitmapText (uses pre-rendered atlas, not Canvas2D)
    const polyfillLabel = new BitmapText({
      text: 'Canvas2D Polyfill OK',
      style: { fontFamily: 'Desyrel', fontSize: 24 },
    });
    polyfillLabel.anchor.set(0.5);
    polyfillLabel.tint = 0x00ff88;
    polyfillLabel.position.set(screenWidth / 2, screenHeight - 40);
    app.stage.addChild(polyfillLabel);

    setTouchInfo('Drag the bunnies!');

    // =========================================================================
    // INTERACTION
    // =========================================================================

    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      dot.visible = true;
      const local = e.getLocalPosition(app.stage);
      dot.position.set(local.x, local.y);
    });

    app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      const local = e.getLocalPosition(app.stage);
      if (dot.visible) dot.position.set(local.x, local.y);
      const dragged = draggingMap.get(e.pointerId);
      if (dragged) dragged.position.set(local.x, local.y);
    });

    const onPointerUp = (e: FederatedPointerEvent) => {
      const dragged = draggingMap.get(e.pointerId);
      if (dragged) {
        dragged.alpha = 1;
        draggingMap.delete(e.pointerId);
        setTouchInfo('Bunny dropped!');
      }
    };

    app.stage.on('pointerup', onPointerUp);
    app.stage.on('pointerupoutside', onPointerUp);
    app.stage.on('pointercancel', onPointerUp);

    // FPS
    let frameCount = 0;
    let lastTime = performance.now();
    app.ticker.add(() => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 500) {
        fpsRef.current = Math.round((frameCount * 1000) / (now - lastTime));
        frameCount = 0;
        lastTime = now;
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Design Resolution Demo</Text>
        <Text style={styles.fps}>FPS: {displayFps}</Text>
      </View>
      <View style={styles.touchInfoContainer}>
        <Text style={styles.touchInfo}>{touchInfo}</Text>
      </View>
      <PixiView
        style={styles.canvas}
        backgroundColor={0x0a0a1a}
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        scaleMode="NO_BORDER"
        onApplicationCreate={handleAppCreate}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  fps: {
    color: '#33ff66',
    fontSize: 14,
  },
  touchInfoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  touchInfo: {
    color: '#ffcc00',
    fontSize: 16,
    fontWeight: '500',
  },
  canvas: {
    flex: 1,
  },
});
