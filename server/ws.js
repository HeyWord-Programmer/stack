const { WebSocketServer } = require('ws');
const { verifyToken } = require('./auth');
const { users, chats, messages } = require('./db');

class StackWS {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map();  // userId -> Set<ws>
    this.typing = new Map();   // chatId -> Map<userId, timeout>

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    console.log('[WS] Ready on /ws');
  }

  handleConnection(ws, req) {
    const url = new URL(req.url, 'http://x');
    const token = url.searchParams.get('token');
    const payload = verifyToken(token);

    if (!payload) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const user = users.byId(payload.id);
    if (!user) {
      ws.close(4001, 'User not found');
      return;
    }

    ws.userId = user.id;

    if (!this.clients.has(user.id)) this.clients.set(user.id, new Set());
    this.clients.get(user.id).add(ws);

    // mark online
    users.setOnline(user.id, true);
    this.broadcastPresence(user.id, true);

    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleClose(ws));
    ws.on('error', () => {});

    ws.send(JSON.stringify({ type: 'connected', userId: user.id }));
  }

  handleMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    const userId = ws.userId;
    if (!userId) return;

    switch (msg.type) {
      case 'typing': {
        const { chatId, isTyping } = msg;
        if (!chatId) return;
        if (!chats.isMember(chatId, userId)) return;

        const members = chats.getMembers(chatId);
        for (const m of members) {
          if (m.id === userId) continue;
          this.sendToUser(m.id, { type: 'typing', chatId, userId, isTyping: !!isTyping });
        }
        break;
      }
      case 'read': {
        const { chatId } = msg;
        if (!chatId || !chats.isMember(chatId, userId)) return;
        const ids = messages.markRead(chatId, userId);
        const members = chats.getMembers(chatId);
        for (const m of members) {
          if (m.id === userId) continue;
          this.sendToUser(m.id, { type: 'read', chatId, userId, messageIds: ids });
        }
        break;
      }
      case 'call:offer':
      case 'call:answer':
      case 'call:hangup':
      case 'call:ice': {
        const { peerId } = msg;
        if (!peerId) return;
        this.sendToUser(peerId, { ...msg, fromId: userId });
        break;
      }
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      }
    }
  }

  handleClose(ws) {
    const userId = ws.userId;
    if (!userId) return;
    const set = this.clients.get(userId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        this.clients.delete(userId);
        users.setOnline(userId, false);
        this.broadcastPresence(userId, false);
      }
    }
  }

  sendToUser(userId, payload) {
    const set = this.clients.get(userId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const ws of set) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  broadcastPresence(userId, online) {
    // Рассылаем всем собеседникам
    const userChats = chats.listForUser(userId);
    for (const chat of userChats) {
      const members = chats.getMembers(chat.id);
      for (const m of members) {
        if (m.id === userId) continue;
        this.sendToUser(m.id, { type: 'presence', userId, online, lastSeen: Date.now() });
      }
    }
  }
}

module.exports = StackWS;
