const express = require('express');
const router = express.Router();
const { users, chats, messages, blocks, isMinor } = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// ============ REVERSE GEOCODING (Nominatim + fallback) ============
const geoCache = new Map(); // "lat,lng" rounded -> country code

function roughCountryFromBBox(lat, lng) {
  if (lat >= 41.185 && lat <= 81.858 && lng >= 19.638 && lng <= 180)   return 'RU';
  if (lat >= 40.568 && lat <= 55.449 && lng >= 46.466 && lng <= 87.315) return 'KZ';
  if (lat >= 51.262 && lat <= 56.172 && lng >= 23.179 && lng <= 32.777) return 'BY';
  if (lat >= 44.386 && lat <= 52.380 && lng >= 22.137 && lng <= 40.228) return 'UA';
  if (lat >= 37.181 && lat <= 45.586 && lng >= 55.996 && lng <= 73.771) return 'UZ';
  if (lat >= 39.180 && lat <= 43.266 && lng >= 69.240 && lng <= 80.283) return 'KG';
  if (lat >= 38.833 && lat <= 41.297 && lng >= 43.448 && lng <= 46.633) return 'AM';
  if (lat >= 38.394 && lat <= 41.906 && lng >= 44.794 && lng <= 50.369) return 'AZ';
  if (lat >= 45.469 && lat <= 48.492 && lng >= 26.619 && lng <= 30.125) return 'MD';
  if (lat >= 35.808 && lat <= 42.109 && lng >= 25.668 && lng <= 44.817) return 'TR';
  if (lat >= 33.190 && lat <= 38.613 && lng >= 125.066 && lng <= 131.871) return 'KR';
  if (lat >= 24.396 && lat <= 45.551 && lng >= 122.933 && lng <= 153.986) return 'JP';
  if (lat >= 18.153 && lat <= 53.561 && lng >= 73.499 && lng <= 134.774) return 'CN';
  if (lat >= 21.891 && lat <= 25.299 && lng >= 120.035 && lng <= 122.007) return 'TW';
  if (lat >= 22.153 && lat <= 22.562 && lng >= 113.835 && lng <= 114.406) return 'HK';
  if (lat >= 6.747 && lat <= 35.505 && lng >= 68.176 && lng <= 97.403) return 'IN';
  if (lat >= 24.396 && lat <= 49.384 && lng >= -124.848 && lng <= -66.885) return 'US';
  if (lat >= 41.676 && lat <= 83.110 && lng >= -141.003 && lng <= -52.619) return 'CA';
  if (lat >= 14.532 && lat <= 32.718 && lng >= -118.365 && lng <= -86.703) return 'MX';
  if (lat >= -34.000 && lat <= 5.272 && lng >= -73.983 && lng <= -34.729) return 'BR';
  return null;
}

async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (geoCache.has(key)) return geoCache.get(key);

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 2500);
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Stack-Messenger/1.0 (educational)' },
    });
    clearTimeout(to);
    if (res.ok) {
      const data = await res.json();
      const cc = (data.address?.country_code || '').toUpperCase() || null;
      if (cc) { geoCache.set(key, cc); return cc; }
    }
  } catch {}

  const fallback = roughCountryFromBBox(lat, lng);
  if (fallback) geoCache.set(key, fallback);
  return fallback;
}

async function enrichLocation(text) {
  try {
    const p = JSON.parse(text);
    if (p.country || p.lat == null || p.lng == null) return text;
    const country = await reverseGeocode(p.lat, p.lng);
    return JSON.stringify({ lat: p.lat, lng: p.lng, country });
  } catch { return text; }
}

// POST /api/messages  — отправить сообщение
router.post('/', async (req, res) => {
  let { chatId, text, type = 'text', filePath, fileName, fileSize, replyTo } = req.body;

  if (!chatId) return res.status(400).json({ error: 'chatId required' });
  if (type === 'text' && (!text || !text.trim())) return res.status(400).json({ error: 'Text required' });

  if (type === 'location' && text) {
    text = await enrichLocation(text);
  }

  const chat = chats.byId(chatId);
  if (!chat) return res.status(404).json({ error: 'Chat not found' });
  if (!chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

  const members = chats.getMembers(chat.id);

  // Для приватных чатов — проверка блокировок и возраста
  if (chat.type === 'private') {
    const other = members.find(m => m.id !== req.user.id);
    if (other && blocks.isBlocked(other.id, req.user.id)) {
      return res.status(403).json({ error: 'Вы заблокированы этим пользователем' });
    }
    if (other) {
      const me = req.user;
      const meMinor = isMinor(me.birth);
      const themMinor = isMinor(other.birth);
      const crossAge = meMinor !== themMinor;
      if (crossAge && me.restrict_adult_contact && !other.verified) {
        return res.status(403).json({ error: 'Общение ограничено правилами безопасности Stack', code: 'AGE_RESTRICTED' });
      }
    }
  }

  const msg = messages.create({
    chatId,
    senderId: req.user.id,
    type,
    text: text ? text.trim() : null,
    filePath,
    fileName,
    fileSize,
    replyTo,
  });

  const out = {
    id: msg.id,
    chat_id: msg.chat_id,
    sender_id: msg.sender_id,
    sender_name: msg.sender_name,
    type: msg.type,
    text: msg.text,
    file_path: msg.file_path,
    file_name: msg.file_name,
    file_size: msg.file_size,
    reply_to: msg.reply_to,
    created_at: msg.created_at,
    read: false,
  };

  // Broadcast всем участникам чата
  const ws = req.app.get('ws');
  if (ws) {
    for (const m of members) {
      ws.sendToUser(m.id, { type: 'message:new', message: out });
    }
  }

  res.json({ message: out });
});

// PUT /api/messages/:id — редактировать
router.put('/:id', (req, res) => {
  const msg = messages.byId(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty text' });

  messages.edit(msg.id, text.trim());
  const fresh = messages.byId(msg.id);

  const ws = req.app.get('ws');
  const members = chats.getMembers(msg.chat_id);
  for (const m of members) {
    ws?.sendToUser(m.id, { type: 'message:edit', message: { id: fresh.id, text: fresh.text, edited: true } });
  }

  res.json({ message: { id: fresh.id, text: fresh.text, edited: true } });
});

// DELETE /api/messages/:id
router.delete('/:id', (req, res) => {
  const msg = messages.byId(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Not found' });
  if (msg.sender_id !== req.user.id) return res.status(403).json({ error: 'Not your message' });

  messages.softDelete(msg.id);

  const ws = req.app.get('ws');
  const members = chats.getMembers(msg.chat_id);
  for (const m of members) {
    ws?.sendToUser(m.id, { type: 'message:delete', messageId: msg.id, chatId: msg.chat_id });
  }

  res.json({ ok: true });
});

module.exports = router;
