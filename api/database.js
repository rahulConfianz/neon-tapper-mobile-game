import { createPool } from '@vercel/postgres';

const pool = createPool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

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
    // Ensure Postgres tables exist!
    await pool.sql`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        dob VARCHAR(50)
      );
    `;
    await pool.sql`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        score INTEGER NOT NULL,
        level INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.sql`
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        challenger_name VARCHAR(255) NOT NULL,
        target_name VARCHAR(255) NOT NULL,
        target_score INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const { action, payload } = req.body;

    if (action === 'login') {
      const { name, dob } = payload;
      const { rows } = await pool.sql`SELECT * FROM players WHERE name = ${name}`;
      const player = rows[0];
      
      if (player) {
        if (dob && player.dob && player.dob !== dob) {
          return res.status(403).json({ error: 'Name already exists on another device! Please choose a unique name.' });
        }
        return res.status(200).json({ player });
      } else {
        const { rows: inserted } = await pool.sql`INSERT INTO players (name, dob) VALUES (${name}, ${dob || ''}) RETURNING *`;
        return res.status(200).json({ player: inserted[0] });
      }
    }

    if (action === 'save_score') {
      await pool.sql`INSERT INTO scores (player_id, score, level) VALUES (${payload.player_id}, ${payload.score}, ${payload.level})`;
      return res.status(200).json({ success: true });
    }

    if (action === 'get_data') {
      const { playerId, playerName } = payload;
      
      // Global Top 10
      const { rows: globalTop } = await pool.sql`
        SELECT p.name, MAX(s.score) as score, MAX(s.level) as level 
        FROM scores s 
        JOIN players p ON s.player_id = p.id 
        GROUP BY p.id 
        ORDER BY score DESC 
        LIMIT 10
      `;
        
      // Personal Last 10
      const { rows: personal } = await pool.sql`
        SELECT score, level, timestamp 
        FROM scores 
        WHERE player_id = ${playerId} 
        ORDER BY timestamp DESC 
        LIMIT 10
      `;
      
      // Challenges
      const { rows: challenges } = await pool.sql`
        SELECT * FROM challenges 
        WHERE target_name = ${playerName} 
        ORDER BY timestamp DESC 
        LIMIT 5
      `;
      
      // All Players (exclude self)
      const { rows: allPlayerRows } = await pool.sql`SELECT name FROM players WHERE name != ${playerName}`;
      const allPlayers = allPlayerRows.map(r => r.name);

      return res.status(200).json({ globalTop, personal, challenges, allPlayers });
    }

    if (action === 'send_challenge') {
      await pool.sql`INSERT INTO challenges (challenger_name, target_name, target_score) VALUES (${payload.challenger_name}, ${payload.target_name}, ${payload.target_score})`;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
