const express    = require('express');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const path       = require('path');
const fs         = require('fs');
const pool       = require('./db/pool');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sessions stored in Postgres
app.use(session({
  store: new pgSession({ pool, tableName: 'lats_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'lats-change-me-in-prod-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Static files (the frontend HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api',      require('./routes/api'));

// All other routes → serve the app
app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

// Init DB schema and start
async function start() {
  try {
    const schema = fs.readFileSync(path.join(__dirname,'db','schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ DB schema ready');
  } catch(e) {
    console.error('DB init error:', e.message);
  }
  app.listen(PORT, () => {
    console.log(`🚀 LATS running → http://localhost:${PORT}`);
    console.log(`   Login: CENH / CENHMAH123`);
  });
}
start();
