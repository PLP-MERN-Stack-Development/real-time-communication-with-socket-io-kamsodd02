const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 60000,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'chat_secret_key_final';
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'-')),
});
const upload = multer({ storage });

// in-memory stores (for demo / initial version)
const users = {}; // socketId -> { username, userId, socketId, online }
const userIdToSocket = {}; // userId -> socketId
const messages = {}; // room -> [msgs]
const rooms = new Set(['global','general','random']);

function pushMessage(room, msg) {
  if (!messages[room]) messages[room] = [];
  messages[room].push(msg);
  if (messages[room].length > 2000) messages[room].shift();
}

function searchMessages(q) {
  const results = [];
  for (const room of Object.keys(messages)) {
    for (const m of messages[room]) {
      if ((m.text && m.text.toLowerCase().includes(q.toLowerCase())) ||
          (m.sender && m.sender.toLowerCase().includes(q.toLowerCase()))) {
        results.push(m);
      }
    }
  }
  return results;
}

// Routes
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const userId = username.replace(/\s+/g,'_') + '_' + Date.now();
  const token = jwt.sign({ username, userId }, JWT_SECRET, { expiresIn: '12h' });
  return res.json({ token, username, userId });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  return res.json({ url: '/uploads/' + req.file.filename, name: req.file.originalname });
});

app.get('/api/messages', (req, res) => {
  const room = req.query.room || 'global';
  const limit = Math.min(100, parseInt(req.query.limit || '20'));
  const before = req.query.before;
  const roomMsgs = messages[room] || [];
  if (!before) return res.json(roomMsgs.slice(-limit));
  const idx = roomMsgs.findIndex(m => m.id === before);
  const end = idx === -1 ? roomMsgs.length : idx;
  const start = Math.max(0, end - limit);
  return res.json(roomMsgs.slice(start, end));
});

app.get('/api/rooms', (req, res) => res.json([...rooms]));
app.get('/api/users', (req, res) => res.json(Object.values(users).map(u => ({ username: u.username, userId: u.userId, online: !!u.online }))));

// Socket auth
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    const data = jwt.verify(token, JWT_SECRET);
    socket.user = data;
    next();
  } catch (err) {
    next();
  }
});

io.on('connection', (socket) => {
  const sid = socket.id;
  const user = socket.user || { username: 'Guest_' + sid.slice(0,5), userId: sid };
  users[sid] = { username: user.username, userId: user.userId, socketId: sid, online: true };
  userIdToSocket[user.userId] = sid;

  socket.join('global');
  io.emit('user_list', Object.values(users).map(u => ({ username: u.username, userId: u.userId, online: !!u.online })));
  io.to('global').emit('system_message', { text: `${user.username} joined`, timestamp: new Date().toISOString() });
  socket.emit('room_list', [...rooms]);

  socket.on('join_room', (room, cb) => {
    if (!rooms.has(room)) rooms.add(room);
    socket.join(room);
    if (cb) cb({ ok: true });
    io.to(room).emit('system_message', { text: `${users[sid].username} joined ${room}`, timestamp: new Date().toISOString() });
  });

  socket.on('leave_room', (room, cb) => {
    socket.leave(room);
    if (cb) cb({ ok: true });
    io.to(room).emit('system_message', { text: `${users[sid].username} left ${room}`, timestamp: new Date().toISOString() });
  });

  socket.on('send_message', (payload, ack) => {
    const room = payload.room || 'global';
    const msg = {
      id: String(Date.now()) + '_' + Math.random().toString(36).slice(2,8),
      sender: users[sid].username,
      senderId: users[sid].userId,
      text: payload.text || null,
      file: payload.file || null,
      room,
      isPrivate: !!payload.to,
      to: payload.to || null,
      timestamp: new Date().toISOString(),
      reactions: {},
      readBy: [],
      deliveredTo: [],
    };
    pushMessage(room, msg);

    if (msg.isPrivate && msg.to) {
      const toSocket = userIdToSocket[msg.to];
      if (toSocket) {
        io.to(toSocket).emit('private_message', msg);
        msg.deliveredTo.push(msg.to);
      }
      socket.emit('private_message', msg);
    } else {
      io.to(room).emit('receive_message', msg);
      // mark delivered to current sockets in room
      const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(room) || []);
      for (const s of socketsInRoom) {
        const u = users[s];
        if (u && u.userId) msg.deliveredTo.push(u.userId);
      }
    }

    if (ack) ack({ ok: true, id: msg.id, timestamp: msg.timestamp });
  });

  socket.on('message_delivered', ({ messageId, room }) => {
    const roomMsgs = messages[room] || [];
    const m = roomMsgs.find(x => x.id === messageId);
    if (m && !m.deliveredTo.includes(users[sid].userId)) {
      m.deliveredTo.push(users[sid].userId);
      io.to(room).emit('message_delivered', { messageId, userId: users[sid].userId });
    }
  });

  socket.on('message_read', ({ messageId, room }) => {
    const roomMsgs = messages[room] || [];
    const m = roomMsgs.find(x => x.id === messageId);
    if (m && !m.readBy.includes(users[sid].userId)) {
      m.readBy.push(users[sid].userId);
      io.to(room).emit('message_read', { messageId, readBy: m.readBy });
    }
  });

  socket.on('message_reaction', ({ messageId, room, reaction }) => {
    const roomMsgs = messages[room] || [];
    const m = roomMsgs.find(x => x.id === messageId);
    if (m) {
      m.reactions[reaction] = m.reactions[reaction] || [];
      const arr = m.reactions[reaction];
      const idx = arr.indexOf(users[sid].userId);
      if (idx === -1) arr.push(users[sid].userId);
      else arr.splice(idx,1);
      io.to(room).emit('message_reaction', { messageId, reactions: m.reactions });
    }
  });

  socket.on('typing', ({ room, isTyping }) => {
    socket.to(room || 'global').emit('user_typing', { username: users[sid].username, isTyping });
  });

  socket.on('search', ({ q }, cb) => {
    const results = searchMessages(q);
    if (cb) cb(results.slice(0,200));
  });

  socket.on('disconnect', () => {
    if (users[sid]) {
      users[sid].online = false;
      io.emit('user_list', Object.values(users).map(u => ({ username: u.username, userId: u.userId, online: !!u.online })));
      io.to('global').emit('system_message', { text: `${users[sid].username} left`, timestamp: new Date().toISOString() });
      delete userIdToSocket[users[sid].userId];
    }
    delete users[sid];
  });

});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port', PORT));
