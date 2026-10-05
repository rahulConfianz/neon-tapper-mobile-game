import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Increased difficulty: smaller target
const TARGET_SIZE = 45;

export default function App() {
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [isPlaying, setIsPlaying] = useState(false);
    const [targetPosition, setTargetPosition] = useState({ top: height / 2 - TARGET_SIZE / 2, left: width / 2 - TARGET_SIZE / 2 });
    const [targetColor, setTargetColor] = useState('#00E676'); // Neon green

    useEffect(() => {
        let timer;
        if (isPlaying && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsPlaying(false);
        }
        return () => clearInterval(timer);
    }, [isPlaying, timeLeft]);

    const startGame = () => {
        setScore(0);
        setTimeLeft(15);
        setIsPlaying(true);
        moveTarget();
    };

    const moveTarget = () => {
        // Keep target within safe screen bounds
        const newTop = Math.random() * (height - 300) + 120; // Safe area
        const newLeft = Math.random() * (width - TARGET_SIZE - 20) + 10;

        // Change color randomly for fun each tap!
        const colors = ['#00E676', '#E040FB', '#00E5FF', '#FFEA00'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        setTargetPosition({ top: newTop, left: newLeft });
        setTargetColor(randomColor);
    };

    const handleTapTarget = () => {
        if (isPlaying) {
            setScore((prev) => prev + 2); // 2 points for a hit
            moveTarget();
        }
    };

    const handleMiss = () => {
        if (isPlaying) {
            // Penalty: lose 1 point when tapping the background!
            setScore((prev) => prev - 1);
        }
    };

    return (
        <Pressable style={styles.container} onPress={handleMiss}>
            <Text style={styles.title}>Neon Tapper</Text>

            {!isPlaying && timeLeft === 15 && (
                <Text style={styles.instructions}>
                    Tap the glowing square as fast as you can. {'\n\n'}
                    <Text style={{ color: '#00E676', fontWeight: 'bold' }}>+2 points for a hit</Text>{'\n'}
                    <Text style={{ color: '#FF5252', fontWeight: 'bold' }}>-1 point for a miss!</Text>
                </Text>
            )}

            <View style={styles.stats}>
                <Text style={styles.score}>Score: {score}</Text>
                <Text style={styles.timer}>Time: {timeLeft}s</Text>
            </View>

            {isPlaying ? (
                <TouchableOpacity
                    style={[
                        styles.target,
                        {
                            top: targetPosition.top,
                            left: targetPosition.left,
                            backgroundColor: targetColor,
                            shadowColor: targetColor
                        }
                    ]}
                    onPress={handleTapTarget}
                    activeOpacity={0.6}
                />
            ) : (
                <TouchableOpacity style={styles.startButton} onPress={startGame}>
                    <Text style={styles.startButtonText}>
                        {timeLeft === 0 ? 'Play Again' : 'Start Game'}
                    </Text>
                </TouchableOpacity>
            )}

            {!isPlaying && timeLeft === 0 && (
                <Text style={styles.gameOver}>Game Over! Final Score: {score}</Text>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A', // Darker background
        alignItems: 'center',
        paddingTop: 80,
    },
    title: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 10,
        letterSpacing: 2,
    },
    instructions: {
        fontSize: 16,
        color: '#A0A0B0',
        textAlign: 'center',
        paddingHorizontal: 30,
        marginBottom: 20,
        lineHeight: 24,
    },
    stats: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '85%',
        marginBottom: 20,
        backgroundColor: '#1E1E2E',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#333344',
    },
    score: {
        fontSize: 20,
        color: '#00E676',
        fontWeight: 'bold',
    },
    timer: {
        fontSize: 20,
        color: '#FF5252',
        fontWeight: 'bold',
    },
    target: {
        position: 'absolute',
        width: TARGET_SIZE,
        height: TARGET_SIZE,
        borderRadius: 10, // Making it a square now for higher difficulty feel!
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 15,
        elevation: 10,
    },
    startButton: {
        marginTop: 200,
        backgroundColor: '#6200EA',
        paddingVertical: 18,
        paddingHorizontal: 50,
        borderRadius: 30,
        shadowColor: '#6200EA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
    startButtonText: {
        fontSize: 22,
        color: '#FFFFFF',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    gameOver: {
        marginTop: 50,
        fontSize: 26,
        color: '#FFEA00',
        fontWeight: 'bold',
    },
});
