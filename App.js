import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, Dimensions, Animated, Easing, ScrollView, ImageBackground, Platform } from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const LEVEL_COLORS = [
  { name: 'Red', hex: '#FF3333' },
  { name: 'Blue', hex: '#3366FF' },
  { name: 'Green', hex: '#00E676' },
  { name: 'Purple', hex: '#D500F9' },
  { name: 'Yellow', hex: '#FFEA00' },
  { name: 'Orange', hex: '#FF6D00' },
  { name: 'Cyan', hex: '#00E5FF' },
];

const BACKGROUNDS = [
  'https://images.unsplash.com/photo-1506744626753-eda8151a74a4?q=80&w=1500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?q=80&w=1500&auto=format&fit=crop',
];

let entityIdCounter = 0;

export default function App() {
  const [gameState, setGameState] = useState('HOME');
  const [player, setPlayer] = useState({ name: '', dob: '' });
  const [leaderboard, setLeaderboard] = useState([]);

  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [level, setLevel] = useState(1);
  const [targetsHit, setTargetsHit] = useState(0);

  const [balloons, setBalloons] = useState([]);
  const [birds, setBirds] = useState([]);

  const [soundPop, setSoundPop] = useState();
  const [soundMiss, setSoundMiss] = useState();
  const [soundAngry, setSoundAngry] = useState();
  const [soundWrong, setSoundWrong] = useState();

  // Gun variables
  const [gunAngle, setGunAngle] = useState(0);
  const [isShooting, setIsShooting] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const { sound: p } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg' });
        const { sound: m } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg' });
        const { sound: a } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/woodpecker.ogg' });
        const { sound: w } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/slip.ogg' });
        setSoundPop(p);
        setSoundMiss(m);
        setSoundAngry(a);
        setSoundWrong(w);
      } catch (e) { }
      
      try {
        const data = await AsyncStorage.getItem('neonTapperScores');
        if (data) {
          setLeaderboard(JSON.parse(data));
        } else {
          const dummy = [
            { name: 'MasterTapper', score: 150, level: 6 },
            { name: 'Alex', score: 85, level: 3 },
          ];
          setLeaderboard(dummy);
          await AsyncStorage.setItem('neonTapperScores', JSON.stringify(dummy));
        }
      } catch(e) {}
    }
    init();
    return () => {
      if (soundPop) soundPop.unloadAsync();
      if (soundMiss) soundMiss.unloadAsync();
      if (soundAngry) soundAngry.unloadAsync();
      if (soundWrong) soundWrong.unloadAsync();
    };
  }, []);

  const playSound = async (sound) => {
    if (sound) {
      try { await sound.replayAsync(); } catch (e) {}
    }
  };

  const saveScore = async (finalScore, finalLevel) => {
    try {
      const pName = player.name.trim() || 'Anonymous';
      const newEntry = { name: pName, score: finalScore, level: finalLevel, id: Date.now() };
      const newBoard = [...leaderboard, newEntry].sort((a,b) => b.score - a.score).slice(0, 10);
      setLeaderboard(newBoard);
      await AsyncStorage.setItem('neonTapperScores', JSON.stringify(newBoard));
    } catch(e) {}
  };

  useEffect(() => {
    let timer;
    if (gameState === 'PLAYING' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft <= 0 && gameState === 'PLAYING') {
      handleGameOver();
    }
    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  useEffect(() => {
    let timeout;
    const spawnLoop = () => {
      if (gameState === 'PLAYING') {
        spawnBalloon();
        if (Math.random() < 0.35) spawnBird();
        const spawnRate = Math.max(600, 1600 - (level * 100));
        timeout = setTimeout(spawnLoop, spawnRate);
      }
    };
    if (gameState === 'PLAYING') spawnLoop();
    return () => clearTimeout(timeout);
  }, [gameState, level]);

  const handleGameOver = () => {
    setGameState('GAME_OVER');
    setBalloons([]);
    setBirds([]);
    saveScore(score, level);
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(30);
    setLevel(1);
    setTargetsHit(0);
    setBalloons([]);
    setBirds([]);
    setGameState('PLAYING');
  };

  const nextLevel = () => {
    setLevel(l => l + 1);
    setTimeLeft(t => t + 5);
    setTargetsHit(0);
    setBalloons([]);
    setBirds([]);
    setGameState('PLAYING');
  };

  const targetColorObj = LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];
  const bgImage = BACKGROUNDS[(level - 1) % BACKGROUNDS.length];

  const spawnBalloon = () => {
    entityIdCounter++;
    let colorObj = targetColorObj;
    const isDecoy = Math.random() > 0.6;
    if (isDecoy) {
      const wrongColors = LEVEL_COLORS.filter(c => c.hex !== targetColorObj.hex);
      colorObj = wrongColors[Math.floor(Math.random() * wrongColors.length)];
    }
    const currentSpeed = Math.max(2000, 4500 - (level * 250));
    const currentSize = Math.max(45, 85 - (level * 4)); 
    const newBalloon = { id: entityIdCounter, color: colorObj.hex, isTarget: colorObj.hex === targetColorObj.hex, duration: currentSpeed, size: currentSize };
    setBalloons(prev => [...prev, newBalloon]);
  };

  const spawnBird = () => {
    entityIdCounter++;
    const speed = Math.random() * 1500 + 2000;
    const newBird = { id: entityIdCounter, speed };
    setBirds(prev => [...prev, newBird]);
  };

  const removeBalloon = useCallback((id) => setBalloons(prev => prev.filter(b => b.id !== id)), []);
  const removeBird = useCallback((id) => setBirds(prev => prev.filter(b => b.id !== id)), []);

  const updateGunAim = (pageX, pageY) => {
    const dx = pageX - width / 2;
    const dy = height - 30 - pageY;
    setGunAngle(Math.atan2(dx, dy) * (180 / Math.PI));
  };

  const triggerShoot = () => {
    setIsShooting(true);
    setTimeout(() => setIsShooting(false), 100);
  };

  const handlePointerMove = (e) => {
    if (gameState !== 'PLAYING') return;
    updateGunAim(e.nativeEvent.pageX, e.nativeEvent.pageY);
  };

  const handleHitBalloon = useCallback((id, isTarget, pageX, pageY) => {
    if (gameState !== 'PLAYING') return;
    
    if (pageX !== undefined && pageY !== undefined) updateGunAim(pageX, pageY);
    triggerShoot();

    if (isTarget) {
      playSound(soundPop);
      setScore(s => s + 5);
      setTimeLeft(t => t + 1);
      
      setTargetsHit(prev => {
        const newHits = prev + 1;
        if (newHits >= 10) {
          setGameState('LEVEL_COMPLETE');
          setBalloons([]);
          setBirds([]);
          return 0;
        }
        return newHits;
      });
    } else {
      playSound(soundWrong);
      setScore(s => s - 5);
      setTimeLeft(t => t - 2);
    }
  }, [soundPop, soundWrong, gameState]);

  const handleHitBird = useCallback((id, pageX, pageY) => {
    if (gameState !== 'PLAYING') return;
    
    if (pageX !== undefined && pageY !== undefined) updateGunAim(pageX, pageY);
    triggerShoot();

    playSound(soundAngry);
    setScore(s => s - 10);
    setTimeLeft(t => t - 5);
  }, [soundAngry, gameState]);

  const handleMiss = (e) => {
    if (gameState === 'PLAYING') {
      if (e && e.nativeEvent) {
        updateGunAim(e.nativeEvent.pageX, e.nativeEvent.pageY);
      }
      triggerShoot();
      playSound(soundMiss);
      setScore(s => s - 2);
    }
  };

  return (
    <>
      {Platform.OS === 'web' && (
        <style type="text/css">{`
          * {
            -webkit-touch-callout: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
          }
          input {
            -webkit-user-select: text !important;
            user-select: text !important;
          }
        `}</style>
      )}
      
      <ImageBackground 
        source={{ uri: bgImage }} 
        style={styles.container} 
        onStartShouldSetResponder={() => gameState === 'PLAYING'} 
        onResponderGrant={handleMiss}
        onPointerMove={handlePointerMove}
      >
        <View style={styles.darkOverlay} />
        
        {/* ---------------- HOME SCREEN ---------------- */}
        {gameState === 'HOME' && (
          <View style={styles.homeBox}>
            <Text selectable={false} style={styles.title}>Neon Tapper</Text>
            <Text selectable={false} style={styles.subtitle}>Log in to play!</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Player Name" 
              placeholderTextColor="#BBB"
              value={player.name}
              onChangeText={t => setPlayer({...player, name: t})}
            />
            <TextInput 
              style={styles.input} 
              placeholder="Date of Birth (e.g. 01/01/2000)" 
              placeholderTextColor="#BBB"
              value={player.dob}
              onChangeText={t => setPlayer({...player, dob: t})}
            />

            <View style={styles.btnRow}>
              <View 
                style={[styles.startButton, { opacity: player.name.trim() ? 1 : 0.5 }]} 
                onStartShouldSetResponder={() => true} 
                onResponderGrant={() => { if (player.name.trim()) startGame(); }}
              >
                <Text selectable={false} style={styles.startButtonText}>START GAME</Text>
              </View>
            </View>

            <View style={styles.leaderboardBox}>
              <Text selectable={false} style={styles.leaderboardTitle}>🏆 Global Scores 🏆</Text>
              <ScrollView style={{maxHeight: 200, width: '100%'}}>
                {leaderboard.map((lb, idx) => (
                  <View key={idx} style={styles.lbRow}>
                    <Text selectable={false} style={styles.lbName}>{idx + 1}. {lb.name}</Text>
                    <Text selectable={false} style={styles.lbScore}>Score: {lb.score}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* ---------------- PLAYING SCREEN ---------------- */}
        {gameState === 'PLAYING' && (
          <>
            <Text selectable={false} style={styles.playingTitle}>Level {level}</Text>
            <View style={styles.targetBanner}>
              <Text selectable={false} style={styles.targetText}>
                POP ONLY: <Text selectable={false} style={{ color: targetColorObj.hex, fontWeight: '900', fontSize: 24 }}>{targetColorObj.name.toUpperCase()}</Text>
              </Text>
            </View>

            <View style={styles.stats}>
              <Text selectable={false} style={styles.score}>Score: {score}</Text>
              <Text selectable={false} style={styles.hits}>Popped: {targetsHit}/10</Text>
              <Text selectable={false} style={styles.timer}>Time: {timeLeft}s</Text>
            </View>

            {balloons.map(b => (
              <Balloon key={b.id} id={b.id} color={b.color} isTarget={b.isTarget} duration={b.duration} size={b.size} onHit={handleHitBalloon} onEscape={removeBalloon} />
            ))}
            {birds.map(b => (
              <Bird key={b.id} id={b.id} speed={b.speed} onHit={handleHitBird} onEscape={removeBird} />
            ))}
            
            {/* Sci-Fi Gun */}
            <Cannon angle={gunAngle} isShooting={isShooting} />
          </>
        )}

        {/* ---------------- LEVEL COMPLETE SCREEN ---------------- */}
        {gameState === 'LEVEL_COMPLETE' && (
          <View style={styles.overlayBox}>
            <CelebrationBanner />
            <Text selectable={false} style={styles.overlayTitle}>Level {level} Complete!</Text>
            <Text selectable={false} style={styles.overlayScore}>Current Score: {score}</Text>
            
            <View style={styles.btnRow}>
              <View style={styles.primaryButton} onStartShouldSetResponder={() => true} onResponderGrant={nextLevel}>
                <Text selectable={false} style={styles.startButtonText}>Next Level</Text>
              </View>
              <View style={styles.secondaryButton} onStartShouldSetResponder={() => true} onResponderGrant={() => setGameState('HOME')}>
                <Text selectable={false} style={styles.startButtonText}>Home</Text>
              </View>
            </View>
          </View>
        )}

        {/* ---------------- GAME OVER SCREEN ---------------- */}
        {gameState === 'GAME_OVER' && (
          <View style={styles.overlayBox}>
            <SadDucky />
            <Text selectable={false} style={styles.gameOverTitle}>Game Over!</Text>
            <Text selectable={false} style={styles.overlayScore}>Final Score: {score}</Text>
            <Text selectable={false} style={styles.overlaySubtitle}>Reached Level: {level}</Text>
            
            <View style={styles.btnRow}>
              <View style={styles.primaryButton} onStartShouldSetResponder={() => true} onResponderGrant={startGame}>
                <Text selectable={false} style={styles.startButtonText}>Try Again</Text>
              </View>
              <View style={styles.secondaryButton} onStartShouldSetResponder={() => true} onResponderGrant={() => setGameState('HOME')}>
                <Text selectable={false} style={styles.startButtonText}>Home</Text>
              </View>
            </View>
          </View>
        )}

      </ImageBackground>
    </>
  );
}

// ---------------- ANIMATED COMPONENTS ----------------

const Cannon = ({ angle, isShooting }) => (
  <View style={styles.cannonBase}>
    <Animated.View style={[styles.cannonBarrelContainer, { transform: [{ rotate: `${angle}deg` }] }]}>
      {isShooting && <View style={styles.muzzleFlash} />}
      <View style={styles.barrelVisible}>
        <View style={styles.barrelHighlight} />
      </View>
    </Animated.View>
    <View style={styles.cannonMount}>
      <View style={styles.cannonMountInner} />
    </View>
  </View>
);

const CelebrationBanner = () => {
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.8, duration: 500, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale }], flexDirection: 'row', gap: 10, marginBottom: 20 }}>
      <Text selectable={false} style={{ fontSize: 50 }}>🎉</Text>
      <Text selectable={false} style={{ fontSize: 50 }}>🎈</Text>
      <Text selectable={false} style={{ fontSize: 50 }}>🌟</Text>
    </Animated.View>
  );
};

