import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Pressable, Dimensions, Animated, Easing } from 'react-native';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');
const BALLOON_SIZE = 60;
const BIRD_SIZE = 60;

const LEVEL_COLORS = [
  '#FF5252', // Level 1 - Red
  '#448AFF', // Level 2 - Blue
  '#69F0AE', // Level 3 - Green
  '#E040FB', // Level 4 - Purple
  '#FFD740', // Level 5 - Yellow
  '#FF6E40', // Level 6 - Orange
  '#18FFFF', // Level 7 - Cyan
];

export default function App() {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isPlaying, setIsPlaying] = useState(false);
  const [level, setLevel] = useState(1);
  const [targetsHit, setTargetsHit] = useState(0);

  const [isExploding, setIsExploding] = useState(false);
  const [birdAngry, setBirdAngry] = useState(false);
  
  // Animation variables
  const balloonY = useRef(new Animated.Value(height)).current;
  const balloonX = useRef(new Animated.Value(width / 2)).current;
  const balloonDuration = useRef(3500); // initial duration

  const birdX = useRef(new Animated.Value(-BIRD_SIZE)).current;
  const birdY = useRef(new Animated.Value(height / 3)).current;
  
  const balloonAnimRef = useRef(null);
  const birdAnimRef = useRef(null);
  const birdTimeoutRef = useRef(null);

  // Audio Objects
  const [soundPop, setSoundPop] = useState();
  const [soundMiss, setSoundMiss] = useState();
  const [soundAngry, setSoundAngry] = useState();

  // Load sounds on mount
  useEffect(() => {
    async function loadSounds() {
      try {
        const { sound: p } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg' });
        const { sound: m } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg' });
        const { sound: a } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/woodpecker.ogg' });
        setSoundPop(p);
        setSoundMiss(m);
        setSoundAngry(a);
      } catch (e) {
        console.warn("Could not load sounds", e);
      }
    }
    loadSounds();
    return () => {
      if (soundPop) soundPop.unloadAsync();
      if (soundMiss) soundMiss.unloadAsync();
      if (soundAngry) soundAngry.unloadAsync();
    };
  }, []);

  const playSound = async (sound) => {
    if (sound) {
      try {
        await sound.replayAsync();
      } catch (e) {}
    }
  };

  // Main Game Timer
  useEffect(() => {
    let timer;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isPlaying) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  const endGame = () => {
    setIsPlaying(false);
    if (balloonAnimRef.current) balloonAnimRef.current.stop();
    if (birdAnimRef.current) birdAnimRef.current.stop();
    if (birdTimeoutRef.current) clearTimeout(birdTimeoutRef.current);
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(20);
    setLevel(1);
    setTargetsHit(0);
    balloonDuration.current = 3500;
    setIsPlaying(true);
    
    startBalloon();
    scheduleNextBird();
  };

  // Balloon Animation Logic
  const startBalloon = () => {
    // Random X position between 10 and width-BALLOON_SIZE-10
    const randomX = Math.random() * (width - BALLOON_SIZE - 20) + 10;
    balloonX.setValue(randomX);
    balloonY.setValue(height); // Start at bottom
    
    balloonAnimRef.current = Animated.timing(balloonY, {
      toValue: -BALLOON_SIZE - 50, // Move past top of screen
      duration: balloonDuration.current,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    
    balloonAnimRef.current.start(({ finished }) => {
      if (finished && isPlaying) {
        // If it reached the top without being clicked, restart it
        startBalloon();
      }
    });
  };

  // Bird Animation Logic
  const scheduleNextBird = () => {
    const delay = Math.random() * 2000 + 1000; // 1 to 3 seconds
    birdTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        startBird();
      }
    }, delay);
  };

  const startBird = () => {
    setBirdAngry(false);
    
    const direction = Math.random() > 0.5 ? 1 : -1; // 1 = left to right, -1 = right to left
    const startX = direction === 1 ? -BIRD_SIZE : width;
    const endX = direction === 1 ? width + BIRD_SIZE : -BIRD_SIZE - 50;
    
    const randomY = Math.random() * (height - 350) + 100; // Keep in middle area
    
    birdX.setValue(startX);
    birdY.setValue(randomY);
    
    const speed = Math.random() * 1500 + 2000; // 2 to 3.5 seconds
    
    birdAnimRef.current = Animated.timing(birdX, {
      toValue: endX,
      duration: speed,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    
    birdAnimRef.current.start(({ finished }) => {
      if (finished && isPlaying) {
        scheduleNextBird();
      }
    });
  };

  const handleHitBalloon = () => {
    if (!isPlaying || isExploding) return;
    
    playSound(soundPop);
    setIsExploding(true);
    if (balloonAnimRef.current) balloonAnimRef.current.stop(); // Stop current animation
    
    setScore(s => s + 5);
    setTimeLeft(t => t + 1); // +1 second
    
    // Increase speed by decreasing duration (minimum 600ms)
    balloonDuration.current = Math.max(600, balloonDuration.current - 150);
    
    const newHits = targetsHit + 1;
    if (newHits >= 10) {
      setLevel(l => l + 1);
      setTargetsHit(0);
      setTimeLeft(t => t + 5);
    } else {
      setTargetsHit(newHits);
    }

    // Short explosion effect
    setTimeout(() => {
      setIsExploding(false);
      startBalloon(); // Spawn new balloon
    }, 200);
  };

  const handleHitBird = () => {
    if (!isPlaying || birdAngry) return;
    
    playSound(soundAngry);
    setBirdAngry(true);
    
    if (birdAnimRef.current) birdAnimRef.current.stop(); // Stop bird where it is
    
    setScore(s => s - 10);
    setTimeLeft(t => t - 5); // -5 seconds penalty!
    
    // Show angry reaction, then make bird fly away / respawn
    setTimeout(() => {
      setBirdAngry(false);
      scheduleNextBird();
    }, 800);
  };

  const handleMiss = () => {
    if (isPlaying) {
      playSound(soundMiss);
      setScore(s => s - 2);
    }
  };

  const currentColor = LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];

  return (
    <Pressable style={styles.container} onPress={handleMiss}>
      <Text style={styles.title}>Level {level}</Text>
      
      {!isPlaying && timeLeft === 20 && (
        <View style={styles.menuBox}>
          <Text style={styles.instructions}>
            🎈 Pop 10 balloons to advance! (+1 sec){'\n'}
            🦅 Avoid the birds! (-10 pts & -5 sec){'\n'}
            ❌ Don't miss! (-2 pts)
          </Text>
        </View>
      )}

      <View style={styles.stats}>
        <Text style={styles.score}>Score: {score}</Text>
        <Text style={styles.hits}>Popped: {targetsHit}/10</Text>
        <Text style={styles.timer}>Time: {timeLeft}s</Text>
      </View>

      {isPlaying ? (
        <>
          {/* ANIMATED BALLOON */}
          <Animated.View style={[styles.balloonWrapper, { top: balloonY, left: balloonX }]}>
            <TouchableOpacity onPress={handleHitBalloon} activeOpacity={1}>
              {isExploding ? (
                <Text style={styles.explosion}>💥</Text>
              ) : (
                <View style={[styles.balloon, { backgroundColor: currentColor }]}>
                  <View style={[styles.knot, { borderBottomColor: currentColor }]} />
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* ANIMATED BIRD */}
          <Animated.View style={[styles.birdWrapper, { top: birdY, left: birdX }]}>
            <TouchableOpacity onPress={handleHitBird} activeOpacity={1}>
              <Text style={styles.birdEmoji}>{birdAngry ? '🤬' : '🦅'}</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      ) : (
        <TouchableOpacity style={styles.startButton} onPress={startGame}>
          <Text style={styles.startButtonText}>
            {timeLeft <= 0 ? 'Try Again' : 'Start Game'}
          </Text>
        </TouchableOpacity>
      )}

      {!isPlaying && timeLeft <= 0 && (
        <View style={styles.menuBox}>
          <Text style={styles.gameOver}>Game Over!</Text>
          <Text style={styles.finalScore}>Final Score: {score}</Text>
          <Text style={styles.finalLevel}>Reached Level: {level}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#87CEEB',
    alignItems: 'center',
    paddingTop: 80,
    overflow: 'hidden',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  menuBox: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
  },
  instructions: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    lineHeight: 32,
    fontWeight: 'bold',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '95%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 15,
    marginTop: 10,
    zIndex: 10,
  },
  score: { fontSize: 18, color: '#00E676', fontWeight: 'bold' },
  hits: { fontSize: 18, color: '#FFD740', fontWeight: 'bold' },
  timer: { fontSize: 18, color: '#FF5252', fontWeight: 'bold' },
  
  balloonWrapper: {
    position: 'absolute',
    width: BALLOON_SIZE,
    height: BALLOON_SIZE + 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  balloon: {
    width: BALLOON_SIZE,
    height: BALLOON_SIZE * 1.2,
    borderRadius: BALLOON_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  knot: {
    position: 'absolute',
    bottom: -8,
    left: BALLOON_SIZE / 2 - 5,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  explosion: {
    fontSize: 60,
  },
  birdWrapper: {
    position: 'absolute',
    width: BIRD_SIZE,
    height: BIRD_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 6,
  },
  birdEmoji: {
    fontSize: 50,
  },
  startButton: {
    marginTop: 150,
    backgroundColor: '#FF5252',
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
  },
  startButtonText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  gameOver: { fontSize: 32, color: '#FF5252', fontWeight: 'bold', marginBottom: 10 },
  finalScore: { fontSize: 24, color: '#333', fontWeight: 'bold' },
  finalLevel: { fontSize: 20, color: '#666', marginTop: 10 },
});
