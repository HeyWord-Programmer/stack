const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'stack.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ SCHEMA ============
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    username    TEXT UNIQUE NOT NULL,
    phone       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    birth       TEXT NOT NULL,
    avatar      TEXT,
    bio         TEXT,
    verified    INTEGER DEFAULT 0,
    online      INTEGER DEFAULT 0,
    last_seen   INTEGER DEFAULT 0,
    hide_last_seen INTEGER DEFAULT 0,
    read_receipts INTEGER DEFAULT 1,
    restrict_adult_contact INTEGER DEFAULT 1,
    parental_control INTEGER DEFAULT 0,
    dark_theme INTEGER DEFAULT 0,
    notifications INTEGER DEFAULT 1,
    parent_id   TEXT,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS chats (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL DEFAULT 'private',
    name        TEXT,
    created_at  INTEGER NOT NULL,
    created_by  TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id     TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    joined_at   INTEGER NOT NULL,
    muted       INTEGER DEFAULT 0,
    blocked     INTEGER DEFAULT 0,
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    chat_id     TEXT NOT NULL,
    sender_id   TEXT NOT NULL,
    type        TEXT DEFAULT 'text',
    text        TEXT,
    file_path   TEXT,
    file_name   TEXT,
    file_size   INTEGER,
    reply_to    TEXT,
    edited      INTEGER DEFAULT 0,
    deleted     INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS message_reads (
    message_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    read_at     INTEGER NOT NULL,
    PRIMARY KEY (message_id, user_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contacts (
    user_id     TEXT NOT NULL,
    contact_id  TEXT NOT NULL,
    added_at    INTEGER NOT NULL,
    PRIMARY KEY (user_id, contact_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    against_id  TEXT NOT NULL,
    chat_id     TEXT,
    reason      TEXT NOT NULL,
    details     TEXT,
    status      TEXT DEFAULT 'pending',
    created_at  INTEGER NOT NULL,
    resolved_at INTEGER,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (against_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS blocks (
    user_id     TEXT NOT NULL,
    blocked_id  TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, blocked_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
`);

// ============ HELPERS ============
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const ageFromBirth = (birth) => {
  const diff = Date.now() - new Date(birth).getTime();
  return Math.floor(diff / 31557600000);
};

const isMinor = (birth) => ageFromBirth(birth) < 18;

// ============ USER QUERIES ============
const users = {
  create({ name, username, phone, password, birth }) {
    const id = uid();
    const now = Date.now();
    const isKid = isMinor(birth);
    db.prepare(`
      INSERT INTO users (id, name, username, phone, password, birth, parental_control, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, username, phone, password, birth, isKid ? 1 : 0, now);
    return this.byId(id);
  },

  byId(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  byPhoneOrUsername(identifier) {
    return db.prepare(`
      SELECT * FROM users WHERE phone = ? OR username = ?
    `).get(identifier, identifier.startsWith('@') ? identifier : '@' + identifier.replace(/^@/, ''));
  },

  search(query, excludeId) {
    const q = `%${query}%`;
    return db.prepare(`
      SELECT id, name, username, phone, birth, avatar, verified, online, last_seen
      FROM users
      WHERE (name LIKE ? OR username LIKE ? OR phone LIKE ?) AND id != ?
      LIMIT 30
    `).all(q, q, q, excludeId);
  },

  updateProfile(id, fields) {
    const allowed = ['name', 'bio', 'avatar'];
    const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return;
    const sql = `UPDATE users SET ${updates.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...updates.map(([, v]) => v), id);
  },

  updateSettings(id, settings) {
    const allowed = ['hide_last_seen', 'read_receipts', 'restrict_adult_contact', 'parental_control', 'dark_theme', 'notifications'];
    const updates = Object.entries(settings).filter(([k]) => allowed.includes(k));
    if (updates.length === 0) return;
    const sql = `UPDATE users SET ${updates.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...updates.map(([, v]) => v ? 1 : 0), id);
  },

  setOnline(id, online) {
    db.prepare('UPDATE users SET online = ?, last_seen = ? WHERE id = ?')
      .run(online ? 1 : 0, Date.now(), id);
  },

  setParent(userId, parentId) {
    db.prepare('UPDATE users SET parent_id = ? WHERE id = ?').run(parentId, userId);
  },

  publicView(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return {
      ...safe,
      age: ageFromBirth(user.birth),
      isMinor: isMinor(user.birth),
      online: !!user.online,
      verified: !!user.verified,
      last_seen: user.hide_last_seen ? null : user.last_seen,
    };
  },
};

// ============ CHAT QUERIES ============
const chats = {
  createPrivate(userA, userB) {
    const existing = this.findPrivateBetween(userA, userB);
    if (existing) return existing;

    const id = uid();
    const now = Date.now();
    db.prepare(`INSERT INTO chats (id, type, created_at, created_by) VALUES (?, 'private', ?, ?)`)
      .run(id, now, userA);
    db.prepare(`INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?), (?, ?, ?)`)
      .run(id, userA, now, id, userB, now);
    return this.byId(id);
  },

  byId(id) {
    return db.prepare('SELECT * FROM chats WHERE id = ?').get(id);
  },

  findPrivateBetween(a, b) {
    return db.prepare(`
      SELECT c.* FROM chats c
      JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = ?
      JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = ?
      WHERE c.type = 'private'
      LIMIT 1
    `).get(a, b);
  },

  listForUser(userId) {
    return db.prepare(`
      SELECT c.*, cm.muted, cm.blocked
      FROM chats c
      JOIN chat_members cm ON cm.chat_id = c.id
      WHERE cm.user_id = ?
      ORDER BY c.created_at DESC
    `).all(userId);
  },

  getMembers(chatId) {
    return db.prepare(`
      SELECT u.id, u.name, u.username, u.avatar, u.birth, u.verified, u.online, u.last_seen, u.hide_last_seen, cm.muted, cm.blocked
      FROM chat_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.chat_id = ?
    `).all(chatId);
  },

  isMember(chatId, userId) {
    return !!db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
  },

  setMuted(chatId, userId, muted) {
    db.prepare('UPDATE chat_members SET muted = ? WHERE chat_id = ? AND user_id = ?')
      .run(muted ? 1 : 0, chatId, userId);
  },

  setBlocked(chatId, userId, blocked) {
    db.prepare('UPDATE chat_members SET blocked = ? WHERE chat_id = ? AND user_id = ?')
      .run(blocked ? 1 : 0, chatId, userId);
  },

  clearHistory(chatId) {
    db.prepare('UPDATE messages SET deleted = 1 WHERE chat_id = ?').run(chatId);
  },

  createGroup({ name, creatorId, memberIds }) {
    const id = uid();
    const now = Date.now();
    db.prepare(`INSERT INTO chats (id, type, name, created_at, created_by) VALUES (?, 'group', ?, ?, ?)`)
      .run(id, name, now, creatorId);
    const addMember = db.prepare(`INSERT OR IGNORE INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)`);
    const uniqueIds = Array.from(new Set([creatorId, ...memberIds]));
    const tx = db.transaction(() => {
      for (const uid of uniqueIds) addMember.run(id, uid, now);
    });
    tx();
    return this.byId(id);
  },

  addMember(chatId, userId) {
    db.prepare(`INSERT OR IGNORE INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)`)
      .run(chatId, userId, Date.now());
  },

  removeMember(chatId, userId) {
    db.prepare(`DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?`).run(chatId, userId);
  },
};

// ============ MESSAGE QUERIES ============
const messages = {
  create({ chatId, senderId, type = 'text', text = null, filePath = null, fileName = null, fileSize = null, replyTo = null }) {
    const id = uid();
    const now = Date.now();
    db.prepare(`
      INSERT INTO messages (id, chat_id, sender_id, type, text, file_path, file_name, file_size, reply_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, chatId, senderId, type, text, filePath, fileName, fileSize, replyTo, now);
    return this.byId(id);
  },

  byId(id) {
    return db.prepare(`
      SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `).get(id);
  },

  listForChat(chatId, limit = 100, before = null) {
    let sql = `
      SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.chat_id = ? AND m.deleted = 0
    `;
    const params = [chatId];
    if (before) {
      sql += ' AND m.created_at < ?';
      params.push(before);
    }
    sql += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);
    return db.prepare(sql).all(...params).reverse();
  },

  lastInChat(chatId) {
    return db.prepare(`
      SELECT m.*, u.name as sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.chat_id = ? AND m.deleted = 0
      ORDER BY m.created_at DESC LIMIT 1
    `).get(chatId);
  },

  unreadCount(chatId, userId) {
    return db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      WHERE m.chat_id = ? AND m.sender_id != ? AND m.deleted = 0
      AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)
    `).get(chatId, userId, userId).count;
  },

  markRead(chatId, userId) {
    const now = Date.now();
    const unread = db.prepare(`
      SELECT m.id FROM messages m
      WHERE m.chat_id = ? AND m.sender_id != ?
      AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)
    `).all(chatId, userId, userId);
    const stmt = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)');
    const tx = db.transaction(() => {
      for (const m of unread) stmt.run(m.id, userId, now);
    });
    tx();
    return unread.map(m => m.id);
  },

  isRead(messageId, userId) {
    return !!db.prepare('SELECT 1 FROM message_reads WHERE message_id = ? AND user_id = ?')
      .get(messageId, userId);
  },

  edit(messageId, text) {
    db.prepare('UPDATE messages SET text = ?, edited = 1 WHERE id = ?').run(text, messageId);
  },

  softDelete(messageId) {
    db.prepare('UPDATE messages SET deleted = 1 WHERE id = ?').run(messageId);
  },
};

// ============ CONTACTS ============
const contacts = {
  add(userId, contactId) {
    db.prepare('INSERT OR IGNORE INTO contacts (user_id, contact_id, added_at) VALUES (?, ?, ?)')
      .run(userId, contactId, Date.now());
  },

  remove(userId, contactId) {
    db.prepare('DELETE FROM contacts WHERE user_id = ? AND contact_id = ?').run(userId, contactId);
  },

  listFor(userId) {
    return db.prepare(`
      SELECT u.id, u.name, u.username, u.phone, u.birth, u.avatar, u.verified, u.online, u.last_seen, u.hide_last_seen
      FROM contacts c
      JOIN users u ON u.id = c.contact_id
      WHERE c.user_id = ?
      ORDER BY u.name
    `).all(userId);
  },
};

// ============ REPORTS ============
const reports = {
  create({ reporterId, againstId, chatId, reason, details }) {
    const id = uid();
    db.prepare(`
      INSERT INTO reports (id, reporter_id, against_id, chat_id, reason, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, reporterId, againstId, chatId, reason, details, Date.now());
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  },

  listForUser(userId) {
    return db.prepare(`
      SELECT r.*, u.name as against_name, u.username as against_username
      FROM reports r
      JOIN users u ON u.id = r.against_id
      WHERE r.reporter_id = ?
      ORDER BY r.created_at DESC
    `).all(userId);
  },

  resolve(id) {
    db.prepare('UPDATE reports SET status = ?, resolved_at = ? WHERE id = ?')
      .run('resolved', Date.now(), id);
  },
};

// ============ BLOCKS ============
const blocks = {
  add(userId, blockedId) {
    db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?, ?, ?)')
      .run(userId, blockedId, Date.now());
  },

  remove(userId, blockedId) {
    db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_id = ?').run(userId, blockedId);
  },

  isBlocked(userId, otherId) {
    return !!db.prepare('SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)')
      .get(userId, otherId, otherId, userId);
  },
};

// ============ SEEDING (demo users for first run) ============
function seed() {
  const bcrypt = require('bcryptjs');
  const existing = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  if (existing > 0) return;

  const hash = bcrypt.hashSync('demo1234', 10);
  const demoUsers = [
    { id: 'u_support', name: 'Stack Поддержка', username: '@stack_help', phone: '+0000', birth: '1990-01-01', verified: 1 },
    { id: 'u_anna',    name: 'Анна Петрова',    username: '@anna_p',    phone: '+79215550101', birth: '2010-05-14' },
    { id: 'u_maxim',   name: 'Максим Волков',   username: '@max_w',     phone: '+79215550102', birth: '1992-08-22' },
    { id: 'u_lena',    name: 'Лена Соколова',   username: '@lena_s',    phone: '+79215550103', birth: '2012-03-10' },
    { id: 'u_igor',    name: 'Игорь Дмитриев',  username: '@igor_d',    phone: '+79215550104', birth: '1988-11-30' },
    { id: 'u_kate',    name: 'Катя Иванова',    username: '@kate_i',    phone: '+79215550105', birth: '2009-07-07' },
    { id: 'u_dmitry',  name: 'Дмитрий Новиков', username: '@dmitry_n',  phone: '+79215550106', birth: '1995-02-18' },
  ];

  const insert = db.prepare(`
    INSERT INTO users (id, name, username, phone, password, birth, verified, parental_control, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const now = Date.now();
  const tx = db.transaction(() => {
    for (const u of demoUsers) {
      insert.run(u.id, u.name, u.username, u.phone, hash, u.birth, u.verified || 0, isMinor(u.birth) ? 1 : 0, now);
    }
  });
  tx();

  console.log('[DB] Seeded 7 demo users (password: demo1234)');
}

seed();

module.exports = { db, users, chats, messages, contacts, reports, blocks, uid, ageFromBirth, isMinor };