const SadDucky = () => {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(translateY, { toValue: -15, duration: 800, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY }], marginBottom: 20 }}>
      <Text selectable={false} style={{ fontSize: 70 }}>🦆😿</Text>
    </Animated.View>
  );
};

const Balloon = React.memo(({ id, color, isTarget, duration, size, onHit, onEscape }) => {
  const yAnim = useRef(new Animated.Value(height)).current;
  const xPos = useRef(Math.random() * (width - size - 40) + 20).current;
  const [isExploding, setIsExploding] = useState(false);
  const isDead = useRef(false);

  useEffect(() => {
    Animated.timing(yAnim, { toValue: -150, duration: duration, easing: Easing.linear, useNativeDriver: false })
      .start(({ finished }) => {
        if (finished && !isDead.current) onEscape(id);
      });
  }, [duration, id, onEscape, yAnim]);

  const handlePress = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isDead.current) return;
    isDead.current = true;
    setIsExploding(true);
    yAnim.stopAnimation();
    
    // Pass coordinates back to the main App to aim the gun
    const { pageX, pageY } = e.nativeEvent;
    onHit(id, isTarget, pageX, pageY);
    
    setTimeout(() => onEscape(id), 200);
  };

  return (
    <Animated.View style={[styles.entityWrapper, { top: yAnim, left: xPos }]} onStartShouldSetResponder={() => true} onResponderGrant={handlePress}>
      <View style={styles.hitArea}>
        {isExploding ? (
          <Text selectable={false} style={{ fontSize: size }}>{isTarget ? '💥' : '❌'}</Text>
        ) : (
          <View style={[styles.balloonBase, { backgroundColor: color, width: size, height: size * 1.2, borderRadius: size / 2 }]}>
            <View style={styles.balloonHighlight} />
            <View style={[styles.knotBase, { borderBottomColor: color, left: size / 2 - 5 }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
});

const Bird = React.memo(({ id, speed, onHit, onEscape }) => {
  const direction = useRef(Math.random() > 0.5 ? 1 : -1).current; 
  const xAnim = useRef(new Animated.Value(direction === 1 ? -100 : width + 100)).current;
  const yPos = useRef(Math.random() * (height - 350) + 100).current;
  const [isAngry, setIsAngry] = useState(false);
  const isDead = useRef(false);

  useEffect(() => {
    Animated.timing(xAnim, { toValue: direction === 1 ? width + 100 : -100, duration: speed, easing: Easing.linear, useNativeDriver: false })
      .start(({ finished }) => {
        if (finished && !isDead.current) onEscape(id);
      });
  }, [direction, id, onEscape, speed, xAnim]);

  const handlePress = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isDead.current) return;
    isDead.current = true;
    setIsAngry(true);
    xAnim.stopAnimation();
    
    // Pass coordinates to aim the gun
    const { pageX, pageY } = e.nativeEvent;
    onHit(id, pageX, pageY);
    
    setTimeout(() => onEscape(id), 800);
  };

  return (
    <Animated.View style={[styles.entityWrapper, { top: yPos, left: xAnim }]} onStartShouldSetResponder={() => true} onResponderGrant={handlePress}>
      <View style={styles.hitArea}>
        <Text selectable={false} style={[styles.birdEmoji, { transform: [{ scaleX: direction === 1 ? -1 : 1 }] }]}>
          {isAngry ? '🤬' : '🦅'}
        </Text>
      </View>
    </Animated.View>
  );
});

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)', 
  },
  homeBox: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    zIndex: 10,
  },
  title: { fontSize: 54, fontWeight: '900', color: '#00E676', marginBottom: 10, textShadowColor: '#00E676', textShadowRadius: 15 },
  playingTitle: { fontSize: 36, fontWeight: '900', color: '#FFF', marginBottom: 5, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
  subtitle: { fontSize: 20, color: '#FFF', marginBottom: 30, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },
  input: { width: '85%', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: '#FFF', padding: 15, borderRadius: 15, marginBottom: 15, fontSize: 16, borderWidth: 2, borderColor: '#00E676', shadowColor: '#00E676', shadowOpacity: 0.5, shadowRadius: 10 },
  leaderboardBox: { marginTop: 40, width: '90%', backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, borderRadius: 20, borderWidth: 2, borderColor: '#448AFF', alignItems: 'center', shadowColor: '#448AFF', shadowOpacity: 0.5, shadowRadius: 15 },
  leaderboardTitle: { fontSize: 24, color: '#FFD740', fontWeight: 'bold', marginBottom: 15, textShadowColor: '#FFD740', textShadowRadius: 10 },
  lbRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)' },
  lbName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  lbScore: { color: '#00E676', fontSize: 18, fontWeight: '900' },
  
  targetBanner: { backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 8, paddingHorizontal: 25, borderRadius: 25, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  targetText: { fontSize: 18, color: '#FFF', fontWeight: 'bold' },
  stats: { flexDirection: 'row', justifyContent: 'space-between', width: '95%', backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 15, marginTop: 5, zIndex: 10, borderWidth: 2, borderColor: '#333', elevation: 10 },
  score: { fontSize: 20, color: '#00E676', fontWeight: '900' },
  hits: { fontSize: 20, color: '#FFD740', fontWeight: '900' },
  timer: { fontSize: 20, color: '#FF5252', fontWeight: '900' },
  
  overlayBox: { backgroundColor: 'rgba(0,0,0,0.9)', ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 },
  overlayTitle: { fontSize: 42, color: '#FFD740', fontWeight: '900', marginBottom: 15, textAlign: 'center', textShadowColor: '#FFD740', textShadowRadius: 15 },
  gameOverTitle: { fontSize: 54, color: '#FF5252', fontWeight: '900', marginBottom: 15, textAlign: 'center', textShadowColor: '#FF5252', textShadowRadius: 20 },
  overlayScore: { fontSize: 30, color: '#FFF', fontWeight: 'bold', marginBottom: 10 },
  overlaySubtitle: { fontSize: 22, color: '#A0A0B0', marginBottom: 30 },
  
  btnRow: { flexDirection: 'row', gap: 15, marginTop: 20 },
  startButton: { backgroundColor: '#00E676', paddingVertical: 18, paddingHorizontal: 45, borderRadius: 30, elevation: 10, shadowColor: '#00E676', shadowOpacity: 0.6, shadowRadius: 15 },
  primaryButton: { backgroundColor: '#448AFF', paddingVertical: 18, paddingHorizontal: 35, borderRadius: 30, elevation: 10, shadowColor: '#448AFF', shadowOpacity: 0.6, shadowRadius: 15 },
  secondaryButton: { backgroundColor: '#555', paddingVertical: 18, paddingHorizontal: 35, borderRadius: 30, elevation: 5 },
  startButtonText: { fontSize: 20, color: '#FFFFFF', fontWeight: '900', textTransform: 'uppercase' },

  entityWrapper: { position: 'absolute', zIndex: 5 },
  hitArea: { padding: 30, alignItems: 'center', justifyContent: 'center', userSelect: 'none' },
  balloonBase: { shadowColor: '#000', shadowOffset: { width: 5, height: 10 }, shadowOpacity: 0.7, shadowRadius: 10, elevation: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  balloonHighlight: { position: 'absolute', top: '12%', left: '20%', width: '35%', height: '25%', backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 50, transform: [{ rotate: '-45deg' }] },
  knotBase: { position: 'absolute', bottom: -10, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', zIndex: -1 },
  birdEmoji: { fontSize: 55, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 3, height: 6 }, textShadowRadius: 5, userSelect: 'none' },

  // Cannon Styles
  cannonBase: { position: 'absolute', bottom: 0, left: width / 2 - 40, width: 80, height: 60, alignItems: 'center', justifyContent: 'flex-end', zIndex: 50, pointerEvents: 'none' },
  cannonBarrelContainer: { position: 'absolute', bottom: 30, width: 24, height: 180, alignItems: 'center', justifyContent: 'flex-start', zIndex: 1 },
  barrelVisible: { width: 24, height: 90, backgroundColor: '#37474F', borderWidth: 2, borderColor: '#263238', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 5, elevation: 5 },
  barrelHighlight: { position: 'absolute', left: 2, top: 2, width: 6, height: '90%', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 5 },
  cannonMount: { width: 80, height: 50, backgroundColor: '#263238', borderTopLeftRadius: 40, borderTopRightRadius: 40, borderWidth: 3, borderColor: '#111', zIndex: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 10 },
  cannonMountInner: { width: 30, height: 30, backgroundColor: '#00E676', borderRadius: 15, borderWidth: 2, borderColor: '#FFF', shadowColor: '#00E676', shadowOpacity: 1, shadowRadius: 10 },
  muzzleFlash: { position: 'absolute', top: -10, width: 50, height: 50, backgroundColor: '#FFFF00', borderRadius: 25, shadowColor: '#FFFF00', shadowOpacity: 1, shadowRadius: 25, zIndex: 10 },
});
