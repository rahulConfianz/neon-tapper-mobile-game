import { neon } from '@neondatabase/serverless';

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
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
      return res.status(500).json({ error: 'Database URL is missing in Vercel Environment Variables! Please redeploy after linking Neon.' });
    }

    const sql = neon(connectionString);

    // Ensure Postgres tables exist!
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        dob VARCHAR(50)
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id),
        score INTEGER NOT NULL,
        level INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        challenger_name VARCHAR(255) NOT NULL,
        target_name VARCHAR(255) NOT NULL,
        target_score INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        target_name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const { action, payload } = req.body;

    if (action === 'login') {
      const { name, dob } = payload;
      const rows = await sql`SELECT * FROM players WHERE name = ${name}`;
      const player = rows[0];
      
      if (player) {
        if (dob && player.dob && player.dob !== dob) {
          return res.status(403).json({ error: 'Name already exists on another device! Please choose a unique name.' });
        }
        return res.status(200).json({ player });
      } else {
        const inserted = await sql`INSERT INTO players (name, dob) VALUES (${name}, ${dob || ''}) RETURNING *`;
        return res.status(200).json({ player: inserted[0] });
      }
    }

    if (action === 'save_score') {
      await sql`INSERT INTO scores (player_id, score, level) VALUES (${payload.player_id}, ${payload.score}, ${payload.level})`;
      return res.status(200).json({ success: true });
    }

    if (action === 'get_data') {
      const { playerId, playerName } = payload;
      
      // Global Top 10
      const globalTop = await sql`
        SELECT p.name, MAX(s.score) as score, MAX(s.level) as level 
        FROM scores s 
        JOIN players p ON s.player_id = p.id 
        GROUP BY p.id 
        ORDER BY score DESC 
        LIMIT 10
      `;
        
      // Personal Last 10
      const personal = await sql`
        SELECT score, level, timestamp 
        FROM scores 
        WHERE player_id = ${playerId} 
        ORDER BY timestamp DESC 
        LIMIT 10
      `;
      
      // Challenges
      const challenges = await sql`
        SELECT * FROM challenges 
        WHERE target_name = ${playerName} 
        ORDER BY timestamp DESC 
        LIMIT 5
      `;
      
      // All Players (exclude self)
      const allPlayerRows = await sql`SELECT name FROM players WHERE name != ${playerName}`;
      const allPlayers = allPlayerRows.map(r => r.name);

      // Notes
      const notes = await sql`SELECT * FROM notes WHERE target_name = ${playerName} ORDER BY timestamp DESC LIMIT 5`;

      return res.status(200).json({ globalTop, personal, challenges, allPlayers, notes });
    }

    if (action === 'send_challenge') {
      await sql`INSERT INTO challenges (challenger_name, target_name, target_score) VALUES (${payload.challenger_name}, ${payload.target_name}, ${payload.target_score})`;
      return res.status(200).json({ success: true });
    }

    if (action === 'delete_challenge') {
      await sql`DELETE FROM challenges WHERE id = ${payload.id}`;
      return res.status(200).json({ success: true });
    }

    if (action === 'send_note') {
      await sql`INSERT INTO notes (target_name, message) VALUES (${payload.target_name}, ${payload.message})`;
      return res.status(200).json({ success: true });
    }

    if (action === 'delete_note') {
      await sql`DELETE FROM notes WHERE id = ${payload.id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Database connection failed: ' + error.message });
  }
}
