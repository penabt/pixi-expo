import { useCallback, useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  PixiView,
  Sprite,
  Application,
  loadTexture,
  Container,
  FederatedPointerEvent,
  Rectangle,
  Texture,
  Graphics,
} from '@penabt/pixi-expo';

export default function App() {
  const fpsRef = useRef(0);
  const [displayFps, setDisplayFps] = useState(0);
  const [touchInfo, setTouchInfo] = useState<string>('Drag the bunnies!');

  // Update displayed FPS every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayFps(fpsRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleAppCreate = useCallback(async (app: Application) => {
    console.log('PixiJS Application created!');
    console.log(
      `[Debug] Screen: ${app.screen.width}x${app.screen.height}, Res: ${app.renderer.resolution}`,
    );

    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    // Center container
    const mainContainer = new Container();
    app.stage.addChild(mainContainer);

    // --- Interaction Background ---
    // A huge invisible box to catch all events
    const bg = new Sprite(Texture.WHITE);
    bg.width = screenWidth;
    bg.height = screenHeight;
    bg.tint = 0x222222;
    bg.eventMode = 'static';
    app.stage.addChildAt(bg, 0);

    // --- Debug Pointer Dot ---
    const dot = new Graphics().circle(0, 0, 10).fill(0xff0000);
    dot.visible = false;
    app.stage.addChild(dot);

    // Make stage interactive
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    // Multi-touch tracking map: pointerId -> DraggedObject
    const draggingMap = new Map<number, Sprite>();

    try {
      const bunnyTexture = await loadTexture(require('./assets/bunny.png'));

      // Create 4 bunnies for multi-touch testing
      for (let i = 0; i < 4; i++) {
        const bunny = new Sprite(bunnyTexture);
        bunny.anchor.set(0.5);
        bunny.scale.set(4);
        // Arrange safely for different screen sizes
        const col = i % 2;
        const row = Math.floor(i / 2);
        bunny.position.set(
          screenWidth / 2 + (col === 0 ? -80 : 80),
          screenHeight / 2 + (row === 0 ? -80 : 80),
        );

        bunny.eventMode = 'static';
        bunny.cursor = 'pointer';

        // Add a explicit hit area to make it easier to grab
        bunny.hitArea = new Rectangle(-20, -20, 40, 40);

        bunny.on('pointerdown', (e: FederatedPointerEvent) => {
          // Track this specific pointer for this bunny
          draggingMap.set(e.pointerId, bunny);
          bunny.alpha = 0.5;
          setTouchInfo(`Dragging Bunny (ID: ${e.pointerId})`);
          console.log(`Bunny grabbed by pointer ${e.pointerId}`);

          // Stop propagation so stage doesn't get the click
          e.stopPropagation();
        });

        mainContainer.addChild(bunny);
      }

      // Interaction listeners on background/stage
      app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
        dot.visible = true;
        dot.position.copyFrom(e.global);
        console.log(
          `Stage Down at: ${Math.round(e.global.x)}, ${Math.round(e.global.y)} (ID: ${e.pointerId})`,
        );
      });

      app.stage.on('pointermove', (e: FederatedPointerEvent) => {
        // Update debug dot for the latest moving pointer
        if (dot.visible) {
          dot.position.copyFrom(e.global);
        }

        // Move specific object if this pointer is dragging one
        const draggedBunny = draggingMap.get(e.pointerId);
        if (draggedBunny) {
          draggedBunny.position.copyFrom(e.global);
        }
      });

      const onPointerUp = (e: FederatedPointerEvent) => {
        const draggedBunny = draggingMap.get(e.pointerId);
        if (draggedBunny) {
          draggedBunny.alpha = 1;
          draggingMap.delete(e.pointerId);
          setTouchInfo('Bunny dropped!');
        }
        // Only hide dot if no pointers are down?
        // For simplicity, we just leave it or hide it.
        // dot.visible = false;
      };

      app.stage.on('pointerup', onPointerUp);
      app.stage.on('pointerupoutside', onPointerUp);
      app.stage.on('pointercancel', onPointerUp);
    } catch (error) {
      console.error('Failed to load bunny:', error);
    }

    // FPS tracking
    let frameCount = 0;
    let lastTime = performance.now();
    app.ticker.add(() => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 500) {
        fpsRef.current = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>PixiJS Drag & Drop Test</Text>
        <Text style={styles.fps}>FPS: {displayFps}</Text>
      </View>
      <View style={styles.touchInfoContainer}>
        <Text style={styles.touchInfo}>{touchInfo}</Text>
      </View>
      <PixiView
        style={styles.canvas}
        backgroundColor={0x1a1a1a}
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
