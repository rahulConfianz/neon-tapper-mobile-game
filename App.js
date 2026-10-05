import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, Dimensions, Animated, Easing } from 'react-native';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');

const LEVEL_COLORS = [
  { name: 'Red', hex: '#FF5252' },
  { name: 'Blue', hex: '#448AFF' },
  { name: 'Green', hex: '#69F0AE' },
  { name: 'Purple', hex: '#E040FB' },
  { name: 'Yellow', hex: '#FFD740' },
  { name: 'Orange', hex: '#FF6E40' },
  { name: 'Cyan', hex: '#18FFFF' },
];

let entityIdCounter = 0;

export default function App() {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isPlaying, setIsPlaying] = useState(false);
  const [level, setLevel] = useState(1);
  const [targetsHit, setTargetsHit] = useState(0);

  const [balloons, setBalloons] = useState([]);
  const [birds, setBirds] = useState([]);

  const [soundPop, setSoundPop] = useState();
  const [soundMiss, setSoundMiss] = useState();
  const [soundAngry, setSoundAngry] = useState();
  const [soundWrong, setSoundWrong] = useState();

  // Load sounds on mount
  useEffect(() => {
    async function loadSounds() {
      try {
        const { sound: p } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg' });
        const { sound: m } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg' });
        const { sound: a } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/woodpecker.ogg' });
        const { sound: w } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/slip.ogg' }); // wrong balloon
        setSoundPop(p);
        setSoundMiss(m);
        setSoundAngry(a);
        setSoundWrong(w);
      } catch (e) { }
    }
    loadSounds();
    return () => {
      if (soundPop) soundPop.unloadAsync();
      if (soundMiss) soundMiss.unloadAsync();
      if (soundAngry) soundAngry.unloadAsync();
      if (soundWrong) soundWrong.unloadAsync();
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

  // Spawner loop based on level
  useEffect(() => {
    let timeout;
    const spawnLoop = () => {
      if (isPlaying) {
        spawnBalloon();
        
        // 35% chance to spawn a bird
        if (Math.random() < 0.35) {
          spawnBird();
        }
        
        const spawnRate = Math.max(600, 1600 - (level * 100)); // Slowly decreases spawn interval
        timeout = setTimeout(spawnLoop, spawnRate);
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
    setTimeLeft(30);
    setLevel(1);
    setTargetsHit(0);
    setBalloons([]);
    setBirds([]);
    setIsPlaying(true);
  };

  const targetColorObj = LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];

  const spawnBalloon = () => {
    entityIdCounter++;
    
    // 60% chance to spawn the correct color, 40% chance for a random wrong color (decoy)
    let colorObj = targetColorObj;
    const isDecoy = Math.random() > 0.6;
    if (isDecoy) {
      const wrongColors = LEVEL_COLORS.filter(c => c.hex !== targetColorObj.hex);
      colorObj = wrongColors[Math.floor(Math.random() * wrongColors.length)];
    }

    const currentSpeed = Math.max(2000, 4500 - (level * 250)); // Speed slowly increases with level
    const currentSize = Math.max(35, 75 - (level * 4)); // Shrinks by 4px per level

    const newBalloon = { 
      id: entityIdCounter, 
      color: colorObj.hex, 
      isTarget: colorObj.hex === targetColorObj.hex,
      duration: currentSpeed,
      size: currentSize
    };
    setBalloons(prev => [...prev, newBalloon]);
  };

  const spawnBird = () => {
    entityIdCounter++;
    const speed = Math.random() * 1500 + 2000;
    const newBird = { id: entityIdCounter, speed };
    setBirds(prev => [...prev, newBird]);
  };

  const removeBalloon = useCallback((id) => {
    setBalloons(prev => prev.filter(b => b.id !== id));
  }, []);

  const removeBird = useCallback((id) => {
    setBirds(prev => prev.filter(b => b.id !== id));
  }, []);

  const handleHitBalloon = useCallback((id, isTarget) => {
    if (isTarget) {
      playSound(soundPop);
      setScore(s => s + 5);
      setTimeLeft(t => t + 1); // +1 second
      
      setTargetsHit(prev => {
        const newHits = prev + 1;
        if (newHits >= 10) {
          setLevel(l => l + 1);
          setTimeLeft(t => t + 5);
          return 0;
        }
        return newHits;
      });
    } else {
      // Hit a decoy balloon!
      playSound(soundWrong);
      setScore(s => s - 5);
      setTimeLeft(t => t - 2); // Penalize time
    }
  }, [soundPop, soundWrong]);

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
    <View style={styles.container} onStartShouldSetResponder={() => true} onResponderGrant={handleMiss}>
      <Text style={styles.title}>Level {level}</Text>
      
      {!isPlaying && timeLeft === 30 && (
        <View style={styles.menuBox}>
          <Text style={styles.instructions}>
            🎈 Pop 10 <Text style={{color: targetColorObj.hex, fontWeight:'bold'}}>{targetColorObj.name}</Text> balloons!{'\n'}
            ❌ Do NOT hit other colors! (-5 pts){'\n'}
            🦅 Avoid the birds! (-10 pts){'\n'}
          </Text>
        </View>
      )}

      {isPlaying && (
        <View style={styles.targetBanner}>
          <Text style={styles.targetText}>
            POP ONLY: <Text style={{ color: targetColorObj.hex, fontWeight: '900', fontSize: 24 }}>{targetColorObj.name.toUpperCase()}</Text>
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
            <Balloon 
              key={b.id} 
              id={b.id} 
              color={b.color} 
              isTarget={b.isTarget}
              duration={b.duration} 
              size={b.size}
              onHit={handleHitBalloon} 
              onEscape={removeBalloon} 
            />
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
          <View style={styles.startButton} onStartShouldSetResponder={() => true} onResponderGrant={startGame}>
            <Text style={styles.startButtonText}>Try Again</Text>
          </View>
        </View>
      ) : (!isPlaying && (
        <View style={styles.startButton} onStartShouldSetResponder={() => true} onResponderGrant={startGame}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </View>
      ))}
    </View>
  );
}

// Separate Balloon Component
const Balloon = React.memo(({ id, color, isTarget, duration, size, onHit, onEscape }) => {
  const yAnim = useRef(new Animated.Value(height)).current;
  const xPos = useRef(Math.random() * (width - size - 40) + 20).current;
  const [isExploding, setIsExploding] = useState(false);
  const isDead = useRef(false);

  useEffect(() => {
    Animated.timing(yAnim, {
      toValue: -150,
      duration: duration,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isDead.current) {
        onEscape(id);
      }
    });
  }, [duration, id, onEscape, yAnim]);

  const handlePress = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isDead.current) return;
    isDead.current = true;
    setIsExploding(true);
    yAnim.stopAnimation();
    onHit(id, isTarget);
    
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
          <Text style={{ fontSize: size }}>{isTarget ? '💥' : '❌'}</Text>
        ) : (
          <View style={[styles.balloonBase, { backgroundColor: color, width: size, height: size * 1.2, borderRadius: size / 2 }]}>
            <View style={[styles.knotBase, { borderBottomColor: color, left: size / 2 - 5 }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
});

// Separate Bird Component
const Bird = React.memo(({ id, speed, onHit, onEscape }) => {
  const direction = useRef(Math.random() > 0.5 ? 1 : -1).current; 
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
  }, [direction, id, onEscape, speed, xAnim]);

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
    backgroundColor: '#1E1E2E', // Dark mode!
    alignItems: 'center',
    paddingTop: 60,
    overflow: 'hidden',
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  targetBanner: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 5,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  targetText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: 'bold',
  },
  menuBox: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 25,
    borderRadius: 15,
    marginTop: 20,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    zIndex: 100,
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
    marginTop: 5,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  score: { fontSize: 18, color: '#00E676', fontWeight: 'bold' },
  hits: { fontSize: 18, color: '#FFD740', fontWeight: 'bold' },
  timer: { fontSize: 18, color: '#FF5252', fontWeight: 'bold' },
  
  entityWrapper: {
    position: 'absolute',
    zIndex: 5,
  },
  hitArea: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balloonBase: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
  },
  knotBase: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  birdEmoji: {
    fontSize: 50,
  },
  startButton: {
    marginTop: 30,
    backgroundColor: '#6200EA',
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 30,
    shadowColor: '#6200EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
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
