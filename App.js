import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TouchableWithoutFeedback, Pressable, Dimensions, Animated, Easing } from 'react-native';
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

let entityIdCounter = 0;

export default function App() {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [isPlaying, setIsPlaying] = useState(false);
  const [level, setLevel] = useState(1);
  const [targetsHit, setTargetsHit] = useState(0);

  const [balloons, setBalloons] = useState([]);
  const [birds, setBirds] = useState([]);

  // Variables to manage speed and spawn frequency
  const spawnInterval = useRef(1500); // milliseconds between balloon spawns
  const balloonSpeed = useRef(4000);  // duration to cross the screen

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

  // Spawner loop for generating MULTIPLE balloons and birds
  useEffect(() => {
    let timeout;
    const spawnLoop = () => {
      if (isPlaying) {
        spawnBalloon();
        
        // 35% chance to spawn a bird along with the balloon
        if (Math.random() < 0.35) {
          spawnBird();
        }
        
        timeout = setTimeout(spawnLoop, spawnInterval.current);
      }
    };
    if (isPlaying) {
      spawnLoop();
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, level]);

  const endGame = () => {
    setIsPlaying(false);
    setBalloons([]);
    setBirds([]);
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(20);
    setLevel(1);
    setTargetsHit(0);
    spawnInterval.current = 1500; // Reset spawn interval
    balloonSpeed.current = 4000;  // Reset move speed
    setBalloons([]);
    setBirds([]);
    setIsPlaying(true);
  };

  const spawnBalloon = () => {
    entityIdCounter++;
    // We capture the current level's color when spawning so it stays that color
    const newBalloon = { 
      id: entityIdCounter, 
      color: LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length], 
      duration: balloonSpeed.current 
    };
    setBalloons(prev => [...prev, newBalloon]);
  };

  const spawnBird = () => {
    entityIdCounter++;
    const speed = Math.random() * 1500 + 2000; // 2 to 3.5s
    const newBird = { id: entityIdCounter, speed };
    setBirds(prev => [...prev, newBird]);
  };

  const removeBalloon = useCallback((id) => {
    setBalloons(prev => prev.filter(b => b.id !== id));
  }, []);

  const removeBird = useCallback((id) => {
    setBirds(prev => prev.filter(b => b.id !== id));
  }, []);

  const handleHitBalloon = useCallback((id) => {
    playSound(soundPop);
    
    setScore(s => s + 5);
    setTimeLeft(t => t + 1); // +1 second
    
    // INCREASE DIFFICULTY ON EVERY HIT
    spawnInterval.current = Math.max(300, spawnInterval.current - 40); // Spawn faster (down to 300ms)
    balloonSpeed.current = Math.max(800, balloonSpeed.current - 100);  // Move faster (down to 800ms)

    setTargetsHit(prev => {
      const newHits = prev + 1;
      if (newHits >= 10) {
        // Level up immediately
        setLevel(l => l + 1);
        setTimeLeft(t => t + 5);
        return 0;
      }
      return newHits;
    });
  }, [soundPop]);

  const handleHitBird = useCallback((id) => {
    playSound(soundAngry);
    setScore(s => s - 10);
    setTimeLeft(t => t - 5);
  }, [soundAngry]);

  const handleMiss = () => {
    if (isPlaying) {
      playSound(soundMiss);
      setScore(s => s - 2);
    }
  };

  return (
    <View 
      style={styles.container} 
      onStartShouldSetResponder={() => true}
      onResponderGrant={handleMiss}
    >
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

      {isPlaying && (
        <>
          {balloons.map(b => (
            <Balloon key={b.id} id={b.id} color={b.color} duration={b.duration} onHit={handleHitBalloon} onEscape={removeBalloon} />
          ))}
          {birds.map(b => (
            <Bird key={b.id} id={b.id} speed={b.speed} onHit={handleHitBird} onEscape={removeBird} />
          ))}
        </>
      )}

      {!isPlaying && timeLeft <= 0 ? (
        <View style={styles.menuBox}>
          <Text style={styles.gameOver}>Game Over!</Text>
          <Text style={styles.finalScore}>Final Score: {score}</Text>
          <Text style={styles.finalLevel}>Reached Level: {level}</Text>
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (!isPlaying && (
        <TouchableOpacity style={styles.startButton} onPress={startGame}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Separate Balloon Component for individual animation logic
const Balloon = React.memo(({ id, color, duration, onHit, onEscape }) => {
  const yAnim = useRef(new Animated.Value(height)).current;
  const xPos = useRef(Math.random() * (width - BALLOON_SIZE - 20) + 10).current;
  const [isExploding, setIsExploding] = useState(false);
  const isDead = useRef(false);

  useEffect(() => {
    Animated.timing(yAnim, {
      toValue: -150,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: false, // required since we are animating 'top'
    }).start(({ finished }) => {
      if (finished && !isDead.current) {
        onEscape(id);
      }
    });
  }, []);

  const handlePress = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isDead.current) return;
    isDead.current = true;
    setIsExploding(true);
    yAnim.stopAnimation();
    onHit(id);
    // Let the explosion show for a moment, then disappear
    setTimeout(() => {
      onEscape(id);
    }, 200);
  };

  return (
    <Animated.View 
      style={[styles.entityWrapper, { top: yAnim, left: xPos }]}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePress}
    >
      <View style={styles.hitArea}>
        {isExploding ? (
          <Text style={styles.explosion}>💥</Text>
        ) : (
          <View style={[styles.balloon, { backgroundColor: color }]}>
            <View style={[styles.knot, { borderBottomColor: color }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
});

// Separate Bird Component for individual animation logic
const Bird = React.memo(({ id, speed, onHit, onEscape }) => {
  const direction = useRef(Math.random() > 0.5 ? 1 : -1).current; // 1 = LTR, -1 = RTL
  const xAnim = useRef(new Animated.Value(direction === 1 ? -100 : width + 100)).current;
  const yPos = useRef(Math.random() * (height - 350) + 100).current;
  const [isAngry, setIsAngry] = useState(false);
  const isDead = useRef(false);

  useEffect(() => {
    Animated.timing(xAnim, {
      toValue: direction === 1 ? width + 100 : -100,
      duration: speed,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isDead.current) {
        onEscape(id);
      }
    });
  }, []);

  const handlePress = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isDead.current) return;
    isDead.current = true;
    setIsAngry(true);
    xAnim.stopAnimation();
    onHit(id);
    setTimeout(() => {
      onEscape(id);
    }, 800);
  };

  return (
    <Animated.View 
      style={[styles.entityWrapper, { top: yPos, left: xAnim }]}
      onStartShouldSetResponder={() => true}
      onResponderGrant={handlePress}
    >
      <View style={styles.hitArea}>
        <Text style={styles.birdEmoji}>{isAngry ? '🤬' : '🦅'}</Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#87CEEB', // Sky blue background
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
  
  entityWrapper: {
    position: 'absolute',
    zIndex: 5,
  },
  hitArea: {
    padding: 30, // Increased padding replaces hitSlop
    alignItems: 'center',
    justifyContent: 'center',
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
