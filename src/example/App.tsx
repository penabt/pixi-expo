/**
 * Example usage of @pixi/expo
 *
 * This demonstrates how to use PixiJS with expo-gl in a React Native app.
 */

import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { PixiView, PixiViewHandle } from '../index';
import {
    Application,
    Graphics,
    Text as PixiText,
    Container,
    Ticker,
} from 'pixi.js';

export default function App() {
    const pixiViewRef = useRef<PixiViewHandle>(null);
    const shapesRef = useRef<Container | null>(null);

    // Called when the PixiJS application is ready
    const handleApplicationCreate = useCallback((app: Application) => {
        console.log('PixiJS Application created!');
        console.log('Screen size:', app.screen.width, 'x', app.screen.height);

        // Create a container for our shapes
        const shapes = new Container();
        shapes.x = app.screen.width / 2;
        shapes.y = app.screen.height / 2;
        app.stage.addChild(shapes);
        shapesRef.current = shapes;

        // Create a red square
        const square = new Graphics()
            .rect(-50, -50, 100, 100)
            .fill({ color: 0xff0000 });
        shapes.addChild(square);

        // Create a blue circle
        const circle = new Graphics()
            .circle(0, 100, 40)
            .fill({ color: 0x0000ff });
        shapes.addChild(circle);

        // Create a green triangle
        const triangle = new Graphics()
            .poly([0, -80, 40, 0, -40, 0])
            .fill({ color: 0x00ff00 });
        triangle.y = -100;
        shapes.addChild(triangle);

        // Add a text label
        const text = new PixiText({
            text: 'PixiJS + Expo GL',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: 0xffffff,
                align: 'center',
            },
        });
        text.anchor.set(0.5);
        text.y = 180;
        shapes.addChild(text);

        // Animate the shapes
        app.ticker.add((ticker: Ticker) => {
            // Rotate the container
            shapes.rotation += 0.01 * ticker.deltaTime;

            // Pulse the circle
            circle.scale.set(1 + Math.sin(Date.now() / 200) * 0.1);

            // Bounce the triangle
            triangle.y = -100 + Math.sin(Date.now() / 300) * 20;
        });
    }, []);

    // Button to add a random shape
    const addRandomShape = useCallback(() => {
        if (!shapesRef.current) return;

        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xffeaa7];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 20 + Math.random() * 40;

        const shape = new Graphics();

        // Random shape type
        const shapeType = Math.floor(Math.random() * 3);
        switch (shapeType) {
            case 0: // Rectangle
                shape.rect(-size / 2, -size / 2, size, size).fill({ color });
                break;
            case 1: // Circle
                shape.circle(0, 0, size / 2).fill({ color });
                break;
            case 2: // Triangle
                shape.poly([0, -size / 2, size / 2, size / 2, -size / 2, size / 2]).fill({ color });
                break;
        }

        // Random position around center
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        shape.x = Math.cos(angle) * distance;
        shape.y = Math.sin(angle) * distance;

        shapesRef.current.addChild(shape);
    }, []);

    // Button to clear extra shapes
    const clearShapes = useCallback(() => {
        if (!shapesRef.current) return;

        // Keep only the first 4 children (original shapes + text)
        while (shapesRef.current.children.length > 4) {
            shapesRef.current.removeChildAt(shapesRef.current.children.length - 1);
        }
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            <View style={styles.header}>
                <Text style={styles.title}>PixiJS + Expo GL Demo</Text>
                <Text style={styles.subtitle}>Touch buttons to interact</Text>
            </View>

            <View style={styles.canvasContainer}>
                <PixiView
                    ref={pixiViewRef}
                    style={styles.canvas}
                    backgroundColor={0x1a1a2e}
                    onApplicationCreate={handleApplicationCreate}
                    onError={(error) => {
                        console.error('PixiView error:', error);
                    }}
                />
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.button} onPress={addRandomShape}>
                    <Text style={styles.buttonText}>Add Shape</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearShapes}>
                    <Text style={styles.buttonText}>Clear</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f1a',
    },
    header: {
        padding: 20,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    subtitle: {
        fontSize: 14,
        color: '#888888',
        marginTop: 4,
    },
    canvasContainer: {
        flex: 1,
        margin: 10,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1a1a2e',
    },
    canvas: {
        flex: 1,
    },
    buttonContainer: {
        flexDirection: 'row',
        padding: 20,
        gap: 10,
    },
    button: {
        flex: 1,
        backgroundColor: '#4ecdc4',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    dangerButton: {
        backgroundColor: '#ff6b6b',
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
