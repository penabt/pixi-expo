import React, { useCallback, useRef, useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PixiView, Graphics, Sprite, Application, loadTexture } from '@penabt/pixi-expo';



export default function App() {
  const fpsRef = useRef(0);
  const [displayFps, setDisplayFps] = useState(0);

  // Update displayed FPS every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayFps(fpsRef.current);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleAppCreate = useCallback(async (app: Application) => {
    console.log('PixiJS Application created!');

    const screenWidth = app.screen.width;
    const screenHeight = app.screen.height;

    // --- New Ball Animations (X-axis centered) ---
    // Create 3 balls with different colors
    const colors = [0xff3366, 0x3366ff, 0x33ff66];
    const balls: { graphic: Graphics; offset: number; speed: number; range: number; baseY: number }[] = [];

    colors.forEach((color, index) => {
      const ball = new Graphics()
        .circle(0, 0, 40)
        .fill({ color });

      // Center vertically, distribute horizontally initially or just center
      ball.position.set(screenWidth / 2, screenHeight / 2 - 150);

      app.stage.addChild(ball);

      balls.push({
        graphic: ball,
        offset: index * 2, // Phase shift
        speed: 2 + index * 0.5,
        range: 100 + index * 20,
        baseY: screenHeight / 2 - 350 // Calculate base Y once
      });
    });

    // --- Restore Bunny Animations ---
    let bunnies: (Sprite | Graphics)[] = [];

    try {
      console.log('Loading bunny from local assets');

      // Use Assets.load for local asset
      const bunnyTexture = await loadTexture(require('./assets/bunny.png'));

      console.log('Bunny texture loaded successfully!');

      // Create multiple bunnies with jumping animation
      const bunnyCount = 5;

      for (let i = 0; i < bunnyCount; i++) {
        const bunny = new Sprite(bunnyTexture);

        // Center the anchor
        bunny.anchor.set(0.5);

        // Scale up the bunny (original is 26x37)
        bunny.scale.set(3);

        // Position bunnies across the right side of the screen
        // Adjusted Y to be below the balls so they don't overlap too much
        bunny.position.set(
          screenWidth / 2 + 50 + (i - 2) * 70,
          screenHeight / 2 + 100
        );

        // Store initial Y position and random jump offset
        (bunny as any).baseY = bunny.position.y;
        (bunny as any).jumpOffset = i * 0.5; // Stagger the jumps
        (bunny as any).jumpSpeed = 3 + Math.random() * 2;
        (bunny as any).jumpHeight = 100 + Math.random() * 50;
        (bunny as any).baseScale = 3;

        app.stage.addChild(bunny);
        bunnies.push(bunny);
      }

      console.log(`Created ${bunnyCount} bunnies with jumping animation!`);

    } catch (error) {
      console.error('Failed to load bunny:', error);

      // Create placeholder circles instead of bunnies if load fails
      console.log('Creating placeholder circles...');
      for (let i = 0; i < 5; i++) {
        const placeholder = new Graphics()
          .circle(0, 0, 30)
          .fill({ color: 0xffcc00 })
          .stroke({ width: 3, color: 0xff8800 });

        placeholder.position.set(
          screenWidth / 2 + 50 + (i - 2) * 70,
          screenHeight / 2 + 100
        );

        (placeholder as any).baseY = placeholder.position.y;
        (placeholder as any).jumpOffset = i * 0.5;
        (placeholder as any).jumpSpeed = 3 + Math.random() * 2;
        (placeholder as any).jumpHeight = 100 + Math.random() * 50;
        (placeholder as any).baseScale = 1;

        app.stage.addChild(placeholder);
        bunnies.push(placeholder);
      }
      console.log('Created placeholder circles');
    }

    // FPS tracking
    let frameCount = 0;
    let lastTime = performance.now();

    // Animate using ticker
    app.ticker.add((ticker: { lastTime: number }) => {
      const time = ticker.lastTime / 1000;

      // Animate Balls
      balls.forEach((b) => {
        // Horizontal oscillation on X axis
        const xOffset = Math.sin(time * b.speed + b.offset) * b.range;
        b.graphic.position.x = (screenWidth / 2) + xOffset;

        // Ensure Y stays centered
        b.graphic.position.y = b.baseY;
      });

      // Animate Bunnies
      bunnies.forEach((bunny) => {
        const b = bunny as any;
        const baseScale = b.baseScale || 1;

        // Bouncing jump animation using sine wave
        const jumpPhase = time * b.jumpSpeed + b.jumpOffset;
        const jumpY = Math.abs(Math.sin(jumpPhase)) * b.jumpHeight;

        // Apply jump (negative Y goes up in PixiJS)
        bunny.position.y = b.baseY - jumpY;

        // Slight rotation wobble during jump
        bunny.rotation = Math.sin(jumpPhase * 2) * 0.2;

        // Squash and stretch effect
        const stretchFactor = 1 + Math.abs(Math.cos(jumpPhase)) * 0.2;
        const squashFactor = 1 - Math.abs(Math.cos(jumpPhase)) * 0.15;
        bunny.scale.set(baseScale * squashFactor, baseScale * stretchFactor);
      });

      // Calculate FPS
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 500) {
        fpsRef.current = Math.round(frameCount * 1000 / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
      }
    });

  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🐰 @penabt/pixi-expo</Text>
        <Text style={styles.fps}>FPS: {displayFps}</Text>
      </View>
      <PixiView
        style={styles.canvas}
        backgroundColor={0x000000}
        onApplicationCreate={handleAppCreate}
      />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 55,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fps: {
    color: '#33ff66',
    fontSize: 16,
    fontWeight: 'bold',
  },
  canvas: {
    flex: 1,
  },
});
