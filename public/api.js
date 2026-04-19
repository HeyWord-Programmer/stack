/* ============ STACK API CLIENT ============ */

const API = {
  base: '',
  token: localStorage.getItem('stack_token') || null,

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('stack_token', token);
    else localStorage.removeItem('stack_token');
  },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;

    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      const err = new Error(data.error || 'Request failed');
      err.status = res.status;
      err.code = data.code;
      throw err;
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },
  del(path) { return this.request('DELETE', path); },

  // ===== AUTH =====
  register(payload) { return this.post('/api/auth/register', payload); },
  login(payload) { return this.post('/api/auth/login', payload); },
  me() { return this.get('/api/auth/me'); },

  // ===== USERS =====
  searchUsers(q) { return this.get('/api/users/search?q=' + encodeURIComponent(q)); },
  getUser(id) { return this.get('/api/users/' + id); },
  updateProfile(data) { return this.put('/api/users/me', data); },
  updateSettings(data) { return this.put('/api/users/me/settings', data); },

  // ===== CONTACTS =====
  listContacts() { return this.get('/api/users/me/contacts'); },
  addContact(userId) { return this.post('/api/users/me/contacts', { userId }); },
  removeContact(id) { return this.del('/api/users/me/contacts/' + id); },

  // ===== CHATS =====
  listChats() { return this.get('/api/chats'); },
  createChat(userId) { return this.post('/api/chats', { userId }); },
  createGroup(name, memberIds) { return this.post('/api/chats/group', { name, memberIds }); },
  getChat(id) { return this.get('/api/chats/' + id); },
  getMessages(chatId, before) {
    const qs = before ? '?before=' + before : '';
    return this.get('/api/chats/' + chatId + '/messages' + qs);
  },
  markRead(chatId) { return this.post('/api/chats/' + chatId + '/read'); },
  muteChat(chatId, muted) { return this.post('/api/chats/' + chatId + '/mute', { muted }); },
  blockChat(chatId, blocked) { return this.post('/api/chats/' + chatId + '/block', { blocked }); },
  clearChat(chatId) { return this.post('/api/chats/' + chatId + '/clear'); },

  // ===== MESSAGES =====
  sendMessage(payload) { return this.post('/api/messages', payload); },
  editMessage(id, text) { return this.put('/api/messages/' + id, { text }); },
  deleteMessage(id) { return this.del('/api/messages/' + id); },

  // ===== REPORTS =====
  createReport(payload) { return this.post('/api/reports', payload); },
  listReports() { return this.get('/api/reports'); },

  // ===== UPLOAD =====
  async uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const headers = {};
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch('/api/upload', { method: 'POST', headers, body: fd });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};

/* ============ WEBSOCKET CLIENT ============ */

const WS = {
  ws: null,
  handlers: new Map(),
  reconnectTimer: null,
  pingTimer: null,

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
  },

  off(event, fn) {
    this.handlers.get(event)?.delete(fn);
  },

  emit(event, data) {
    this.handlers.get(event)?.forEach(fn => fn(data));
  },

  connect(token) {
    if (!token) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?token=${encodeURIComponent(token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[WS] connected');
      this.emit('open');
      clearTimeout(this.reconnectTimer);
      this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 30000);
    };

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this.emit(msg.type, msg);
        this.emit('*', msg);
      } catch {}
    };

    this.ws.onclose = () => {
      console.log('[WS] closed');
      clearInterval(this.pingTimer);
      this.emit('close');
      // reconnect
      if (API.token) {
        this.reconnectTimer = setTimeout(() => this.connect(API.token), 2000);
      }
    };

    this.ws.onerror = () => {};
  },

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  },

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  },
};
