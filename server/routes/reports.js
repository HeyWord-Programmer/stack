const express = require('express');
const router = express.Router();
const { reports, users } = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

const VALID_REASONS = ['spam', 'abuse', 'adult', 'grooming', 'fraud', 'other'];

// POST /api/reports
router.post('/', (req, res) => {
  const { againstId, chatId, reason, details } = req.body;
  if (!againstId || !reason) return res.status(400).json({ error: 'Поля обязательны' });
  if (!VALID_REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid reason' });
  if (againstId === req.user.id) return res.status(400).json({ error: 'Нельзя пожаловаться на себя' });

  const target = users.byId(againstId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const report = reports.create({
    reporterId: req.user.id,
    againstId,
    chatId: chatId || null,
    reason,
    details: details ? details.slice(0, 2000) : null,
  });

  res.json({ report });
});

// GET /api/reports — мои жалобы
router.get('/', (req, res) => {
  const list = reports.listForUser(req.user.id);
  res.json({ reports: list });
});

module.exports = router;
