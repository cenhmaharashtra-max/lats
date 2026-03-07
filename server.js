const express    = require('express');
const session    = require('express-session');
const pgSession  = require('connect-pg-simple')(session);
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const pool       = require('./db/pool');

const app  = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new pgSession({ pool, tableName: 'lats_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'lats-change-me-in-prod-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: 'auto',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/auth', require('./routes/auth'));
app.use('/api',      require('./routes/api'));

app.get('/setup', async (req, res) => {
  try {
    const hash = await bcrypt.hash('CENHMAH123', 10);
    await pool.query(
      "INSERT INTO lats_users (username, password, name, role) VALUES ('CENH', $1, 'Administrator', 'admin') ON CONFLICT (username) DO UPDATE SET password = $1",
      [hash]
    );
    res.send('✅ Password reset! <a href="/">Login now</a>');
  } catch(e) {
    res.send('Error: ' + e.message);
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function start() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('DB schema ready');
  } catch(e) {
    console.error('DB init error:', e.message);
  }

  // Auto-run setup: ensure CENH admin account always exists with correct password
  try {
    const hash = await bcrypt.hash('CENHMAH123', 10);
    await pool.query(
      "INSERT INTO lats_users (username, password, name, role) VALUES ('CENH', $1, 'Administrator', 'admin') ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password",
      [hash]
    );
    console.log('Admin account ready');
  } catch(e) {
    console.error('Admin setup error:', e.message);
  }

  app.listen(PORT, () => {
    console.log('LATS running on port ' + PORT);
  });
}
start();

