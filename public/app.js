/* ============ STACK CLIENT (server-backed) ============ */

const EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💕','💞','💓','💗','💖','💘','💝','✨','⭐','🌟','💫','🔥','💯','✅','❌','👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','👏','🙌','🤝','🙏'];

// ============ MAPS — выбор карты по стране ============
const Maps = {
  // URL-строители по провайдерам
  providers: {
    google: { name: 'Google Maps',  url: (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}` },
    yandex: { name: 'Яндекс Карты', url: (lat, lng) => `https://yandex.ru/maps/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm` },
    dgis:   { name: '2GIS',         url: (lat, lng) => `https://2gis.com/geo/${lng},${lat}?m=${lng},${lat}/16` },
    naver:  { name: 'Naver Maps',   url: (lat, lng) => `https://map.naver.com/v5/?c=${lng},${lat},15,0,0,0,dh` },
    kakao:  { name: 'Kakao Maps',   url: (lat, lng) => `https://map.kakao.com/link/map/Location,${lat},${lng}` },
    baidu:  { name: 'Baidu Maps',   url: (lat, lng) => `https://api.map.baidu.com/marker?location=${lat},${lng}&title=Location&content=Shared&output=html&coord_type=wgs84` },
    amap:   { name: 'Amap (Gaode)', url: (lat, lng) => `https://uri.amap.com/marker?position=${lng},${lat}&coordinate=wgs84` },
    apple:  { name: 'Apple Maps',   url: (lat, lng) => `https://maps.apple.com/?ll=${lat},${lng}&q=${lat},${lng}` },
    osm:    { name: 'OpenStreetMap',url: (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16#map=16/${lat}/${lng}` },
  },

  // Первый в массиве = по умолчанию (самый популярный в стране)
  byCountry: {
    RU: ['yandex', 'dgis', 'google', 'osm'],
    BY: ['yandex', 'google', 'osm'],
    KZ: ['dgis', 'yandex', 'google'],
    UZ: ['yandex', 'google', 'osm'],
    KG: ['dgis', 'yandex', 'google'],
    AM: ['yandex', 'google'],
    AZ: ['google', 'yandex'],
    UA: ['google', 'osm'],
    MD: ['google', 'osm'],
    TR: ['google', 'yandex'],

    KR: ['naver', 'kakao', 'google'],        // Naver по умолчанию, Kakao в выпадайке
    JP: ['google', 'apple', 'osm'],
    CN: ['baidu', 'amap', 'google'],
    HK: ['google', 'baidu', 'apple'],
    TW: ['google', 'apple'],

    IN: ['google', 'apple', 'osm'],
    US: ['google', 'apple', 'osm'],
    CA: ['google', 'apple', 'osm'],
    MX: ['google', 'apple'],
    BR: ['google', 'apple'],
  },

  providersFor(cc) {
    const list = this.byCountry[(cc || '').toUpperCase()];
    return list && list.length ? list : ['google', 'apple', 'osm'];
  },

  primary(cc) { return this.providersFor(cc)[0]; },
  name(key) { return this.providers[key]?.name || key; },
  url(key, lat, lng) { return this.providers[key]?.url(lat, lng) || `https://www.google.com/maps?q=${lat},${lng}`; },

  countryFlag(cc) {
    if (!cc || cc.length !== 2) return '';
    const code = cc.toUpperCase();
    return String.fromCodePoint(...[...code].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
  },
};

const Store = {
  me: null,
  chats: [],
  activeChatId: null,
  activeChatPeer: null,
  activeChatChatInfo: null,
  activeChatMessages: [],
  call: { pc: null, localStream: null, remoteStream: null, peerId: null, type: null, incoming: null },
  voiceRec: { recorder: null, chunks: [], stream: null, timer: null, startedAt: 0 },
};

const U = {
  ageFromBirth(birth) {
    if (!birth) return 100;
    return Math.floor((Date.now() - new Date(birth).getTime()) / 31557600000);
  },

  isMinor(birth) { return this.ageFromBirth(birth) < 18; },

  initials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  },

  avatarColor(id) {
    const colors = ['c1', 'c2', 'c3', 'c4', 'c5'];
    let sum = 0;
    for (let i = 0; i < (id || '').length; i++) sum += id.charCodeAt(i);
    return colors[sum % colors.length];
  },

  formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toTimeString().slice(0, 5);
    const diff = (now - d) / 86400000;
    if (diff < 7) return ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  },

  formatDay(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (d.toDateString() === now.toDateString()) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  },

  formatLastSeen(ts) {
    if (!ts) return 'недавно';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'только что';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' мин назад';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' ч назад';
    return this.formatDay(ts);
  },

  formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  },

  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

const App = {
  async init() {
    setTimeout(() => { document.getElementById('splash').style.display = 'none'; }, 2200);

    this.renderEmojis();
    this.bindGlobalEvents();
    this.bindWS();

    if (API.token) {
      try {
        const { user } = await API.me();
        Store.me = user;
        this.applyTheme();
        await this.showMain();
        WS.connect(API.token);
      } catch (e) {
        API.setToken(null);
        this.showAuth();
      }
    } else {
      this.showAuth();
    }
  },

  bindWS() {
    WS.on('message:new', ({ message }) => {
      if (Store.activeChatId === message.chat_id) {
        Store.activeChatMessages.push(message);
        this.renderMessages();
        if (message.sender_id !== Store.me.id) {
          WS.send({ type: 'read', chatId: message.chat_id });
        }
      }
      this.refreshChats();
    });

    WS.on('message:edit', ({ message }) => {
      const m = Store.activeChatMessages.find(x => x.id === message.id);
      if (m) {
        m.text = message.text;
        m.edited = true;
        this.renderMessages();
      }
    });

    WS.on('message:delete', ({ messageId, chatId }) => {
      if (Store.activeChatId === chatId) {
        Store.activeChatMessages = Store.activeChatMessages.filter(m => m.id !== messageId);
        this.renderMessages();
      }
      this.refreshChats();
    });

    WS.on('typing', ({ chatId, isTyping }) => {
      if (Store.activeChatId !== chatId) return;
      const indicator = document.getElementById('typing-indicator');
      if (!indicator) return;
      indicator.classList.toggle('hidden', !isTyping);
    });

    WS.on('read', ({ chatId, messageIds }) => {
      if (Store.activeChatId === chatId) {
        for (const m of Store.activeChatMessages) {
          if (messageIds.includes(m.id)) m.read = true;
        }
        this.renderMessages();
      }
    });

    WS.on('call:offer', (msg) => this.handleIncomingCall(msg));
    WS.on('call:answer', async (msg) => {
      if (!Store.call.pc) return;
      try { await Store.call.pc.setRemoteDescription(msg.sdp); } catch {}
    });
    WS.on('call:ice', async (msg) => {
      if (!Store.call.pc || !msg.candidate) return;
      try { await Store.call.pc.addIceCandidate(msg.candidate); } catch {}
    });
    WS.on('call:hangup', () => {
      this.toast('Звонок завершен');
      this.cleanupCall();
    });

    WS.on('presence', ({ userId, online, lastSeen }) => {
      for (const c of Store.chats) {
        if (c.peer?.id === userId) {
          c.peer.online = online;
          c.peer.last_seen = lastSeen;
        }
      }
      this.renderSidebar();
      if (Store.activeChatPeer?.id === userId) {
        Store.activeChatPeer.online = online;
        Store.activeChatPeer.last_seen = lastSeen;
        this.renderChatHeader(Store.activeChatPeer);
      }
    });
  },

  bindGlobalEvents() {
    document.addEventListener('click', (e) => {
      const dismiss = (id, triggerSel) => {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) {
          if (!e.target.closest('#' + id) && !e.target.closest(triggerSel)) {
            el.classList.add('hidden');
          }
        }
      };
      dismiss('side-menu', '.menu-btn');
      dismiss('chat-menu', '[title="Ещё"]');
      dismiss('attach-menu', '[title="Вложение"]');
      dismiss('emoji-panel', '.emoji-btn');
    });
  },

  // ============ АВТОРИЗАЦИЯ ============
  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
  },

  showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  },

  showRegister() {
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
  },

  async login() {
    const identifier = document.getElementById('login-id').value.trim();
    const password = document.getElementById('login-pass').value;
    if (!identifier || !password) return this.toast('Заполните все поля', 'error');

    try {
      const { token, user } = await API.login({ identifier, password });
      API.setToken(token);
      Store.me = user;
      this.applyTheme();
      await this.showMain();
      WS.connect(token);
      this.toast(`С возвращением, ${user.name}!`, 'success');
    } catch (e) {
      this.toast(e.message || 'Ошибка входа', 'error');
    }
  },

  async register() {
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const birth = document.getElementById('reg-birth').value;
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-pass').value;
    const agree = document.getElementById('reg-agree').checked;

    if (!name || !username || !birth || !phone || !password) return this.toast('Заполните все поля', 'error');
    if (password.length < 6) return this.toast('Пароль минимум 6 символов', 'error');
    if (!agree) return this.toast('Нужно принять правила', 'error');

    try {
      const { token, user } = await API.register({ name, username, birth, phone, password });
      API.setToken(token);
      Store.me = user;
      this.applyTheme();
      await this.showMain();
      WS.connect(token);
      this.toast(`Добро пожаловать, ${user.name}!`, 'success');
    } catch (e) {
      this.toast(e.message || 'Ошибка регистрации', 'error');
    }
  },

  async logout() {
    if (!confirm('Выйти из аккаунта?')) return;
    WS.disconnect();
    API.setToken(null);
    Store.me = null;
    Store.chats = [];
    Store.activeChatId = null;
    this.showAuth();
    this.toast('Вы вышли из аккаунта');
  },

  // ============ ОСНОВНОЙ ЭКРАН ============
  async showMain() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    await this.refreshChats();
    this.updateSafetyBanner();
    this.renderMenuProfile();
  },

  async refreshChats() {
    try {
      const { chats } = await API.listChats();
      Store.chats = chats;
      this.renderSidebar();
    } catch (e) {
      console.error(e);
    }
  },

  updateSafetyBanner() {
    const banner = document.getElementById('safety-banner');
    if (Store.me && U.isMinor(Store.me.birth) && Store.me.restrict_adult_contact) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  },

  renderMenuProfile() {
    const el = document.getElementById('menu-profile');
    const u = Store.me;
    if (!u) return;
    el.innerHTML = `
      <div class="avatar size-md">${U.escapeHtml(U.initials(u.name))}</div>
      <div class="menu-profile-info">
        <div class="menu-profile-name">${U.escapeHtml(u.name)}</div>
        <div class="menu-profile-phone">${U.escapeHtml(u.phone || u.username)}</div>
      </div>
    `;
    const badge = document.getElementById('parental-badge');
    badge.textContent = u.parental_control ? 'On' : 'Off';
    badge.classList.toggle('on', !!u.parental_control);
  },

  renderSidebar(filter = '') {
    const list = document.getElementById('chat-list');
    list.innerHTML = '';

    const chatTitle = c => c.type === 'group' ? (c.name || 'Группа') : (c.peer?.name || '');

    const filtered = Store.chats.filter(c => {
      if (!filter) return true;
      return chatTitle(c).toLowerCase().includes(filter.toLowerCase());
    });

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-muted);font-size:14px;">
          ${filter ? 'Ничего не найдено' : 'Нажмите «Новый чат», чтобы начать общение'}
        </div>
      `;
      return;
    }

    for (const chat of filtered) {
      const isGroup = chat.type === 'group';
      const title = chatTitle(chat);
      const avatarId = isGroup ? chat.id : chat.peer?.id;
      const lastMsg = chat.lastMessage;
      const unread = chat.unread;
      const isActive = chat.id === Store.activeChatId;

      const item = document.createElement('div');
      item.className = 'chat-item' + (isActive ? ' active' : '');
      item.onclick = () => this.openChat(chat.id);

      let preview = '';
      if (lastMsg) {
        if (lastMsg.type !== 'text') preview = this.typeLabel(lastMsg.type);
        else preview = lastMsg.text || '';
        if (isGroup && lastMsg.sender_id !== Store.me.id && lastMsg.sender_name) {
          preview = `${lastMsg.sender_name.split(' ')[0]}: ${preview}`;
        }
      }
      const isOwn = lastMsg?.sender_id === Store.me.id;
      const onlineDot = (!isGroup && chat.peer?.online) ? '<div class="avatar-online"></div>' : '';
      const verified = !isGroup && chat.peer?.verified ? '✓' : '';
      const groupIcon = isGroup ? '👥' : U.escapeHtml(U.initials(title));

      item.innerHTML = `
        <div class="avatar ${U.avatarColor(avatarId || title)}">
          ${groupIcon}
          ${onlineDot}
        </div>
        <div class="chat-meta">
          <div class="chat-row-top">
            <div class="chat-name">${U.escapeHtml(title)} ${verified}${isGroup ? '<span class="group-badge">👥 ' + chat.membersCount + '</span>' : ''}</div>
            <div class="chat-time">${lastMsg ? U.formatTime(lastMsg.created_at) : ''}</div>
          </div>
          <div class="chat-row-bottom">
            <div class="chat-preview">
              ${isOwn ? '<span class="chat-check">✓✓</span>' : ''}${U.escapeHtml((preview || '').slice(0, 60))}
            </div>
            ${unread > 0 ? `<div class="chat-badge ${chat.muted ? 'muted' : ''}">${unread}</div>` : ''}
          </div>
        </div>
      `;
      list.appendChild(item);
    }
  },

  typeLabel(type) {
    const map = { photo: '📷 Фото', video: '🎬 Видео', file: '📄 Файл', voice: '🎤 Голосовое', location: '📍 Локация', contact: '👤 Контакт' };
    return map[type] || '';
  },

  searchChats(q) { this.renderSidebar(q); },

  toggleMenu() {
    document.getElementById('side-menu').classList.toggle('hidden');
  },

  // ============ АКТИВНЫЙ ЧАТ ============
  async openChat(chatId) {
    try {
      const { chat } = await API.getChat(chatId);
      const isGroup = chat.type === 'group';
      const peer = isGroup ? null : chat.members.find(m => m.id !== Store.me.id);
      const { messages } = await API.getMessages(chatId);

      Store.activeChatId = chatId;
      Store.activeChatPeer = peer;
      Store.activeChatChatInfo = chat;
      Store.activeChatMessages = messages;

      document.getElementById('chat-empty').classList.add('hidden');
      document.getElementById('chat-active').classList.remove('hidden');
      document.getElementById('view-container').classList.add('hidden');
      document.querySelector('.main-app').classList.add('show-chat');

      if (isGroup) this.renderGroupHeader(chat);
      else this.renderChatHeader(peer);
      this.renderMessages();
      if (peer) this.checkRestriction(peer);
      else document.getElementById('restriction-banner').classList.add('hidden');

      WS.send({ type: 'read', chatId });
      await API.markRead(chatId);
      await this.refreshChats();

      document.getElementById('message-input').focus();
    } catch (e) {
      this.toast(e.message || 'Не удалось открыть чат', 'error');
    }
  },

  renderGroupHeader(chat) {
    const el = document.getElementById('chat-header-info');
    const memberNames = chat.members.map(m => m.name.split(' ')[0]).slice(0, 5).join(', ');
    el.innerHTML = `
      <div class="avatar size-md ${U.avatarColor(chat.id)}">👥</div>
      <div class="chat-header-text">
        <div class="chat-header-name">${U.escapeHtml(chat.name || 'Группа')}</div>
        <div class="chat-header-status">${chat.members.length} участников · ${U.escapeHtml(memberNames)}</div>
      </div>
    `;
  },

  closeChat() {
    Store.activeChatId = null;
    Store.activeChatPeer = null;
    Store.activeChatMessages = [];
    document.getElementById('chat-empty').classList.remove('hidden');
    document.getElementById('chat-active').classList.add('hidden');
    document.querySelector('.main-app').classList.remove('show-chat');
    this.renderSidebar();
  },

  renderChatHeader(contact) {
    const el = document.getElementById('chat-header-info');
    const status = contact.online ? 'в сети' : 'был(а) ' + U.formatLastSeen(contact.last_seen);
    el.innerHTML = `
      <div class="avatar size-md ${U.avatarColor(contact.id)}">
        ${U.escapeHtml(U.initials(contact.name))}
        ${contact.online ? '<div class="avatar-online"></div>' : ''}
      </div>
      <div class="chat-header-text">
        <div class="chat-header-name">${U.escapeHtml(contact.name)} ${contact.verified ? '✓' : ''}</div>
        <div class="chat-header-status ${contact.online ? 'online' : ''}">${U.escapeHtml(status)}</div>
      </div>
    `;
  },

  checkRestriction(contact) {
    const banner = document.getElementById('restriction-banner');
    const me = Store.me;
    const meMinor = U.isMinor(me.birth);
    const themMinor = U.isMinor(contact.birth);
    const crossAge = meMinor !== themMinor;

    if (crossAge && me.restrict_adult_contact && !contact.verified) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2L1 21h22M12 6l7.53 13H4.47M11 10v4h2v-4m-2 6v2h2v-2"/></svg>
        <div>
          <strong>Защищенный режим Stack</strong><br>
          ${meMinor
            ? 'Вы общаетесь со взрослым. Будьте осторожны: не сообщайте личные данные. Сообщите родителям, если что-то кажется подозрительным.'
            : 'Собеседник несовершеннолетний. Общение ограничено правилами платформы.'}
        </div>
      `;
    } else {
      banner.classList.add('hidden');
    }
  },

  renderMessages() {
    const el = document.getElementById('messages');
    el.innerHTML = '';

    let lastDay = '';
    for (const msg of Store.activeChatMessages) {
      const day = U.formatDay(msg.created_at);
      if (day !== lastDay) {
        const dayEl = document.createElement('div');
        dayEl.className = 'msg-day';
        dayEl.textContent = day;
        el.appendChild(dayEl);
        lastDay = day;
      }

      const isOwn = msg.sender_id === Store.me.id;
      const msgEl = document.createElement('div');
      msgEl.className = 'msg ' + (isOwn ? 'out' : 'in');
      msgEl.dataset.msgId = msg.id;

      let body = '';
      if (msg.type === 'photo' && msg.file_path) {
        body = `<div class="msg-media"><img src="${U.escapeHtml(msg.file_path)}" onclick="window.open('${U.escapeHtml(msg.file_path)}')"></div>${msg.text ? U.escapeHtml(msg.text).replace(/\n/g, '<br>') : ''}`;
      } else if (msg.type === 'photo') {
        body = `<div class="msg-media"><div style="width:280px;height:200px;background:linear-gradient(135deg,#a8e6a3,#19ff00);display:flex;align-items:center;justify-content:center;font-size:48px;">📷</div></div>`;
      } else if (msg.type === 'video' && msg.file_path) {
        body = `<div class="msg-media"><video src="${U.escapeHtml(msg.file_path)}" controls style="width:280px;border-radius:10px;"></video></div>`;
      } else if (msg.type === 'video') {
        body = `<div class="msg-media"><div style="width:280px;height:180px;background:linear-gradient(135deg,#7c857f,#15181a);display:flex;align-items:center;justify-content:center;font-size:48px;">🎬</div></div>`;
      } else if (msg.type === 'file') {
        const inner = `<div class="msg-file"><div class="msg-file-icon">📄</div><div class="msg-file-info"><div class="msg-file-name">${U.escapeHtml(msg.file_name || 'document')}</div><div class="msg-file-size">${U.formatFileSize(msg.file_size)}</div></div></div>`;
        body = msg.file_path
          ? `<a href="${U.escapeHtml(msg.file_path)}" download style="text-decoration:none;color:inherit;">${inner}</a>`
          : inner;
      } else if (msg.type === 'voice') {
        if (msg.file_path) {
          const dur = msg.text ? parseInt(msg.text) : 0;
          const durStr = dur ? Math.floor(dur/60) + ':' + String(dur%60).padStart(2,'0') : '';
          body = `<div class="msg-voice">
            <audio src="${U.escapeHtml(msg.file_path)}" controls preload="metadata" style="width:240px;"></audio>
            <div class="voice-time">${durStr}</div>
          </div>`;
        } else {
          body = `<div class="msg-voice"><div class="voice-play">▶</div><div class="voice-wave"></div><div class="voice-time">0:00</div></div>`;
        }
      } else if (msg.type === 'location') {
        let lat, lng, country;
        try { const p = JSON.parse(msg.text); lat = p.lat; lng = p.lng; country = p.country; } catch {}
        if (lat != null && lng != null) {
          const providers = Maps.providersFor(country);
          const primary = providers[0];
          const primaryUrl = Maps.url(primary, lat, lng);
          const primaryName = Maps.name(primary);
          const flag = Maps.countryFlag(country);
          const staticMap = `https://static-maps.yandex.ru/1.x/?ll=${lng},${lat}&size=260,140&z=14&l=map&pt=${lng},${lat},pm2grm`;
          const moreBtn = providers.length > 1
            ? `<span class="map-more-btn" onclick="event.preventDefault();event.stopPropagation();App.showMapChooser(${lat}, ${lng}, '${country || ''}', this)">Другая карта ▾</span>`
            : '';
          body = `<a href="${primaryUrl}" target="_blank" class="msg-location-real">
            <img src="${staticMap}" alt="Карта" onerror="this.parentElement.querySelector('.msg-location-info').style.paddingTop='14px'; this.style.display='none'">
            <div class="msg-location-info">
              <span>${flag} Открыть в ${primaryName}</span>
              ${moreBtn}
            </div>
          </a>`;
        } else {
          body = `<div class="msg-location">📍</div>`;
        }
      } else if (msg.type === 'contact') {
        let info;
        try { info = JSON.parse(msg.text); } catch { info = { name: msg.text || 'Контакт' }; }
        body = `<div class="msg-contact-card" onclick="App.openSharedContact('${info.id || ''}')">
          <div class="avatar size-md ${U.avatarColor(info.id || info.name || '')}">${U.escapeHtml(U.initials(info.name || '?'))}</div>
          <div>
            <div style="font-weight:600;font-size:14px;">${U.escapeHtml(info.name || 'Контакт')}</div>
            <div style="font-size:12px;opacity:0.7;">${U.escapeHtml(info.username || '')}</div>
          </div>
        </div>`;
      } else {
        body = U.escapeHtml(msg.text || '').replace(/\n/g, '<br>');
      }

      const check = isOwn ? `<span class="msg-check">${msg.read ? '✓✓' : '✓'}</span>` : '';
      const edited = msg.edited ? '<span style="font-size:10px;opacity:0.7;">изм.</span> ' : '';
      msgEl.innerHTML = `${body}<span class="msg-meta">${edited}${U.formatTime(msg.created_at)}${check}</span>`;

      if (isOwn) {
        msgEl.oncontextmenu = (e) => { e.preventDefault(); this.showMessageMenu(msg, e.pageX, e.pageY); };
      }
      el.appendChild(msgEl);
    }

    const typing = document.createElement('div');
    typing.className = 'typing-indicator hidden';
    typing.id = 'typing-indicator';
    typing.innerHTML = '<span></span><span></span><span></span>';
    el.appendChild(typing);

    setTimeout(() => { el.scrollTop = el.scrollHeight; }, 20);
  },

  showMessageMenu(msg, x, y) {
    const existing = document.getElementById('msg-ctx');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'msg-ctx';
    menu.className = 'chat-menu';
    menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:50;`;
    menu.innerHTML = `
      ${msg.type === 'text' ? `<div class="menu-item" onclick="App.editMessage('${msg.id}')">Редактировать</div>` : ''}
      <div class="menu-item danger" onclick="App.deleteMessage('${msg.id}')">Удалить</div>
    `;
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', function f() { menu.remove(); document.removeEventListener('click', f); });
    }, 50);
  },

  async editMessage(id) {
    const msg = Store.activeChatMessages.find(m => m.id === id);
    if (!msg) return;
    const text = prompt('Редактировать сообщение:', msg.text);
    if (!text || text === msg.text) return;
    try { await API.editMessage(id, text); }
    catch (e) { this.toast(e.message, 'error'); }
  },

  async deleteMessage(id) {
    if (!confirm('Удалить сообщение?')) return;
    try { await API.deleteMessage(id); }
    catch (e) { this.toast(e.message, 'error'); }
  },

  // ============ ОТПРАВКА ============
  handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    } else if (Store.activeChatId) {
      WS.send({ type: 'typing', chatId: Store.activeChatId, isTyping: true });
      clearTimeout(this._typingTimer);
      this._typingTimer = setTimeout(() => {
        WS.send({ type: 'typing', chatId: Store.activeChatId, isTyping: false });
      }, 2000);
    }
  },

  autoResize(ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  },

  async sendMessage() {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !Store.activeChatId) return;

    try {
      await API.sendMessage({ chatId: Store.activeChatId, text });
      input.value = '';
      input.style.height = 'auto';
      WS.send({ type: 'typing', chatId: Store.activeChatId, isTyping: false });
    } catch (e) {
      this.toast(e.message || 'Ошибка отправки', 'error');
    }
  },

  // ============ ЭМОДЗИ ============
  renderEmojis() {
    const panel = document.getElementById('emoji-panel');
    panel.innerHTML = EMOJIS.map(e => `<div class="emoji-btn-item" onclick="App.insertEmoji('${e}')">${e}</div>`).join('');
  },

  toggleEmoji() {
    document.getElementById('emoji-panel').classList.toggle('hidden');
    document.getElementById('attach-menu').classList.add('hidden');
  },

  insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    input.value += emoji;
    input.focus();
  },

  // ============ ВЛОЖЕНИЯ ============
  attachFile() {
    document.getElementById('attach-menu').classList.toggle('hidden');
    document.getElementById('emoji-panel').classList.add('hidden');
  },

  async sendAttachment(type) {
    document.getElementById('attach-menu').classList.add('hidden');
    if (!Store.activeChatId) return;

    if (type === 'photo' || type === 'video' || type === 'file') {
      const input = document.createElement('input');
      input.type = 'file';
      if (type === 'photo') input.accept = 'image/*';
      if (type === 'video') input.accept = 'video/*';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          this.toast('Загрузка...');
          const up = await API.uploadFile(file);
          await API.sendMessage({
            chatId: Store.activeChatId,
            type,
            text: null,
            filePath: up.path,
            fileName: up.name,
            fileSize: up.size,
          });
        } catch (e) {
          this.toast(e.message || 'Ошибка загрузки', 'error');
        }
      };
      input.click();
    } else if (type === 'voice') {
      await this.toggleVoiceRecording();
    } else if (type === 'location') {
      await this.sendLocation();
    } else if (type === 'contact') {
      this.openContactPicker();
    }
  },

  // ============ ГОЛОСОВЫЕ СООБЩЕНИЯ (MediaRecorder) ============
  async toggleVoiceRecording() {
    if (Store.voiceRec.recorder) {
      return this.stopVoiceRecording(true);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      Store.voiceRec = { recorder, chunks: [], stream, startedAt: Date.now(), timer: null };

      recorder.ondataavailable = (e) => { if (e.data.size > 0) Store.voiceRec.chunks.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(Store.voiceRec.chunks, { type: recorder.mimeType || 'audio/webm' });
        const duration = Math.round((Date.now() - Store.voiceRec.startedAt) / 1000);
        const wasCanceled = Store.voiceRec._canceled;
        Store.voiceRec.stream.getTracks().forEach(t => t.stop());
        clearInterval(Store.voiceRec.timer);
        Store.voiceRec = { recorder: null, chunks: [], stream: null, startedAt: 0, timer: null };
        this.renderVoiceRecUI(false);

        if (wasCanceled || blob.size < 500) return;
        try {
          this.toast('Отправка голосового...');
          const file = new File([blob], `voice_${Date.now()}.webm`, { type: blob.type });
          const up = await API.uploadFile(file);
          await API.sendMessage({
            chatId: Store.activeChatId,
            type: 'voice',
            text: String(duration),
            filePath: up.path,
            fileName: up.name,
            fileSize: up.size,
          });
        } catch (e) {
          this.toast(e.message || 'Ошибка', 'error');
        }
      };
      recorder.start();
      this.renderVoiceRecUI(true);
      Store.voiceRec.timer = setInterval(() => this.updateVoiceTimer(), 500);
    } catch (e) {
      this.toast('Нет доступа к микрофону', 'error');
    }
  },

  stopVoiceRecording(send = true) {
    const r = Store.voiceRec.recorder;
    if (!r) return;
    Store.voiceRec._canceled = !send;
    r.stop();
  },

  renderVoiceRecUI(recording) {
    const composer = document.getElementById('chat-composer');
    let rec = composer.querySelector('.voice-recording');
    if (recording) {
      if (!rec) {
        rec = document.createElement('div');
        rec.className = 'voice-recording';
        rec.innerHTML = `
          <div class="voice-rec-dot"></div>
          <div class="voice-rec-timer" id="voice-timer">0:00</div>
          <div style="flex:1;"></div>
          <span class="voice-rec-cancel" onclick="App.stopVoiceRecording(false)">Отмена</span>
        `;
        composer.querySelector('.input-wrap').replaceWith(rec);
      }
      const sendBtn = document.getElementById('send-btn');
      sendBtn.onclick = () => this.stopVoiceRecording(true);
    } else {
      if (rec) {
        const wrap = document.createElement('div');
        wrap.className = 'input-wrap';
        wrap.innerHTML = `
          <textarea id="message-input" placeholder="Сообщение" rows="1" onkeydown="App.handleKey(event)" oninput="App.autoResize(this)"></textarea>
          <button class="icon-btn emoji-btn" onclick="App.toggleEmoji()">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
          </button>
        `;
        rec.replaceWith(wrap);
      }
      const sendBtn = document.getElementById('send-btn');
      sendBtn.onclick = () => this.sendMessage();
    }
  },

  updateVoiceTimer() {
    const el = document.getElementById('voice-timer');
    if (!el || !Store.voiceRec.startedAt) return;
    const s = Math.floor((Date.now() - Store.voiceRec.startedAt) / 1000);
    el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  },

  // ============ ГЕОЛОКАЦИЯ ============
  async sendLocation() {
    if (!navigator.geolocation) return this.toast('Геолокация не поддерживается', 'error');
    this.toast('Определяю местоположение...');
    try {
      const coords = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          p => resolve(p.coords),
          e => reject(e),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      const payload = JSON.stringify({ lat: coords.latitude, lng: coords.longitude });
      await API.sendMessage({
        chatId: Store.activeChatId,
        type: 'location',
        text: payload,
      });
    } catch (e) {
      this.toast('Не удалось получить геолокацию', 'error');
    }
  },

  // ============ ПИКЕР КОНТАКТОВ ============
  async openContactPicker() {
    try {
      const { chats } = await API.listChats();
      const contacts = chats
        .filter(c => c.type === 'private' && c.peer)
        .map(c => c.peer);

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'contact-picker';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Поделиться контактом</h3>
            <button class="icon-btn" onclick="document.getElementById('contact-picker').remove()">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"/></svg>
            </button>
          </div>
          <p class="modal-desc">Выберите, кого отправить</p>
          <div class="picker-list">
            ${contacts.length === 0
              ? '<div style="padding:30px;text-align:center;color:var(--text-muted);">Нет контактов</div>'
              : contacts.map(c => `
                  <div class="contact-item" onclick="App.pickContact('${c.id}', '${U.escapeHtml(c.name)}', '${U.escapeHtml(c.username)}')">
                    <div class="avatar ${U.avatarColor(c.id)}">${U.escapeHtml(U.initials(c.name))}</div>
                    <div class="contact-info">
                      <div class="contact-name">${U.escapeHtml(c.name)}</div>
                      <div class="contact-status">${U.escapeHtml(c.username)}</div>
                    </div>
                  </div>
                `).join('')
            }
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } catch (e) { this.toast(e.message, 'error'); }
  },

  async pickContact(id, name, username) {
    document.getElementById('contact-picker')?.remove();
    try {
      await API.sendMessage({
        chatId: Store.activeChatId,
        type: 'contact',
        text: JSON.stringify({ id, name, username }),
      });
    } catch (e) { this.toast(e.message, 'error'); }
  },

  async openSharedContact(userId) {
    try {
      await this.startChatWith(userId);
    } catch (e) { this.toast(e.message, 'error'); }
  },

  showMapChooser(lat, lng, country, anchor) {
    document.getElementById('map-chooser')?.remove();
    const providers = Maps.providersFor(country);

    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id = 'map-chooser';
    menu.className = 'chat-menu';
    menu.style.cssText = `position:fixed;left:${Math.max(10, rect.left - 40)}px;top:${rect.top - 10}px;transform:translateY(-100%);z-index:100;min-width:180px;`;
    const flag = Maps.countryFlag(country);
    const header = country
      ? `<div style="padding:10px 14px 6px;font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${flag} ${country}</div>`
      : '';
    menu.innerHTML = header + providers.map(p => `
      <div class="menu-item" onclick="window.open('${Maps.url(p, lat, lng)}', '_blank'); document.getElementById('map-chooser').remove();">
        ${Maps.name(p)}
      </div>
    `).join('');
    document.body.appendChild(menu);

    setTimeout(() => {
      document.addEventListener('click', function f(e) {
        if (!e.target.closest('#map-chooser')) {
          menu.remove();
          document.removeEventListener('click', f);
        }
      });
    }, 50);
  },

  // ============ МЕНЮ ЧАТА ============
  toggleChatMenu() {
    document.getElementById('chat-menu').classList.toggle('hidden');
  },

  async muteChat() {
    const chat = Store.chats.find(c => c.id === Store.activeChatId);
    if (!chat) return;
    try {
      const r = await API.muteChat(chat.id, !chat.muted);
      chat.muted = r.muted;
      this.toast(r.muted ? 'Уведомления отключены' : 'Уведомления включены');
      document.getElementById('chat-menu').classList.add('hidden');
      this.renderSidebar();
    } catch (e) { this.toast(e.message, 'error'); }
  },

  async clearHistory() {
    if (!confirm('Удалить всю переписку? Это действие необратимо.')) return;
    try {
      await API.clearChat(Store.activeChatId);
      Store.activeChatMessages = [];
      this.renderMessages();
      await this.refreshChats();
      this.toast('История очищена');
      document.getElementById('chat-menu').classList.add('hidden');
    } catch (e) { this.toast(e.message, 'error'); }
  },

  async blockUser() {
    if (!confirm('Заблокировать пользователя?')) return;
    try {
      await API.blockChat(Store.activeChatId, true);
      this.toast('Пользователь заблокирован', 'success');
      document.getElementById('chat-menu').classList.add('hidden');
    } catch (e) { this.toast(e.message, 'error'); }
  },

  // ============ РЕПОРТЫ ============
  openReport() {
    document.getElementById('chat-menu').classList.add('hidden');
    document.getElementById('report-modal').classList.remove('hidden');
  },

  closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  },

  async submitReport() {
    const reason = document.querySelector('input[name="reason"]:checked');
    if (!reason) return this.toast('Выберите причину', 'error');

    const details = document.getElementById('report-details').value.trim();
    const peer = Store.activeChatPeer;
    if (!peer) return this.toast('Нет активного чата', 'error');

    try {
      await API.createReport({
        againstId: peer.id,
        chatId: Store.activeChatId,
        reason: reason.value,
        details,
      });
      this.closeModal('report-modal');
      document.getElementById('report-details').value = '';
      document.querySelectorAll('input[name="reason"]').forEach(r => r.checked = false);
      this.toast('Жалоба отправлена. Рассмотрим в течение 24 часов', 'success');
    } catch (e) {
      this.toast(e.message, 'error');
    }
  },

  // ============ РЕАЛЬНЫЕ WebRTC ЗВОНКИ ============
  async startCall(type) {
    const peer = Store.activeChatPeer;
    if (!peer) return;
    if (Store.call.pc) return this.toast('Уже идет звонок', 'error');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      Store.call.localStream = stream;
      Store.call.type = type;
      Store.call.peerId = peer.id;

      const pc = this.createPeerConnection(peer.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      this.showCallScreen(peer, type, 'Вызов...');
      this.attachLocalVideo(stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      WS.send({ type: 'call:offer', peerId: peer.id, callType: type, sdp: pc.localDescription });
    } catch (e) {
      this.toast('Нет доступа к камере/микрофону', 'error');
      this.cleanupCall();
    }
  },

  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    Store.call.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        WS.send({ type: 'call:ice', peerId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (!Store.call.remoteStream) Store.call.remoteStream = new MediaStream();
      Store.call.remoteStream.addTrack(e.track);
      const v = document.getElementById('call-remote-video');
      if (v) v.srcObject = Store.call.remoteStream;
      const s = document.getElementById('call-status');
      if (s) s.textContent = 'Идет разговор';
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        this.cleanupCall();
      }
    };

    return pc;
  },

  async handleIncomingCall(msg) {
    // Если уже идет звонок — отклоняем
    if (Store.call.pc) {
      WS.send({ type: 'call:hangup', peerId: msg.fromId });
      return;
    }
    Store.call.incoming = msg;
    const peer = await API.getUser(msg.fromId).then(r => r.user).catch(() => null);
    if (!peer) return;

    const banner = document.createElement('div');
    banner.className = 'incoming-call';
    banner.id = 'incoming-call';
    banner.innerHTML = `
      <div class="avatar ${U.avatarColor(peer.id)}">${U.escapeHtml(U.initials(peer.name))}</div>
      <div class="incoming-call-info">
        <div class="incoming-call-title">${U.escapeHtml(peer.name)}</div>
        <div class="incoming-call-sub">${msg.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}</div>
      </div>
      <div class="incoming-call-actions">
        <button class="incoming-call-btn reject" onclick="App.rejectIncoming()" title="Отклонить">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28a.96.96 0 0 1-.7-.3L.29 13.08a.99.99 0 0 1-.29-.7c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48a.96.96 0 0 1-.7.3c-.27 0-.52-.11-.7-.28a11.9 11.9 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" transform="rotate(135 12 12)"/></svg>
        </button>
        <button class="incoming-call-btn accept" onclick="App.acceptIncoming()" title="Принять">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M6.62 10.79a15.15 15.15 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>
        </button>
      </div>
    `;
    document.body.appendChild(banner);
  },

  async acceptIncoming() {
    const msg = Store.call.incoming;
    if (!msg) return;
    document.getElementById('incoming-call')?.remove();
    Store.call.incoming = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: msg.callType === 'video',
      });
      Store.call.localStream = stream;
      Store.call.type = msg.callType;
      Store.call.peerId = msg.fromId;

      const peer = await API.getUser(msg.fromId).then(r => r.user);
      const pc = this.createPeerConnection(msg.fromId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(msg.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      WS.send({ type: 'call:answer', peerId: msg.fromId, sdp: pc.localDescription });

      this.showCallScreen(peer, msg.callType, 'Соединение...');
      this.attachLocalVideo(stream);
    } catch (e) {
      this.toast('Нет доступа к камере/микрофону', 'error');
      WS.send({ type: 'call:hangup', peerId: msg.fromId });
      this.cleanupCall();
    }
  },

  rejectIncoming() {
    const msg = Store.call.incoming;
    document.getElementById('incoming-call')?.remove();
    if (msg) WS.send({ type: 'call:hangup', peerId: msg.fromId });
    Store.call.incoming = null;
  },

  showCallScreen(peer, type, status) {
    const screen = document.getElementById('call-screen');
    screen.classList.remove('hidden', 'audio-only', 'has-video');
    screen.classList.add(type === 'video' ? 'has-video' : 'audio-only');

    document.getElementById('call-avatar').textContent = U.initials(peer.name);
    document.getElementById('call-name').textContent = peer.name;
    document.getElementById('call-status').textContent = status;
  },

  attachLocalVideo(stream) {
    if (Store.call.type !== 'video') return;
    const v = document.getElementById('call-local-video');
    if (v) v.srcObject = stream;
  },

  endCall() {
    if (Store.call.peerId) WS.send({ type: 'call:hangup', peerId: Store.call.peerId });
    this.cleanupCall();
  },

  toggleMute() {
    const stream = Store.call.localStream;
    if (!stream) return;
    const audio = stream.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = !audio.enabled;
    this.toast(audio.enabled ? 'Микрофон включен' : 'Микрофон выключен');
  },

  toggleVideo() {
    const stream = Store.call.localStream;
    if (!stream) return;
    const video = stream.getVideoTracks()[0];
    if (!video) return;
    video.enabled = !video.enabled;
    this.toast(video.enabled ? 'Камера включена' : 'Камера выключена');
  },

  cleanupCall() {
    if (Store.call.pc) { try { Store.call.pc.close(); } catch {} }
    if (Store.call.localStream) Store.call.localStream.getTracks().forEach(t => t.stop());
    Store.call = { pc: null, localStream: null, remoteStream: null, peerId: null, type: null, incoming: null };
    document.getElementById('call-screen').classList.add('hidden');
    document.getElementById('incoming-call')?.remove();
    const lv = document.getElementById('call-local-video');
    const rv = document.getElementById('call-remote-video');
    if (lv) lv.srcObject = null;
    if (rv) rv.srcObject = null;
  },

  // ============ ВЬЮШКИ ============
  showView(view) {
    document.getElementById('side-menu').classList.add('hidden');
    document.getElementById('chat-empty').classList.add('hidden');
    document.getElementById('chat-active').classList.add('hidden');
    document.getElementById('view-container').classList.remove('hidden');
    document.querySelector('.main-app').classList.add('show-chat');

    if (view === 'profile') this.renderProfile();
    else if (view === 'contacts') this.renderContacts();
    else if (view === 'new-chat') this.renderContacts();
    else if (view === 'new-group') this.renderNewGroup();
    else if (view === 'settings') this.renderSettings();
    else if (view === 'parental') this.renderParental();
    else if (view === 'reports') this.renderReports();
  },

  async renderNewGroup() {
    // собираем контакты из чатов
    const contacts = Store.chats
      .filter(c => c.type === 'private' && c.peer)
      .map(c => c.peer);

    document.getElementById('view-container').innerHTML = `
      <div class="view-header">
        <button class="icon-btn" onclick="App.closeView()">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 11v2H8l5.5 5.5-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5 8 11h12z"/></svg>
        </button>
        <div class="view-title">Новая группа</div>
      </div>
      <div class="view-body">
        <div class="group-create-form">
          <div>
            <div class="section-title">Название группы</div>
            <input type="text" id="group-name" placeholder="Например: Друзья"
              style="width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;background:var(--gray-50);">
          </div>
          <div>
            <div class="section-title">Участники</div>
            ${contacts.length === 0
              ? '<div class="card" style="text-align:center;color:var(--text-muted);padding:20px;">Сначала добавьте контакты через «Новый чат»</div>'
              : `<div class="group-members-picker">
                  ${contacts.map(c => `
                    <label class="group-member-item" onclick="this.classList.toggle('selected')">
                      <input type="checkbox" value="${c.id}" data-name="${U.escapeHtml(c.name)}">
                      <div class="avatar size-md ${U.avatarColor(c.id)}">${U.escapeHtml(U.initials(c.name))}</div>
                      <div style="flex:1;">
                        <div style="font-weight:600;font-size:14px;">${U.escapeHtml(c.name)}</div>
                        <div style="font-size:12px;color:var(--text-soft);">${U.escapeHtml(c.username)}${c.isMinor ? ' · До 18' : ''}</div>
                      </div>
                    </label>
                  `).join('')}
                </div>`
            }
          </div>
          <button class="btn-primary" onclick="App.submitGroup()">Создать группу</button>
        </div>
      </div>
    `;
  },

  async submitGroup() {
    const name = document.getElementById('group-name').value.trim();
    if (!name) return this.toast('Введите название', 'error');

    const checked = Array.from(document.querySelectorAll('.group-members-picker input:checked'));
    if (checked.length === 0) return this.toast('Выберите участников', 'error');

    try {
      const { chat } = await API.createGroup(name, checked.map(c => c.value));
      await this.refreshChats();
      this.closeView();
      this.openChat(chat.id);
      this.toast('Группа создана', 'success');
    } catch (e) {
      this.toast(e.message || 'Ошибка', 'error');
    }
  },

  closeView() {
    document.getElementById('view-container').classList.add('hidden');
    document.getElementById('chat-empty').classList.remove('hidden');
    document.querySelector('.main-app').classList.remove('show-chat');
  },

  renderProfile() {
    const u = Store.me;
    const age = U.ageFromBirth(u.birth);
    document.getElementById('view-container').innerHTML = `
      <div class="view-header">
        <button class="icon-btn" onclick="App.closeView()">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 11v2H8l5.5 5.5-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5 8 11h12z"/></svg>
        </button>
        <div class="view-title">Профиль</div>
      </div>
      <div class="view-body">
        <div class="profile-header">
          <div class="avatar size-xl ${U.avatarColor(u.id)} profile-avatar">${U.escapeHtml(U.initials(u.name))}</div>
          <div class="profile-name">${U.escapeHtml(u.name)}</div>
          <div class="profile-username">${U.escapeHtml(u.username)}</div>
        </div>

        <div class="section">
          <div class="section-title">Личная информация</div>
          <div class="card">
            <div class="card-row"><div><div class="card-row-label">Телефон</div><div class="card-row-desc">${U.escapeHtml(u.phone)}</div></div></div>
            <div class="card-row"><div><div class="card-row-label">Username</div><div class="card-row-desc">${U.escapeHtml(u.username)}</div></div></div>
            <div class="card-row"><div><div class="card-row-label">Возраст</div><div class="card-row-desc">${age} лет ${u.isMinor ? '<span class="age-badge minor">Несовершеннолетний</span>' : '<span class="age-badge adult">18+</span>'}</div></div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Безопасность</div>
          <div class="card">
            <div class="card-row">
              <div><div class="card-row-label">🛡 End-to-end шифрование</div><div class="card-row-desc">Все сообщения защищены</div></div>
              <span class="age-badge adult">Активно</span>
            </div>
            <div class="card-row">
              <div><div class="card-row-label">🔐 Двухфакторная аутентификация</div><div class="card-row-desc">Дополнительная защита</div></div>
              <div class="switch" onclick="App.toast('В разработке')"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderContacts() {
    document.getElementById('view-container').innerHTML = `
      <div class="view-header">
        <button class="icon-btn" onclick="App.closeView()">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 11v2H8l5.5 5.5-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5 8 11h12z"/></svg>
        </button>
        <div class="view-title">Найти пользователя</div>
      </div>
      <div class="view-body">
        <div style="margin-bottom:16px;">
          <input id="user-search" type="text" placeholder="Поиск по имени, @username или телефону"
            style="width:100%;padding:14px 18px;border:1.5px solid var(--border);border-radius:14px;font-size:14px;background:var(--gray-50);"
            oninput="App.searchUsers(this.value)">
        </div>
        <div id="user-search-results" class="contact-list">
          <div style="padding:40px;text-align:center;color:var(--text-muted);">Введите минимум 2 символа</div>
        </div>
      </div>
    `;
    setTimeout(() => document.getElementById('user-search')?.focus(), 50);
  },

  async searchUsers(q) {
    const container = document.getElementById('user-search-results');
    if (!container) return;
    if (!q || q.length < 2) {
      container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Введите минимум 2 символа</div>';
      return;
    }
    try {
      const { results } = await API.searchUsers(q);
      if (results.length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">Ничего не найдено</div>';
        return;
      }
      container.innerHTML = results.map(c => {
        const age = U.ageFromBirth(c.birth);
        return `
          <div class="contact-item" onclick="App.startChatWith('${c.id}')">
            <div class="avatar ${U.avatarColor(c.id)}">
              ${U.escapeHtml(U.initials(c.name))}
              ${c.online ? '<div class="avatar-online"></div>' : ''}
            </div>
            <div class="contact-info">
              <div class="contact-name">${U.escapeHtml(c.name)} ${c.verified ? '✓' : ''}${c.isMinor ? '<span class="age-badge minor">До 18</span>' : '<span class="age-badge adult">18+</span>'}</div>
              <div class="contact-status">${U.escapeHtml(c.username)} · ${age} лет</div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">${e.message}</div>`;
    }
  },

  async startChatWith(userId) {
    try {
      const { chat } = await API.createChat(userId);
      await this.refreshChats();
      this.closeView();
      this.openChat(chat.id);
    } catch (e) {
      this.toast(e.message || 'Не удалось создать чат', 'error');
    }
  },

  renderSettings() {
    const s = Store.me;
    document.getElementById('view-container').innerHTML = `
      <div class="view-header">
        <button class="icon-btn" onclick="App.closeView()">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 11v2H8l5.5 5.5-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5 8 11h12z"/></svg>
        </button>
        <div class="view-title">Настройки</div>
      </div>
      <div class="view-body">
        <div class="section">
          <div class="section-title">Внешний вид</div>
          <div class="card">
            <div class="card-row">
              <div><div class="card-row-label">Тёмная тема</div><div class="card-row-desc">Черно-зеленая версия</div></div>
              <div class="switch ${s.dark_theme ? 'on' : ''}" onclick="App.toggleSetting('dark_theme')"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Приватность</div>
          <div class="card">
            <div class="card-row">
              <div><div class="card-row-label">Подтверждения о прочтении</div><div class="card-row-desc">Показывать галочки ✓✓</div></div>
              <div class="switch ${s.read_receipts ? 'on' : ''}" onclick="App.toggleSetting('read_receipts')"></div>
            </div>
            <div class="card-row">
              <div><div class="card-row-label">Скрыть «был(а) в сети»</div><div class="card-row-desc">Последний визит никто не увидит</div></div>
              <div class="switch ${s.hide_last_seen ? 'on' : ''}" onclick="App.toggleSetting('hide_last_seen')"></div>
            </div>
            <div class="card-row">
              <div><div class="card-row-label">Уведомления</div><div class="card-row-desc">Получать пуши</div></div>
              <div class="switch ${s.notifications ? 'on' : ''}" onclick="App.toggleSetting('notifications')"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Безопасность Stack</div>
          <div class="card">
            <div class="card-row">
              <div><div class="card-row-label">Ограничить общение детей со взрослыми</div><div class="card-row-desc">Защита несовершеннолетних</div></div>
              <div class="switch ${s.restrict_adult_contact ? 'on' : ''}" onclick="App.toggleSetting('restrict_adult_contact')"></div>
            </div>
            <div class="card-row">
              <div><div class="card-row-label">Родительский контроль</div><div class="card-row-desc">Дополнительный мониторинг</div></div>
              <div class="switch ${s.parental_control ? 'on' : ''}" onclick="App.toggleSetting('parental_control')"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">О приложении</div>
          <div class="card">
            <div class="card-row">
              <div><div class="card-row-label">Stack Messenger</div><div class="card-row-desc">Версия 1.0.0 · Приватно. Безопасно. Просто.</div></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async toggleSetting(key) {
    Store.me[key] = !Store.me[key];
    try { await API.updateSettings({ [key]: Store.me[key] }); }
    catch (e) { this.toast(e.message, 'error'); }
    if (key === 'dark_theme') this.applyTheme();
    this.updateSafetyBanner();
    this.renderMenuProfile();
    this.renderSettings();
  },

  applyTheme() {
    if (Store.me?.dark_theme) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  },

  async renderParental() {
    const u = Store.me;
    const isChild = U.isMinor(u.birth);
    const reports = (await API.listReports().catch(() => ({ reports: [] }))).reports || [];

    const stats = {
      totalChats: Store.chats.length,
      reportsSent: reports.length,
      blocked: Store.chats.filter(c => c.blocked).length,
    };

    document.getElementById('view-container').innerHTML = `
      <div class="view-header">
        <button class="icon-btn" onclick="App.closeView()">
          <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 11v2H8l5.5 5.5-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5 8 11h12z"/></svg>
        </button>
        <div class="view-title">Родительский контроль</div>
      </div>
      <div class="view-body">
        <div class="section">
          <div class="card" style="background:linear-gradient(135deg, var(--brand-soft), #fff);border-color:var(--brand);">
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="font-size:40px;">🛡</div>
              <div>
                <div style="font-size:17px;font-weight:700;">Stack защищает ${isChild ? 'вас' : 'вашего ребёнка'}</div>
                <div style="font-size:13px;color:var(--text-soft);margin-top:4px;">
                  ${isChild ? 'Не делитесь личной информацией. Жалуйтесь на странное поведение.' : 'Отслеживайте активность и управляйте защитой.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Статистика</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
            <div class="card"><div style="font-size:28px;font-weight:800;color:var(--brand-deep);">${stats.totalChats}</div><div style="font-size:12px;color:var(--text-soft);">Активных чатов</div></div>
            <div class="card"><div style="font-size:28px;font-weight:800;color:var(--brand-deep);">${stats.reportsSent}</div><div style="font-size:12px;color:var(--text-soft);">Жалоб отправлено</div></div>
            <div class="card"><div style="font-size:28px;font-weight:800;color:var(--brand-deep);">${stats.blocked}</div><div style="font-size:12px;color:var(--text-soft);">Заблокировано</div></div>
            <div class="card"><div style="font-size:28px;font-weight:800;color:var(--brand-deep);">${U.ageFromBirth(u.birth)}</div><div style="font-size:12px;color:var(--text-soft);">Ваш возраст</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Параметры защиты</div>
          <div class="card">
            <div class="card-row">
              <div><div class="card-row-label">Режим защиты</div><div class="card-row-desc">Родительский контроль</div></div>
              <div class="switch ${u.parental_control ? 'on' : ''}" onclick="App.toggleSetting('parental_control')"></div>
            </div>
            <div class="card-row">
              <div><div class="card-row-label">Ограничить общение со взрослыми</div><div class="card-row-desc">Для несовершеннолетних</div></div>
              <div class="switch ${u.restrict_adult_contact ? 'on' : ''}" onclick="App.toggleSetting('restrict_adult_contact')"></div>
            </div>
            <div class="card-row">
              <div><div class="card-row-label">ИИ-модерация</div><div class="card-row-desc">Автоматическое сканирование</div></div>
              <div class="switch on" onclick="App.toast('Активна всегда')"></div>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Советы</div>
          <div class="card">
            <div style="font-size:13px;line-height:1.6;color:var(--text-soft);">
              ⚠ <b>Никогда</b> не сообщайте адрес или пароли незнакомым.<br>
              🚨 Странное поведение — жмите «Пожаловаться».<br>
              👨‍👩‍👧 Расскажите родителям о подозрительных людях.<br>
              🔒 Stack <b>никогда</b> не попросит пароль в сообщениях.
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async renderReports() {
    try {
      const { reports } = await API.listReports();
      const list = reports.length === 0
        ? '<div style="text-align:center;color:var(--text-muted);padding:40px;">Вы пока не отправляли жалобы</div>'
        : reports.map(r => {
            const label = { spam: 'Спам', abuse: 'Травля', adult: 'Контент 18+', grooming: 'Груминг', fraud: 'Мошенничество', other: 'Другое' }[r.reason] || r.reason;
            return `
              <div class="report-card">
                <div class="report-header">
                  <div class="report-title">Жалоба на ${U.escapeHtml(r.against_name)}</div>
                  <div class="report-time">${U.formatDay(r.created_at)}, ${U.formatTime(r.created_at)}</div>
                </div>
                <div class="report-reason">${label}</div>
                ${r.details ? `<div class="report-details">${U.escapeHtml(r.details)}</div>` : ''}
                <div class="report-status ${r.status}">${r.status === 'pending' ? '⏳ Рассматривается' : '✓ Решено'}</div>
              </div>
            `;
          }).join('');

      document.getElementById('view-container').innerHTML = `
        <div class="view-header">
          <button class="icon-btn" onclick="App.closeView()">
            <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M20 11v2H8l5.5 5.5-1.42 1.42L4.16 12l7.92-7.92L13.5 5.5 8 11h12z"/></svg>
          </button>
          <div class="view-title">Мои жалобы</div>
        </div>
        <div class="view-body">
          <div class="section">
            <div class="card" style="background:var(--brand-soft);border-color:var(--brand);">
              <div style="display:flex;gap:12px;align-items:center;">
                <div style="font-size:28px;">🛡</div>
                <div style="font-size:13px;color:var(--text);">
                  <b>Stack защищает всех.</b><br>
                  Рассматриваем каждую жалобу в течение 24 часов.
                </div>
              </div>
            </div>
          </div>
          <div class="report-list">${list}</div>
        </div>
      `;
    } catch (e) { this.toast(e.message, 'error'); }
  },

  toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.className = 'toast ' + type;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
