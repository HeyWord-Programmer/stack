const express = require('express');
const router = express.Router();
const { users, ageFromBirth, isMinor } = require('../db');
const { hashPassword, verifyPassword, signToken } = require('../auth');

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, username, phone, password, birth } = req.body;

  if (!name || !username || !phone || !password || !birth) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль минимум 6 символов' });
  }
  if (ageFromBirth(birth) < 7) {
    return res.status(400).json({ error: 'Минимальный возраст — 7 лет' });
  }

  const cleanUsername = username.startsWith('@') ? username : '@' + username;
  if (!/^@[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
    return res.status(400).json({ error: 'Username: 3-20 символов (буквы/цифры/_)' });
  }

  // check existing
  if (users.byPhoneOrUsername(phone)) {
    return res.status(409).json({ error: 'Телефон уже зарегистрирован' });
  }
  if (users.byPhoneOrUsername(cleanUsername)) {
    return res.status(409).json({ error: 'Username занят' });
  }

  try {
    const user = users.create({
      name: name.trim(),
      username: cleanUsername,
      phone: phone.trim(),
      password: hashPassword(password),
      birth,
    });

    const token = signToken(user);
    res.json({ token, user: users.publicView(user) });
  } catch (e) {
    console.error('[register]', e);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Заполните все поля' });
  }

  const user = users.byPhoneOrUsername(identifier.trim());
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = signToken(user);
  res.json({ token, user: users.publicView(user) });
});

// GET /api/auth/me
const { authMiddleware } = require('../auth');
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: users.publicView(req.user) });
});

module.exports = router;
