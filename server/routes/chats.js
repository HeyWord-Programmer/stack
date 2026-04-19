const express = require('express');
const router = express.Router();
const { users, chats, messages, blocks, isMinor } = require('../db');
const { authMiddleware } = require('../auth');

router.use(authMiddleware);

// GET /api/chats  — список чатов с последним сообщением и unread
router.get('/', (req, res) => {
  const list = chats.listForUser(req.user.id);
  const out = list.map(chat => {
    const members = chats.getMembers(chat.id);
    const other = chat.type === 'private' ? members.find(m => m.id !== req.user.id) : null;
    const last = messages.lastInChat(chat.id);
    const unread = messages.unreadCount(chat.id, req.user.id);
    return {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      muted: !!chat.muted,
      blocked: !!chat.blocked,
      peer: other ? users.publicView(other) : null,
      membersCount: members.length,
      lastMessage: last ? {
        id: last.id,
        text: last.text,
        type: last.type,
        sender_id: last.sender_id,
        sender_name: last.sender_name,
        created_at: last.created_at,
      } : null,
      unread,
    };
  });
  out.sort((a, b) => (b.lastMessage?.created_at || 0) - (a.lastMessage?.created_at || 0));
  res.json({ chats: out });
});

// POST /api/chats/group  — создать группу
router.post('/group', (req, res) => {
  const { name, memberIds } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Название обязательно' });
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    return res.status(400).json({ error: 'Добавьте хотя бы одного участника' });
  }

  // Проверка возрастных ограничений: если пользователь-ребенок создает группу,
  // запрещаем приглашать взрослых (и наоборот)
  const me = req.user;
  const meMinor = isMinor(me.birth);
  for (const memberId of memberIds) {
    const member = users.byId(memberId);
    if (!member) return res.status(404).json({ error: 'Один из участников не найден' });
    if (blocks.isBlocked(req.user.id, memberId)) continue;
    const themMinor = isMinor(member.birth);
    if (meMinor !== themMinor && me.restrict_adult_contact && !member.verified) {
      return res.status(403).json({
        error: `Нельзя добавить ${member.name}: возрастное ограничение Stack`,
        code: 'AGE_RESTRICTED',
      });
    }
  }

  const chat = chats.createGroup({
    name: name.trim(),
    creatorId: req.user.id,
    memberIds,
  });
  res.json({ chat: { id: chat.id, type: 'group', name: chat.name } });
});

// POST /api/chats  — создать/найти приватный чат с пользователем
router.post('/', (req, res) => {
  const { userId } = req.body;
  if (!userId || userId === req.user.id) return res.status(400).json({ error: 'Bad request' });

  const target = users.byId(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Проверка блокировки
  if (blocks.isBlocked(req.user.id, userId)) {
    return res.status(403).json({ error: 'Пользователь заблокирован' });
  }

  // Проверка возрастного ограничения
  const me = req.user;
  const meMinor = isMinor(me.birth);
  const themMinor = isMinor(target.birth);
  const crossAge = meMinor !== themMinor;
  if (crossAge && me.restrict_adult_contact && !target.verified) {
    return res.status(403).json({
      error: 'Stack защищает: общение несовершеннолетних с незнакомыми взрослыми ограничено. Отключите в настройках, если уверены.',
      code: 'AGE_RESTRICTED',
    });
  }

  const chat = chats.createPrivate(req.user.id, userId);
  res.json({ chat: { id: chat.id, type: chat.type } });
});

// GET /api/chats/:id — получить инфо о чате
router.get('/:id', (req, res) => {
  const chat = chats.byId(req.params.id);
  if (!chat) return res.status(404).json({ error: 'Not found' });
  if (!chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

  const members = chats.getMembers(chat.id).map(m => users.publicView(m));
  const myMembership = chats.getMembers(chat.id).find(m => m.id === req.user.id);
  res.json({
    chat: {
      id: chat.id,
      type: chat.type,
      members,
      muted: !!myMembership?.muted,
      blocked: !!myMembership?.blocked,
    }
  });
});

// GET /api/chats/:id/messages?before=ts&limit=50
router.get('/:id/messages', (req, res) => {
  const chat = chats.byId(req.params.id);
  if (!chat) return res.status(404).json({ error: 'Not found' });
  if (!chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });

  const before = req.query.before ? parseInt(req.query.before) : null;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const msgs = messages.listForChat(chat.id, limit, before).map(m => ({
    id: m.id,
    chat_id: m.chat_id,
    sender_id: m.sender_id,
    sender_name: m.sender_name,
    type: m.type,
    text: m.text,
    file_path: m.file_path,
    file_name: m.file_name,
    file_size: m.file_size,
    reply_to: m.reply_to,
    edited: !!m.edited,
    created_at: m.created_at,
    read: m.sender_id === req.user.id ? messages.isRead(m.id, getOtherMemberId(m.chat_id, req.user.id)) : true,
  }));

  res.json({ messages: msgs });
});

function getOtherMemberId(chatId, userId) {
  const members = chats.getMembers(chatId);
  return members.find(m => m.id !== userId)?.id;
}

// POST /api/chats/:id/read — отметить все как прочитанное
router.post('/:id/read', (req, res) => {
  const chat = chats.byId(req.params.id);
  if (!chat || !chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  const ids = messages.markRead(chat.id, req.user.id);
  res.json({ marked: ids.length, ids });
});

// POST /api/chats/:id/mute
router.post('/:id/mute', (req, res) => {
  const chat = chats.byId(req.params.id);
  if (!chat || !chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  const { muted } = req.body;
  chats.setMuted(chat.id, req.user.id, muted);
  res.json({ ok: true, muted: !!muted });
});

// POST /api/chats/:id/block
router.post('/:id/block', (req, res) => {
  const chat = chats.byId(req.params.id);
  if (!chat || !chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  const { blocked } = req.body;
  chats.setBlocked(chat.id, req.user.id, blocked);

  const other = getOtherMemberId(chat.id, req.user.id);
  if (blocked && other) blocks.add(req.user.id, other);
  if (!blocked && other) blocks.remove(req.user.id, other);

  res.json({ ok: true, blocked: !!blocked });
});

// POST /api/chats/:id/clear — очистить историю
router.post('/:id/clear', (req, res) => {
  const chat = chats.byId(req.params.id);
  if (!chat || !chats.isMember(chat.id, req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  chats.clearHistory(chat.id);
  res.json({ ok: true });
});

module.exports = router;
