# Stack — Приватный мессенджер

Полный мессенджер с серверной частью, real-time сообщениями через WebSocket, защитой несовершеннолетних и системой репортов.

## Архитектура

```
stack/
├── server/                  Node.js backend
│   ├── server.js            Express + WebSocket
│   ├── db.js                SQLite + схема + queries
│   ├── auth.js              JWT + bcrypt
│   ├── ws.js                WebSocket handlers
│   └── routes/
│       ├── auth.js          Регистрация/вход
│       ├── users.js         Поиск, контакты, настройки
│       ├── chats.js         Чаты (создание, список, чтение)
│       ├── messages.js      Отправка/редактирование/удаление
│       ├── reports.js       Жалобы
│       └── upload.js        Загрузка файлов (multer)
├── public/                  Frontend
│   ├── index.html
│   ├── styles.css
│   ├── api.js               API + WebSocket клиент
│   └── app.js               UI логика
├── uploads/                 Загруженные файлы
├── stack.db                 SQLite база
└── package.json
```

## Запуск

```bash
npm install
npm start                   # http://localhost:3000 (для локальной разработки достаточно)

# Для LAN-тестирования WebRTC с другого устройства:
npm run gen-cert            # создаст самоподписанный сертификат в certs/
npm run start:https         # https://<ваш-ip>:3000 (браузер предупредит о самоподписанном)

# Для production — подставьте реальные cert/key через переменные:
STACK_SSL_CERT=/path/to/cert.pem STACK_SSL_KEY=/path/to/key.pem npm start
```

**WebRTC и HTTPS:**
- На `localhost` браузер считает страницу secure context, поэтому getUserMedia/камера/микрофон работают без сертификата.
- На реальном домене/IP — нужен HTTPS (бесплатно через Let's Encrypt).


## API

### Auth
- `POST /api/auth/register`  `{ name, username, phone, password, birth }`
- `POST /api/auth/login`  `{ identifier, password }` → `{ token, user }`
- `GET  /api/auth/me`

### Users
- `GET  /api/users/search?q=...`
- `PUT  /api/users/me`  профиль
- `PUT  /api/users/me/settings`  настройки безопасности

### Chats
- `GET  /api/chats`  список с последним сообщением и unread
- `POST /api/chats`  `{ userId }` — проверяет возрастное ограничение
- `GET  /api/chats/:id/messages?before=ts`
- `POST /api/chats/:id/read`
- `POST /api/chats/:id/mute`  `{ muted }`
- `POST /api/chats/:id/block`  `{ blocked }`
- `POST /api/chats/:id/clear`

### Messages
- `POST /api/messages`  `{ chatId, text, type, filePath, ... }`
- `PUT  /api/messages/:id`  редактирование
- `DELETE /api/messages/:id`  удаление

### Reports & Upload
- `POST /api/reports`  `{ againstId, chatId, reason, details }`
- `GET  /api/reports`  мои жалобы
- `POST /api/upload`  multipart form-data

### WebSocket `/ws?token=...`

**Сервер → клиент:**
- `message:new` / `message:edit` / `message:delete`
- `typing` — индикатор набора
- `read` — подтверждение прочтения
- `presence` — онлайн/офлайн собеседника
- `call:offer` / `answer` / `hangup` / `ice` — WebRTC сигналинг

**Клиент → сервер:**
- `typing` / `read` / `ping`
- `call:*` — ретранслируется на peerId

## Безопасность

- **Пароли** хешируются bcrypt (10 rounds)
- **JWT** 30-дневный, секрет через `STACK_JWT_SECRET`
- **Возрастное ограничение** enforced на сервере (не только UI)
- **Верифицированные** аккаунты (Stack Support) проходят ограничения
- **Блокировки** хранятся в БД, messages-route их проверяет
- **XSS** — клиент escape'ит весь пользовательский контент

## Что реализовано

- Регистрация и вход (bcrypt + JWT)
- Real-time сообщения через WebSocket с переподключением
- **Реальные WebRTC звонки** (аудио + видео, STUN, P2P)
- **Реальная запись голосовых** через MediaRecorder
- **Реальная геолокация** с картой (Yandex static maps)
- **Реальный шаринг контактов** с возможностью открыть чат
- **Группы** (до N участников, с возрастными ограничениями)
- Текст, фото, видео, файлы
- Редактирование и удаление сообщений
- Галочки ✓/✓✓ с real-time подтверждением прочтения
- Индикатор набора (typing)
- Онлайн-статус и «был в сети»
- Поиск пользователей по имени/username/телефону
- Mute, блокировка, очистка истории
- Репорты (6 категорий + детали, статусы)
- Родительский контроль с дашбордом
- Возрастное ограничение общения 1-на-1 и для групп
- Настройки приватности (read receipts, last seen)
- Тёмная тема (полностью переработана)
- 120+ эмодзи
- Загрузка файлов до 50 МБ
- Адаптив под мобилку
