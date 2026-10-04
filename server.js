/* ========================================
   CineScope — Express Server with SQLite Auth
   Uses sql.js (pure JS SQLite, no native deps)
   ======================================== */

const express = require('express');
const session = require('express-session');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'cinescope.sqlite');

let db; // SQLite database instance

// --- Persist DB to file ---
function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// --- Initialize Database ---
async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#c9a96e',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      movie_title TEXT,
      movie_poster TEXT,
      movie_rating REAL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, movie_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      movie_id INTEGER NOT NULL,
      movie_title TEXT,
      movie_poster TEXT,
      movie_rating REAL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, movie_id)
    )
  `);

  saveDb();
  console.log('  ✓ Database initialized');
}

// --- Helper: query one row ---
function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

// --- Helper: query all rows ---
function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// --- Helper: run write query ---
function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// --- Helper: random avatar color ---
function randomAvatarColor() {
  const colors = ['#c9a96e', '#6ec9a9', '#9a6ec9', '#c96e6e', '#6e8fc9', '#c9946e', '#6ec9c9', '#c96eaa'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// --- Middleware ---
app.use(express.json());
app.use(express.static(__dirname));

app.use(session({
  secret: 'cinescope-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
  },
}));

// --- Auth Middleware ---
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// =========================================
//  AUTH ROUTES
// =========================================

// Register
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  // Check if user exists
  const existing = getOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const avatarColor = randomAvatarColor();

  runQuery(
    'INSERT INTO users (username, email, password, avatar_color) VALUES (?, ?, ?, ?)',
    [username, email, hashedPassword, avatarColor]
  );

  const newUser = getOne('SELECT id, username, email, avatar_color FROM users WHERE email = ?', [email]);
  req.session.userId = newUser.id;

  res.json({ user: newUser });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = getOne('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  req.session.userId = user.id;

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_color: user.avatar_color,
    },
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// Get current user
app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }

  const user = getOne('SELECT id, username, email, avatar_color, created_at FROM users WHERE id = ?', [req.session.userId]);
  if (!user) {
    return res.json({ user: null });
  }

  const favRow = getOne('SELECT COUNT(*) as count FROM favorites WHERE user_id = ?', [user.id]);
  const watchRow = getOne('SELECT COUNT(*) as count FROM watchlist WHERE user_id = ?', [user.id]);

  res.json({
    user: {
      ...user,
      favorites_count: favRow ? favRow.count : 0,
      watchlist_count: watchRow ? watchRow.count : 0,
    },
  });
});

// =========================================
//  FAVORITES ROUTES
// =========================================

app.get('/api/favorites', requireAuth, (req, res) => {
  const favorites = getAll('SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC', [req.session.userId]);
  res.json({ favorites });
});

app.post('/api/favorites', requireAuth, (req, res) => {
  const { movie_id, movie_title, movie_poster, movie_rating } = req.body;
  try {
    runQuery(
      'INSERT INTO favorites (user_id, movie_id, movie_title, movie_poster, movie_rating) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, movie_id, movie_title, movie_poster, movie_rating]
    );
    res.json({ message: 'Added to favorites' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Already in favorites' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/favorites/:movieId', requireAuth, (req, res) => {
  runQuery('DELETE FROM favorites WHERE user_id = ? AND movie_id = ?', [req.session.userId, parseInt(req.params.movieId)]);
  res.json({ message: 'Removed from favorites' });
});

app.get('/api/favorites/check/:movieId', requireAuth, (req, res) => {
  const row = getOne('SELECT id FROM favorites WHERE user_id = ? AND movie_id = ?', [req.session.userId, parseInt(req.params.movieId)]);
  res.json({ isFavorite: !!row });
});

// =========================================
//  WATCHLIST ROUTES
// =========================================

app.get('/api/watchlist', requireAuth, (req, res) => {
  const watchlist = getAll('SELECT * FROM watchlist WHERE user_id = ? ORDER BY added_at DESC', [req.session.userId]);
  res.json({ watchlist });
});

app.post('/api/watchlist', requireAuth, (req, res) => {
  const { movie_id, movie_title, movie_poster, movie_rating } = req.body;
  try {
    runQuery(
      'INSERT INTO watchlist (user_id, movie_id, movie_title, movie_poster, movie_rating) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, movie_id, movie_title, movie_poster, movie_rating]
    );
    res.json({ message: 'Added to watchlist' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Already in watchlist' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/watchlist/:movieId', requireAuth, (req, res) => {
  runQuery('DELETE FROM watchlist WHERE user_id = ? AND movie_id = ?', [req.session.userId, parseInt(req.params.movieId)]);
  res.json({ message: 'Removed from watchlist' });
});

app.get('/api/watchlist/check/:movieId', requireAuth, (req, res) => {
  const row = getOne('SELECT id FROM watchlist WHERE user_id = ? AND movie_id = ?', [req.session.userId, parseInt(req.params.movieId)]);
  res.json({ isInWatchlist: !!row });
});

// --- Start Server ---
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  ✦ CineScope server running at http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
