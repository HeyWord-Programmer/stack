const express = require('express');
const router = express.Router();
const { users, contacts, blocks } = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// GET /api/users/search?q=...
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [] });
  const results = users.search(q, req.user.id).map(u => users.publicView(u));
  res.json({ results });
});

// GET /api/users/:id
router.get('/:id', (req, res) => {
  const u = users.byId(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  res.json({ user: users.publicView(u) });
});

// PUT /api/users/me  — update own profile
router.put('/me', (req, res) => {
  const { name, bio, avatar } = req.body;
  users.updateProfile(req.user.id, { name, bio, avatar });
  const fresh = users.byId(req.user.id);
  res.json({ user: users.publicView(fresh) });
});

// PUT /api/users/me/settings
router.put('/me/settings', (req, res) => {
  users.updateSettings(req.user.id, req.body);
  const fresh = users.byId(req.user.id);
  res.json({ user: users.publicView(fresh) });
});

// ============ CONTACTS ============
router.get('/me/contacts', (req, res) => {
  const list = contacts.listFor(req.user.id).map(u => users.publicView(u));
  res.json({ contacts: list });
});

router.post('/me/contacts', (req, res) => {
  const { userId } = req.body;
  if (!userId || userId === req.user.id) return res.status(400).json({ error: 'Bad request' });
  const target = users.byId(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  contacts.add(req.user.id, userId);
  res.json({ ok: true });
});

router.delete('/me/contacts/:id', (req, res) => {
  contacts.remove(req.user.id, req.params.id);
  res.json({ ok: true });
});

// ============ BLOCKS ============
router.post('/me/blocks', (req, res) => {
  const { userId } = req.body;
  if (!userId || userId === req.user.id) return res.status(400).json({ error: 'Bad request' });
  blocks.add(req.user.id, userId);
  res.json({ ok: true });
});

router.delete('/me/blocks/:id', (req, res) => {
  blocks.remove(req.user.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
