import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Get current DB from Vercel Serverless Redis
    let db = await kv.get('neon_db');
    if (!db) {
      db = { players: [], scores: [], challenges: [] };
    }

    const { action, payload } = req.body;

    if (action === 'login') {
      const { name, dob } = payload;
      const player = db.players.find(p => p.name === name);
      if (player) {
        if (dob && player.dob && player.dob !== dob) {
          return res.status(403).json({ error: 'Name already exists on another device!' });
        }
        return res.status(200).json({ player });
      } else {
        const newPlayer = { id: Date.now(), name, dob: dob || '' };
        db.players.push(newPlayer);
        await kv.set('neon_db', db);
        return res.status(200).json({ player: newPlayer });
      }
    }

    if (action === 'save_score') {
      db.scores.push({ ...payload, id: Date.now(), timestamp: new Date().toISOString() });
      await kv.set('neon_db', db);
      return res.status(200).json({ success: true });
    }

    if (action === 'get_data') {
      const { playerId, playerName } = payload;
      
      const playerMaxScores = {};
      db.scores.forEach(s => {
        if (!playerMaxScores[s.player_id] || playerMaxScores[s.player_id].score < s.score) playerMaxScores[s.player_id] = s;
      });
      const globalTop = Object.values(playerMaxScores)
        .sort((a,b) => b.score - a.score)
        .slice(0,10)
        .map(s => {
          const p = db.players.find(p => p.id === s.player_id);
          return { name: p ? p.name : 'Unknown', score: s.score, level: s.level };
        });
        
      const personal = db.scores.filter(s => s.player_id === playerId).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,10);
      const challenges = db.challenges.filter(c => c.target_name === playerName).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,5);
      const allPlayers = db.players.map(p => p.name).filter(n => n !== playerName);

      return res.status(200).json({ globalTop, personal, challenges, allPlayers });
    }

    if (action === 'send_challenge') {
      db.challenges.push({ ...payload, id: Date.now(), timestamp: new Date().toISOString() });
      await kv.set('neon_db', db);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database error. Make sure Vercel KV is linked.' });
  }
}
