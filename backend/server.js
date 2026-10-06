const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'database.json');

// Initialize simple JSON DB
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ players: [], scores: [], challenges: [] }));
}

const readDB = () => JSON.parse(fs.readFileSync(dbPath));
const writeDB = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

// Login / Register
app.post('/api/login', (req, res) => {
  const { name, dob } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = readDB();
  const player = db.players.find(p => p.name === name);

  if (player) {
    if (dob && player.dob && player.dob !== dob) {
      return res.status(403).json({ error: 'Name already exists on another device! Please choose a unique name.' });
    }
    return res.json({ message: 'Login successful', player });
  } else {
    const newPlayer = { id: Date.now(), name, dob: dob || '' };
    db.players.push(newPlayer);
    writeDB(db);
    res.json({ message: 'User created', player: newPlayer });
  }
});

// Save Score
app.post('/api/scores', (req, res) => {
  const { player_id, score, level } = req.body;
  const db = readDB();
  db.scores.push({ id: Date.now(), player_id, score, level, timestamp: new Date().toISOString() });
  writeDB(db);
  res.json({ success: true });
});

// Get global top 10
app.get('/api/scores/global', (req, res) => {
  const db = readDB();
  // Get max score per player
  const playerMaxScores = {};
  db.scores.forEach(s => {
    if (!playerMaxScores[s.player_id] || playerMaxScores[s.player_id].score < s.score) {
      playerMaxScores[s.player_id] = s;
    }
  });
  
  const topScores = Object.values(playerMaxScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => {
      const player = db.players.find(p => p.id === s.player_id);
      return { name: player ? player.name : 'Unknown', score: s.score, level: s.level };
    });
    
  res.json(topScores);
});

// Get personal last 10 scores
app.get('/api/scores/personal/:player_id', (req, res) => {
  const db = readDB();
  const personalScores = db.scores
    .filter(s => s.player_id === parseInt(req.params.player_id))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 10);
  res.json(personalScores);
});

// Create Challenge
app.post('/api/challenges', (req, res) => {
  const { challenger_name, target_name, target_score } = req.body;
  const db = readDB();
  db.challenges.push({
    id: Date.now(),
    challenger_name,
    target_name,
    target_score,
    timestamp: new Date().toISOString()
  });
  writeDB(db);
  res.json({ success: true });
});

// Get Challenges for a player
app.get('/api/challenges/:name', (req, res) => {
  const db = readDB();
  const userChallenges = db.challenges
    .filter(c => c.target_name === req.params.name)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
  res.json(userChallenges);
});

// Get all unique players (to populate challenge dropdown)
app.get('/api/players', (req, res) => {
  const db = readDB();
  res.json(db.players.map(p => p.name));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('Backend running on port ' + PORT);
});
