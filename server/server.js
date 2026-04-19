const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const StackWS = require('./ws');

const app = express();

// HTTPS если есть сертификаты (для LAN / production WebRTC на реальных доменах)
// STACK_SSL_CERT и STACK_SSL_KEY — пути к файлам сертификата и ключа
// Для локалки на localhost HTTPS не нужен (localhost считается secure context)
let server;
const certPath = process.env.STACK_SSL_CERT;
const keyPath = process.env.STACK_SSL_KEY;
if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  server = https.createServer({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  }, app);
  console.log('[SSL] HTTPS включен');
} else {
  server = http.createServer(app);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static client + uploads
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/upload', require('./routes/upload'));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// WebSocket
const ws = new StackWS(server);
app.set('ws', ws);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log(`  │  Stack Messenger — running on :${PORT}    │`);
  console.log('  │  http://localhost:' + PORT + '/                │');
  console.log('  │  WS:  ws://localhost:' + PORT + '/ws          │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
  console.log('  Demo-пользователи (пароль: demo1234):');
  console.log('   - Анна (10 лет) :   @anna_p  / +79215550101');
  console.log('   - Максим (32)   :   @max_w   / +79215550102');
  console.log('   - Лена  (12)    :   @lena_s  / +79215550103');
  console.log('   - Игорь (36)    :   @igor_d  / +79215550104');
  console.log('');
});
