import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, Dimensions, Animated, Easing, ScrollView, ImageBackground, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');
const API_URL = Platform.OS === 'web'
    ? '/api/database'
    : 'https://neon-tapper-mobile-game.vercel.app/api/database';

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
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1500&auto=format&fit=crop', // Level 1
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1500&auto=format&fit=crop', // Level 2
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=1500&auto=format&fit=crop', // Level 3 (Fixed)
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1500&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?q=80&w=1500&auto=format&fit=crop',
];

let entityIdCounter = 0;

export default function App() {
    const [gameState, setGameState] = useState('LOGIN'); // LOGIN, HOME, PLAYING, LEVEL_COMPLETE, GAME_OVER
    const [player, setPlayer] = useState({ id: null, name: '', dob: '' });

    const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
    const [personalScores, setPersonalScores] = useState([]);
    const [challenges, setChallenges] = useState([]);
    const [allPlayers, setAllPlayers] = useState([]);
    const [notes, setNotes] = useState([]);
    const [rewards, setRewards] = useState([]);

    // Active Challenge logic
    const [activeChallenge, setActiveChallenge] = useState(null);
    const [notification, setNotification] = useState('');

    // Challenge modal
    const [showChallengeModal, setShowChallengeModal] = useState(false);
    const [challengeTarget, setChallengeTarget] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [level, setLevel] = useState(1);
    const [targetsHit, setTargetsHit] = useState(0);

    const [balloons, setBalloons] = useState([]);
    const [birds, setBirds] = useState([]);
    const [frogs, setFrogs] = useState([]);
    const [rabbits, setRabbits] = useState([]);
    const [isFoggy, setIsFoggy] = useState(false);
    const [fogDuration, setFogDuration] = useState(5000);

    const [soundPop, setSoundPop] = useState();
    const [soundMiss, setSoundMiss] = useState();
    const [soundAngry, setSoundAngry] = useState();
    const [soundWrong, setSoundWrong] = useState();

    // Gun variables
    const [gunAngle, setGunAngle] = useState(0);
    const [isShooting, setIsShooting] = useState(false);

    // Initialize and Auto-login
    useEffect(() => {
        async function init() {
            if (Platform.OS === 'android') {
                try {
                    await NavigationBar.setVisibilityAsync("hidden");
                    await NavigationBar.setBehaviorAsync("overlay-swipe");
                } catch (e) { }
            }

            try {
                if (Audio) {
                    const { sound: p } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/pop.ogg' });
                    const { sound: m } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg' });
                    const { sound: a } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/woodpecker.ogg' });
                    const { sound: w } = await Audio.Sound.createAsync({ uri: 'https://actions.google.com/sounds/v1/cartoon/slip.ogg' });
                    setSoundPop(p); setSoundMiss(m); setSoundAngry(a); setSoundWrong(w);
                }
            } catch (e) { console.log(e) }

            try {
                const savedPlayer = await AsyncStorage.getItem('neonPlayer');
                if (savedPlayer) {
                    const p = JSON.parse(savedPlayer);
                    setPlayer(p);
                    fetchData(p.id, p.name);
                    setGameState('HOME');
                }
            } catch (e) { }
        }
        init();
    }, []);

    const fetchData = async (playerId, playerName) => {
        try {
            const res = await fetch(API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_data', payload: { playerId, playerName } })
            });
            const data = await res.json();
            if (res.ok) {
                setGlobalLeaderboard(data.globalTop);
                setPersonalScores(data.personal);
                setChallenges(data.challenges);
                setAllPlayers(data.allPlayers);
                setNotes(data.notes || []);
                setRewards(data.rewards || []);
            }
        } catch (e) { console.log('DB fetch failed', e) }
    };

    const handleLogin = async () => {
        if (!player.name.trim()) return alert("Name required!");
        if (!player.dob.trim()) return alert("Date of Birth required!");
        try {
            const res = await fetch(API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', payload: { name: player.name.trim(), dob: player.dob } })
            });
            let data;
            try {
                data = await res.json();
            } catch (err) {
                throw new Error('Server did not return JSON. The Database might be crashing or not linked properly.');
            }

            if (res.ok) {
                setPlayer(data.player);
                await AsyncStorage.setItem('neonPlayer', JSON.stringify(data.player));
                fetchData(data.player.id, data.player.name);
                setGameState('HOME');
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Connection Error: " + e.message);
        }
    };

    const handleSendChallenge = async () => {
        if (!challengeTarget) return;
        try {
            const maxScore = personalScores.length > 0 ? personalScores[0].score : 0;
            await fetch(API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_challenge', payload: { challenger_name: player.name, target_name: challengeTarget, target_score: maxScore } })
            });
            alert('Challenge sent!');
            setShowChallengeModal(false);
        } catch (e) { }
    };

    const saveScoreToDB = async (finalScore, finalLevel) => {
        try {
            await fetch(API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save_score', payload: { player_id: player.id, score: finalScore, level: finalLevel } })
            });
            fetchData(player.id, player.name);
        } catch (e) { }
    };

    const handleAcceptChallenge = async (c) => {
        setChallenges(prev => prev.filter(x => x.id !== c.id));
        setActiveChallenge(c);
        try {
            await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_challenge', payload: { id: c.id } }) });
        } catch (e) { }
        startGame();
    };

    const handleRejectChallenge = async (id) => {
        setChallenges(prev => prev.filter(x => x.id !== id));
        try {
            await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_challenge', payload: { id } }) });
        } catch (e) { }
    };

    const clearNote = async (id) => {
        setNotes(prev => prev.filter(x => x.id !== id));
        try {
            await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_note', payload: { id } }) });
        } catch (e) { }
    };

    useEffect(() => {
        if (activeChallenge && gameState === 'PLAYING') {
            if (score > activeChallenge.target_score) {
                setScore(s => s + 100);
                setNotification(`CHALLENGE BEATEN! +100 PTS!`);
                setTimeout(() => setNotification(''), 4000);

                // Notify Challenger
                fetch(API_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'send_note', payload: { target_name: activeChallenge.challenger_name, message: `${player.name} beat your challenge of ${activeChallenge.target_score}!` } })
                }).catch(() => { });

                setActiveChallenge(null);
            }
        }
    }, [score, activeChallenge, gameState, player.name]);

    // Fog logic
    useEffect(() => {
        if (gameState === 'PLAYING') {
            // The cloud storm will only trigger if the player takes longer than 10 seconds to finish the level!
            const fogTimeout = setTimeout(() => {
                const dur = 8000 + (level * 1500); // Duration increases with level
                setFogDuration(dur);
                setIsFoggy(true);
                setTimeout(() => setIsFoggy(false), dur);
            }, 10000); // 10 seconds into the level

            return () => clearTimeout(fogTimeout);
        } else {
            setIsFoggy(false);
        }
    }, [gameState, level]);

    // Timer logic
    useEffect(() => {
        let timer;
        if (gameState === 'PLAYING' && timeLeft > 0) {
            timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
        } else if (timeLeft <= 0 && gameState === 'PLAYING') {
            handleGameOver();
        }
        return () => clearInterval(timer);
    }, [gameState, timeLeft]);

    // Spawner loop
    useEffect(() => {
        let timeout;
        const spawnLoop = () => {
            if (gameState === 'PLAYING') {
                spawnBalloon();

                const rand = Math.random();
                if (rand < 0.2) spawnBird();
                else if (rand < 0.35) spawnFrog();
                else if (rand < 0.5) spawnRabbit();

                const spawnRate = Math.max(600, 1600 - (level * 100));
                timeout = setTimeout(spawnLoop, spawnRate);
            }
        };
        if (gameState === 'PLAYING') spawnLoop();
        return () => clearTimeout(timeout);
    }, [gameState, level]);

    const handleGameOver = () => {
        let finalScore = score;

        // If they failed the challenge
        if (activeChallenge) {
            finalScore -= 50;
            setNotification(`CHALLENGE FAILED! -50 PTS`);
            setTimeout(() => setNotification(''), 4000);

            // Reward the challenger!
            fetch(API_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send_reward', payload: { target_name: activeChallenge.challenger_name, points: 100, reason: `${player.name} failed to beat your challenge! Enjoy your bonus points!` } })
            }).catch(() => { });

            setActiveChallenge(null);
        }

        setGameState('GAME_OVER');
        setBalloons([]); setBirds([]); setFrogs([]); setRabbits([]);
        saveScoreToDB(finalScore, level);
    };

    const startGame = () => {
        let startingScore = 0;
        if (rewards && rewards.length > 0) {
            startingScore = rewards.reduce((sum, r) => sum + r.points, 0);
            setNotification(`BONUS +${startingScore} PTS FROM CHALLENGES!`);
            setTimeout(() => setNotification(''), 4000);
            setRewards([]);
            fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear_rewards', payload: { player_name: player.name } }) }).catch(() => { });
        }

        setScore(startingScore); setTimeLeft(30); setLevel(1); setTargetsHit(0);
        setBalloons([]); setBirds([]); setFrogs([]); setRabbits([]);
        setGameState('PLAYING');
    };

    const nextLevel = () => {
        setLevel(l => l + 1); setTimeLeft(t => t + 5); setTargetsHit(0);
        setBalloons([]); setBirds([]); setFrogs([]); setRabbits([]);
        setGameState('PLAYING');
    };

    const targetColorObj = LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];
    // Ensure bgImage is available right from level 1 (index 0)
    const bgImage = BACKGROUNDS[(level - 1) % BACKGROUNDS.length];

    const spawnBalloon = () => {
        entityIdCounter++;
        let colorObj = targetColorObj;
        const isDecoy = Math.random() > 0.6;
        if (isDecoy) {
            const wrongColors = LEVEL_COLORS.filter(c => c.hex !== targetColorObj.hex);
            colorObj = wrongColors[Math.floor(Math.random() * wrongColors.length)];
        }
        const speed = Math.max(2000, 4500 - (level * 250));
        const size = Math.max(45, 85 - (level * 4));
        setBalloons(prev => [...prev, { id: entityIdCounter, color: colorObj.hex, isTarget: colorObj.hex === targetColorObj.hex, duration: speed, size }]);
    };

    const spawnBird = () => {
        setBirds(prev => [...prev, { id: ++entityIdCounter, speed: Math.random() * 1500 + 2000 }]);
    };
    const spawnFrog = () => {
        setFrogs(prev => [...prev, { id: ++entityIdCounter, speed: Math.random() * 1000 + 2500 }]);
    };
    const spawnRabbit = () => {
        setRabbits(prev => [...prev, { id: ++entityIdCounter, speed: Math.random() * 800 + 1500 }]); // Rabbits are faster!
    };

    const removeBalloon = useCallback((id) => setBalloons(prev => prev.filter(b => b.id !== id)), []);
    const removeBird = useCallback((id) => setBirds(prev => prev.filter(b => b.id !== id)), []);
    const removeFrog = useCallback((id) => setFrogs(prev => prev.filter(b => b.id !== id)), []);
    const removeRabbit = useCallback((id) => setRabbits(prev => prev.filter(b => b.id !== id)), []);

    const playSound = async (sound) => {
        try {
            if (sound) {
                await sound.setPositionAsync(0);
                await sound.playAsync();
            }
        } catch (e) { }
    };

    const updateGunAim = (pageX, pageY) => {
        const dx = pageX - width / 2;
        const dy = height - 50 - pageY;
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
                    setBalloons([]); setBirds([]); setFrogs([]); setRabbits([]);
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

    const handleObstacleHit = useCallback((id, pageX, pageY) => {
        if (gameState !== 'PLAYING') return;
        if (pageX !== undefined && pageY !== undefined) updateGunAim(pageX, pageY);
        triggerShoot();
        playSound(soundAngry);
        setScore(s => s - 10);
        setTimeLeft(t => t - 5);
    }, [soundAngry, gameState]);

    const handleMiss = (e) => {
        if (gameState === 'PLAYING') {
            if (e && e.nativeEvent) updateGunAim(e.nativeEvent.pageX, e.nativeEvent.pageY);
            triggerShoot();
            playSound(soundMiss);
            setScore(s => s - 2);
        }
    };

    return (
        <>
            <StatusBar hidden={true} />
            {Platform.OS === 'web' && (
                <style type="text/css">{`
          * { -webkit-touch-callout: none !important; -webkit-user-select: none !important; user-select: none !important; }
          input, select, textarea { -webkit-user-select: text !important; user-select: text !important; }
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

                {/* ---------------- LOGIN SCREEN ---------------- */}
                {gameState === 'LOGIN' && (
                    <View style={styles.homeBox}>
                        <Text selectable={false} style={styles.title}>Neon Tapper</Text>
                        <Text selectable={false} style={styles.subtitle}>The Colourful Baloon Breaker Game</Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Unique Player Name"
                            placeholderTextColor="#BBB"
                            value={player.name}
                            onChangeText={t => setPlayer({ ...player, name: t })}
                        />

                        {/* Native Browser Calendar Picker (User Friendly!) */}
                        {Platform.OS === 'web' ? (
                            <View style={[styles.input, { padding: 0, overflow: 'hidden' }]}>
                                {require('react-native').createElement('input', {
                                    type: 'date',
                                    value: player.dob,
                                    onChange: (e) => setPlayer({ ...player, dob: e.target.value }),
                                    style: {
                                        width: '100%', height: '100%', padding: '15px',
                                        backgroundColor: 'transparent', color: '#FFF',
                                        border: 'none', outline: 'none', fontSize: '16px',
                                        colorScheme: 'dark'
                                    }
                                })}
                            </View>
                        ) : (
                            <>
                                <Text style={[styles.input, { color: player.dob ? '#00E676' : '#999', paddingTop: 18 }]} onPress={() => setShowDatePicker(true)}>
                                    {player.dob || "Date of Birth (Select Date)"}
                                </Text>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={player.dob ? new Date(player.dob) : new Date(2000, 0, 1)}
                                        mode="date"
                                        display="spinner"
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (selectedDate) {
                                                const d = new Date(selectedDate);
                                                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                                setPlayer({ ...player, dob: d.toISOString().split('T')[0] });
                                            }
                                        }}
                                        maximumDate={new Date('2026-12-31')}
                                        minimumDate={new Date('1950-01-01')}
                                    />
                                )}
                            </>
                        )}

                        <View style={styles.btnRow}>
                            <View style={[styles.startButton, { opacity: player.name.trim() ? 1 : 0.5 }]} onStartShouldSetResponder={() => true} onResponderGrant={handleLogin}>
                                <Text selectable={false} style={styles.startButtonText}>LOGIN / REGISTER</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* ---------------- HOME SCREEN (DASHBOARD) ---------------- */}
                {gameState === 'HOME' && (
                    <View style={styles.homeBox}>
                        <Text selectable={false} style={styles.title}>Welcome {player.name}!</Text>
                        <View style={styles.btnRow}>
                            <View style={styles.startButton} onStartShouldSetResponder={() => true} onResponderGrant={startGame}>
                                <Text selectable={false} style={styles.startButtonText}>PLAY GAME</Text>
                            </View>
                            <View style={styles.secondaryButton} onStartShouldSetResponder={() => true} onResponderGrant={() => setShowChallengeModal(true)}>
                                <Text selectable={false} style={styles.startButtonText}>CHALLENGE</Text>
                                {challenges.length > 0 && (
                                    <View style={{ position: 'absolute', top: -10, right: -10, backgroundColor: '#FF3333', borderRadius: 15, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', elevation: 15 }}>
                                        <Text style={{ color: '#FFF', fontWeight: '900' }}>{challenges.length}</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {notes.length > 0 && (
                            <View style={[styles.leaderboardBox, { borderColor: '#FFEA00', shadowColor: '#FFEA00' }]}>
                                <Text selectable={false} style={[styles.leaderboardTitle, { color: '#FFEA00' }]}>🔔 Notifications 🔔</Text>
                                {notes.map(n => (
                                    <View key={n.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                                        <Text style={[styles.lbName, { width: '80%' }]}>{n.message}</Text>
                                        <Text style={{ color: '#FF5252', fontWeight: 'bold', fontSize: 18 }} onPress={() => clearNote(n.id)}>✕</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {challenges.length > 0 && (
                            <View style={[styles.leaderboardBox, { borderColor: '#FF5252', shadowColor: '#FF5252' }]}>
                                <Text selectable={false} style={[styles.leaderboardTitle, { color: '#FF5252' }]}>⚔️ Challenges Received ⚔️</Text>
                                {challenges.map(c => (
                                    <View key={c.id} style={{ flexDirection: 'column', width: '100%', marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderColor: '#555' }}>
                                        <Text style={[styles.lbName, { textAlign: 'center' }]}>{c.challenger_name} challenged you to beat {c.target_score}!</Text>
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, justifyContent: 'center' }}>
                                            <View style={[styles.primaryButton, { paddingVertical: 8, paddingHorizontal: 15 }]} onStartShouldSetResponder={() => true} onResponderGrant={() => handleAcceptChallenge(c)}>
                                                <Text style={{ color: '#000', fontWeight: 'bold' }}>Accept</Text>
                                            </View>
                                            <View style={[styles.secondaryButton, { paddingVertical: 8, paddingHorizontal: 15 }]} onStartShouldSetResponder={() => true} onResponderGrant={() => handleRejectChallenge(c.id)}>
                                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Reject</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%', justifyContent: 'center' }}>
                            <View style={[styles.leaderboardBox, { width: '45%', marginTop: 0 }]}>
                                <Text selectable={false} style={styles.leaderboardTitle}>🌍 Global Top 10</Text>
                                <ScrollView style={{ maxHeight: 250, width: '100%' }}>
                                    {globalLeaderboard.map((lb, idx) => (
                                        <View key={idx} style={styles.lbRow}>
                                            <Text selectable={false} style={styles.lbName}>{idx + 1}. {lb.name}</Text>
                                            <Text selectable={false} style={styles.lbScore}>{lb.score}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>

                            <View style={[styles.leaderboardBox, { width: '45%', marginTop: 0, borderColor: '#00E676', shadowColor: '#00E676' }]}>
                                <Text selectable={false} style={[styles.leaderboardTitle, { color: '#00E676' }]}>👤 Personal Last 10</Text>
                                <ScrollView style={{ maxHeight: 250, width: '100%' }}>
                                    {personalScores.map((lb, idx) => (
                                        <View key={idx} style={styles.lbRow}>
                                            <Text selectable={false} style={styles.lbName}>Lvl {lb.level}</Text>
                                            <Text selectable={false} style={styles.lbScore}>{lb.score}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
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

                        {activeChallenge && (
                            <View style={{ position: 'absolute', top: 130, backgroundColor: 'rgba(255, 51, 51, 0.8)', padding: 5, borderRadius: 10, zIndex: 20 }}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Beating {activeChallenge.challenger_name}: {activeChallenge.target_score}</Text>
                            </View>
                        )}

                        {notification ? (
                            <View style={{ position: 'absolute', top: '50%', backgroundColor: 'rgba(0, 230, 118, 0.9)', padding: 20, borderRadius: 20, zIndex: 100 }}>
                                <Text style={{ color: '#000', fontWeight: '900', fontSize: 24 }}>{notification}</Text>
                            </View>
                        ) : null}

                        {balloons.map(b => <Balloon key={b.id} id={b.id} color={b.color} isTarget={b.isTarget} duration={b.duration} size={b.size} onHit={handleHitBalloon} onEscape={removeBalloon} />)}
                        {birds.map(b => <Bird key={b.id} id={b.id} speed={b.speed} onHit={handleObstacleHit} onEscape={removeBird} />)}
                        {frogs.map(b => <Frog key={b.id} id={b.id} speed={b.speed} onHit={handleObstacleHit} onEscape={removeFrog} />)}
                        {rabbits.map(b => <Rabbit key={b.id} id={b.id} speed={b.speed} onHit={handleObstacleHit} onEscape={removeRabbit} />)}

                        {/* Fog Obstacle Layer */}
                        {isFoggy && <FogOverlay duration={fogDuration} />}

                        {/* Sci-Fi Gun perfectly attached to bottom center */}
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



                {/* ---------------- CHALLENGE MODAL ---------------- */}
                {showChallengeModal && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 }}>Send a Challenge!</Text>
                            <ScrollView style={{ maxHeight: 250, width: '100%', marginBottom: 15 }}>
                                {allPlayers.map((pName, idx) => (
                                    <Text key={idx} style={[styles.pickerItem, challengeTarget === pName && styles.pickerItemActive]} onPress={() => setChallengeTarget(pName)}>
                                        {pName}
                                    </Text>
                                ))}
                            </ScrollView>
                            <View style={styles.btnRow}>
                                <View style={styles.primaryButton} onStartShouldSetResponder={() => true} onResponderGrant={handleSendChallenge}>
                                    <Text style={styles.startButtonText}>Send</Text>
                                </View>
                                <View style={styles.secondaryButton} onStartShouldSetResponder={() => true} onResponderGrant={() => setShowChallengeModal(false)}>
                                    <Text style={styles.startButtonText}>Cancel</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

            </ImageBackground>
        </>
    );
}

// ---------------- ANIMATED COMPONENTS ----------------

const FogOverlay = React.memo(({ duration }) => {
    const opacityAnim = useRef(new Animated.Value(0)).current;

    // Create 8 massive layers of clouds to completely flood the screen with mist!
    const numRows = 8;
    const slideAnims = useRef(Array.from({ length: numRows }, () => new Animated.Value(width + 300))).current;

    useEffect(() => {
        const animations = slideAnims.map((anim, index) => {
            // Randomize speed slightly per row for a flowing, swirling mist parallax effect
            const speedModifier = 0.7 + (Math.random() * 0.5);
            return Animated.timing(anim, {
                toValue: -8000,
                duration: duration * speedModifier,
                easing: Easing.linear,
                useNativeDriver: false
            });
        });

        Animated.parallel([
            ...animations,
            Animated.sequence([
                Animated.timing(opacityAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
                Animated.delay(Math.max(0, duration - 4000)),
                Animated.timing(opacityAnim, { toValue: 0, duration: 2000, useNativeDriver: false })
            ])
        ]).start();
    }, [duration]);

    return (
        <Animated.View style={[styles.fogOverlay, { opacity: opacityAnim }]} pointerEvents="none">
            {slideAnims.map((anim, i) => (
                <Animated.View key={i} style={{ position: 'absolute', top: `${(i * 15) - 10}%`, left: anim, flexDirection: 'row' }}>
                    <Text selectable={false} style={{ fontSize: 250, opacity: 0.95 }}>
                        ☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️
                    </Text>
                </Animated.View>
            ))}
        </Animated.View>
    );
});

const Cannon = ({ angle, isShooting }) => (
    <View style={styles.cannonWrapper}>
        <View style={styles.cannonBase}>
            {/* Rotating Barrel Assembly */}
            <Animated.View style={[styles.cannonBarrelContainer, { transform: [{ rotate: `${angle}deg` }] }]}>

                {/* Main Barrel Body */}
                <View style={styles.barrelMain}>
                    <View style={styles.barrelHighlightLight} />
                    <View style={styles.barrelHighlightDark} />

                    <View style={styles.barrelStripe} />
                    <View style={[styles.barrelStripe, { top: 40 }]} />
                    <View style={[styles.barrelStripe, { top: 60 }]} />
                </View>

                {/* Barrel Muzzle (Tip) */}
                <View style={styles.barrelMuzzle}>
                    <View style={styles.muzzleInner} />
                </View>

                {/* Dynamic Muzzle Flash */}
                {isShooting && <View style={styles.muzzleFlash} />}
            </Animated.View>

            {/* Stationary Turret Base */}
            <View style={styles.cannonMountOuter}>
                <View style={styles.cannonMountInner}>
                    <View style={styles.cannonCoreGlow} />
                </View>
            </View>
        </View>
    </View>
);

const CelebrationBanner = () => {
    const scale = useRef(new Animated.Value(0.5)).current;
    useEffect(() => {
        Animated.loop(Animated.sequence([Animated.timing(scale, { toValue: 1.2, duration: 500, useNativeDriver: true }), Animated.timing(scale, { toValue: 0.8, duration: 500, useNativeDriver: true })])).start();
    }, []);
    return (
        <Animated.View style={{ transform: [{ scale }], flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <Text selectable={false} style={{ fontSize: 50 }}>🎉</Text><Text selectable={false} style={{ fontSize: 50 }}>🎈</Text><Text selectable={false} style={{ fontSize: 50 }}>🌟</Text>
        </Animated.View>
    );
};

const SadDucky = () => {
    const translateY = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(Animated.sequence([Animated.timing(translateY, { toValue: -15, duration: 800, useNativeDriver: true }), Animated.timing(translateY, { toValue: 0, duration: 800, useNativeDriver: true })])).start();
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
            .start(({ finished }) => { if (finished && !isDead.current) onEscape(id); });
    }, [duration, id, onEscape, yAnim]);

    const handlePress = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (isDead.current) return;
        isDead.current = true; setIsExploding(true); yAnim.stopAnimation();

        // Safely extract coordinates to prevent crashes!
        const pageX = e?.nativeEvent?.pageX;
        const pageY = e?.nativeEvent?.pageY;

        onHit(id, isTarget, pageX, pageY);
        setTimeout(() => onEscape(id), 200);
    };

    return (
        <Animated.View style={[styles.entityWrapper, { top: yAnim, left: xPos }]} onStartShouldSetResponder={() => true} onResponderGrant={handlePress}>
            <View style={styles.hitArea}>
                {isExploding ? <Text selectable={false} style={{ fontSize: size }}>{isTarget ? '💥' : '❌'}</Text> : (
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
    const dir = useRef(Math.random() > 0.5 ? 1 : -1).current;
    const xAnim = useRef(new Animated.Value(dir === 1 ? -100 : width + 100)).current;
    const yPos = useRef(Math.random() * (height - 350) + 100).current;
    const [isAngry, setIsAngry] = useState(false);
    const isDead = useRef(false);

    useEffect(() => {
        Animated.timing(xAnim, { toValue: dir === 1 ? width + 100 : -100, duration: speed, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => { if (finished && !isDead.current) onEscape(id); });
    }, []);

    const handlePress = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (isDead.current) return;
        isDead.current = true; setIsAngry(true); xAnim.stopAnimation();

        const pageX = e?.nativeEvent?.pageX;
        const pageY = e?.nativeEvent?.pageY;

        onHit(id, pageX, pageY);
        setTimeout(() => onEscape(id), 800);
    };

    return (
        <Animated.View style={[styles.entityWrapper, { top: yPos, left: xAnim }]} onStartShouldSetResponder={() => true} onResponderGrant={handlePress}>
            <View style={styles.hitArea}>
                <Text selectable={false} style={[styles.birdEmoji, { transform: [{ scaleX: dir === 1 ? -1 : 1 }] }]}>{isAngry ? '🤬' : '🦅'}</Text>
            </View>
        </Animated.View>
    );
});

// Obstacle: Frog jumping
const Frog = React.memo(({ id, speed, onHit, onEscape }) => {
    const dir = useRef(Math.random() > 0.5 ? 1 : -1).current;
    const xAnim = useRef(new Animated.Value(dir === 1 ? -100 : width + 100)).current;
    const yAnim = useRef(new Animated.Value(height - 150)).current;
    const isDead = useRef(false);

    useEffect(() => {
        Animated.timing(xAnim, { toValue: dir === 1 ? width + 100 : -100, duration: speed, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => { if (finished && !isDead.current) onEscape(id); });
        Animated.loop(Animated.sequence([
            Animated.timing(yAnim, { toValue: height - 400, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(yAnim, { toValue: height - 150, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: false })
        ])).start();
    }, []);

    const handlePress = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (isDead.current) return;
        isDead.current = true; xAnim.stopAnimation(); yAnim.stopAnimation();
        const pageX = e?.nativeEvent?.pageX;
        const pageY = e?.nativeEvent?.pageY;
        onHit(id, pageX, pageY);
        setTimeout(() => onEscape(id), 500);
    };

    return (
        <Animated.View style={[styles.entityWrapper, { top: yAnim, left: xAnim }]} onStartShouldSetResponder={() => true} onResponderGrant={handlePress}>
            <View style={styles.hitArea}>
                <Text selectable={false} style={[styles.birdEmoji, { transform: [{ scaleX: dir === 1 ? -1 : 1 }] }]}>{isDead.current ? '💥' : '🐸'}</Text>
            </View>
        </Animated.View>
    );
});

// Obstacle: Fast Rabbit hopping
const Rabbit = React.memo(({ id, speed, onHit, onEscape }) => {
    const dir = useRef(Math.random() > 0.5 ? 1 : -1).current;
    const xAnim = useRef(new Animated.Value(dir === 1 ? -100 : width + 100)).current;
    const yAnim = useRef(new Animated.Value(height - 150)).current;
    const isDead = useRef(false);

    useEffect(() => {
        Animated.timing(xAnim, { toValue: dir === 1 ? width + 100 : -100, duration: speed, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => { if (finished && !isDead.current) onEscape(id); });
        Animated.loop(Animated.sequence([
            Animated.timing(yAnim, { toValue: height - 250, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: false }),
            Animated.timing(yAnim, { toValue: height - 150, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: false })
        ])).start();
    }, []);

    const handlePress = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (isDead.current) return;
        isDead.current = true; xAnim.stopAnimation(); yAnim.stopAnimation();
        const pageX = e?.nativeEvent?.pageX;
        const pageY = e?.nativeEvent?.pageY;
        onHit(id, pageX, pageY);
        setTimeout(() => onEscape(id), 500);
    };

    return (
        <Animated.View style={[styles.entityWrapper, { top: yAnim, left: xAnim }]} onStartShouldSetResponder={() => true} onResponderGrant={handlePress}>
            <View style={styles.hitArea}>
                <Text selectable={false} style={[styles.birdEmoji, { transform: [{ scaleX: dir === 1 ? -1 : 1 }] }]}>{isDead.current ? '💥' : '🐰'}</Text>
            </View>
        </Animated.View>
    );
});

// ---------------- STYLES ----------------

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', paddingTop: 30, overflow: 'hidden', backgroundColor: '#000' },
    darkOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    homeBox: { flex: 1, width: '100%', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, zIndex: 10 },
    title: { fontSize: 48, fontWeight: '900', color: '#00E676', marginBottom: 10, textShadowColor: '#00E676', textShadowRadius: 15 },
    playingTitle: { fontSize: 36, fontWeight: '900', color: '#FFF', marginBottom: 5, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 10 },
    subtitle: { fontSize: 20, color: '#FFF', marginBottom: 20, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5 },
    input: { width: '85%', backgroundColor: 'rgba(0, 0, 0, 0.7)', color: '#FFF', padding: 15, borderRadius: 15, marginBottom: 15, fontSize: 16, borderWidth: 2, borderColor: '#00E676', shadowColor: '#00E676', shadowOpacity: 0.5, shadowRadius: 10 },
    leaderboardBox: { marginTop: 20, width: '90%', backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 20, borderWidth: 2, borderColor: '#448AFF', alignItems: 'center' },
    leaderboardTitle: { fontSize: 18, color: '#FFD740', fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    lbRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)' },
    lbName: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    lbScore: { color: '#00E676', fontSize: 16, fontWeight: '900' },

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

    modalOverlay: { backgroundColor: 'rgba(0,0,0,0.8)', ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 2000 },
    modalContent: { backgroundColor: '#222', padding: 25, borderRadius: 20, width: '90%', alignItems: 'center', borderWidth: 2, borderColor: '#00E676' },
    pickerItem: { color: '#FFF', fontSize: 18, paddingVertical: 12, paddingHorizontal: 20, textAlign: 'center', backgroundColor: '#333', marginVertical: 5, borderRadius: 10, overflow: 'hidden' },
    pickerItemActive: { backgroundColor: '#00E676', color: '#000', fontWeight: 'bold' },

    fogOverlay: { position: 'absolute', top: 0, bottom: 0, width: '100%', height: '100%', zIndex: 40, justifyContent: 'center', alignItems: 'center' }, // Volumetric clouds

    btnRow: { flexDirection: 'row', gap: 15, marginTop: 10 },
    startButton: { backgroundColor: '#00E676', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, elevation: 10 },
    primaryButton: { backgroundColor: '#448AFF', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, elevation: 10 },
    secondaryButton: { backgroundColor: '#555', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, elevation: 5 },
    startButtonText: { fontSize: 18, color: '#FFFFFF', fontWeight: '900', textTransform: 'uppercase' },

    entityWrapper: { position: 'absolute', zIndex: 5 },
    hitArea: { padding: 30, alignItems: 'center', justifyContent: 'center', userSelect: 'none' },
    balloonBase: { shadowColor: '#000', shadowOffset: { width: 5, height: 10 }, shadowOpacity: 0.7, shadowRadius: 10, elevation: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
    balloonHighlight: { position: 'absolute', top: '12%', left: '20%', width: '35%', height: '25%', backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 50, transform: [{ rotate: '-45deg' }] },
    knotBase: { position: 'absolute', bottom: -10, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', zIndex: -1 },
    birdEmoji: { fontSize: 55, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 3, height: 6 }, textShadowRadius: 5, userSelect: 'none' },

    cannonWrapper: { position: 'absolute', bottom: 0, width: '100%', alignItems: 'center', pointerEvents: 'none', zIndex: 50 },
    cannonBase: { width: 70, height: 45, alignItems: 'center', justifyContent: 'flex-end' },

    // Rotating Barrel Assembly (height 180, center is 90. Placed at bottom: -80, so pivot is at bottom: 10, which matches the center of the mount's arc)
    cannonBarrelContainer: { position: 'absolute', bottom: -80, width: 26, height: 180, alignItems: 'center', justifyContent: 'flex-start', zIndex: 1 },

    barrelMain: { width: 22, height: 90, backgroundColor: '#455A64', borderWidth: 1.5, borderColor: '#1C313A', borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.6, shadowRadius: 3, elevation: 5 },
    barrelHighlightLight: { position: 'absolute', left: 1, top: 0, width: 4, height: '100%', backgroundColor: 'rgba(255,255,255,0.3)' },
    barrelHighlightDark: { position: 'absolute', right: 1, top: 0, width: 4, height: '100%', backgroundColor: 'rgba(0,0,0,0.4)' },
    barrelStripe: { position: 'absolute', top: 15, width: '100%', height: 3, backgroundColor: '#00E676', shadowColor: '#00E676', shadowOpacity: 1, shadowRadius: 5 },

    barrelMuzzle: { position: 'absolute', top: -8, width: 30, height: 16, backgroundColor: '#263238', borderRadius: 4, borderWidth: 1.5, borderColor: '#111', alignItems: 'center', justifyContent: 'flex-start' },
    muzzleInner: { width: 18, height: 4, backgroundColor: '#000', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

    muzzleFlash: { position: 'absolute', top: -35, width: 50, height: 50, backgroundColor: '#FFFF00', borderRadius: 25, zIndex: 10, shadowColor: '#FF3333', shadowOpacity: 1, shadowRadius: 20, opacity: 0.9 },

    // Turret Mount
    cannonMountOuter: { width: 70, height: 45, backgroundColor: '#37474F', borderTopLeftRadius: 35, borderTopRightRadius: 35, borderWidth: 3, borderColor: '#1C313A', zIndex: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.8, shadowRadius: 5, elevation: 8 },
    cannonMountInner: { position: 'absolute', bottom: 10 - 17, width: 34, height: 34, backgroundColor: '#263238', borderRadius: 17, borderWidth: 2, borderColor: '#546E7A', alignItems: 'center', justifyContent: 'center' },
    cannonCoreGlow: { width: 14, height: 14, backgroundColor: '#00E5FF', borderRadius: 7, shadowColor: '#00E5FF', shadowOpacity: 1, shadowRadius: 10, elevation: 8 },
});
