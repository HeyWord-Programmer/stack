const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users } = require('./db');

const SECRET = process.env.STACK_JWT_SECRET || 'stack-dev-secret-change-in-prod-please';
const TOKEN_TTL = '30d';

function hashPassword(pass) {
  return bcrypt.hashSync(pass, 10);
}

function verifyPassword(pass, hash) {
  return bcrypt.compareSync(pass, hash);
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid token' });

  const user = users.byId(payload.id);
  if (!user) return res.status(401).json({ error: 'User not found' });

  req.user = user;
  next();
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, authMiddleware };
