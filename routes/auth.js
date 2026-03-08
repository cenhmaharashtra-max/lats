const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');

const requireAuth  = (req,res,next) => req.session.user ? next() : res.status(401).json({error:'Not logged in'});
const requireAdmin = (req,res,next) => (req.session.user?.role==='admin') ? next() : res.status(403).json({error:'Admin only'});

// Who am I?
router.get('/me', (req,res) => req.session.user ? res.json(req.session.user) : res.status(401).json({error:'No session'}));

// Login
router.post('/login', async (req,res) => {
  const { username, password } = req.body;
  try {
    const r = await pool.query('SELECT * FROM lats_users WHERE username=$1',[username]);
    if (!r.rows.length) return res.status(401).json({error:'Invalid credentials'});
    const user = r.rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.status(401).json({error:'Invalid credentials'});
    req.session.user = { id:user.id, username:user.username, name:user.name, role:user.role };
    req.session.save(() => res.json(req.session.user));
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Logout
router.post('/logout', (req,res) => { req.session.destroy(); res.json({ok:true}); });

// Public: usernames only for login dropdown
router.get('/usernames', async (req,res) => {
  try {
    const r = await pool.query('SELECT username, role FROM lats_users ORDER BY id');
    res.json(r.rows);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// List users (admin)
router.get('/users', requireAdmin, async (req,res) => {
  const r = await pool.query('SELECT id,username,name,role FROM lats_users ORDER BY id');
  res.json(r.rows);
});

// Create user (admin)
router.post('/users', requireAdmin, async (req,res) => {
  const { username, password, name } = req.body;
  if (!username||!password) return res.status(400).json({error:'Username and password required'});
  try {
    const hash = await bcrypt.hash(password,10);
    const r = await pool.query(
      'INSERT INTO lats_users(username,password,name,role) VALUES($1,$2,$3,\'viewer\') RETURNING id,username,name,role',
      [username, hash, name||username]
    );
    res.json(r.rows[0]);
  } catch(e) {
    if (e.code==='23505') return res.status(400).json({error:'Username already exists'});
    res.status(500).json({error:e.message});
  }
});

// Update user password (admin)
router.put('/users/:id', requireAdmin, async (req,res) => {
  const { password, name } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password,10);
    await pool.query('UPDATE lats_users SET password=$1 WHERE id=$2',[hash,req.params.id]);
  }
  if (name) await pool.query('UPDATE lats_users SET name=$1 WHERE id=$2',[name,req.params.id]);
  res.json({ok:true});
});

// Delete user (admin)
router.delete('/users/:id', requireAdmin, async (req,res) => {
  await pool.query("DELETE FROM lats_users WHERE id=$1 AND username!='CENH'",[req.params.id]);
  res.json({ok:true});
});

module.exports = router;
