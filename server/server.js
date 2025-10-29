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
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'chat_secret_key';
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

const users = {};
const userIdToSocket = {};
const messages = {};

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  const userId = username + '_' + Date.now();
  const token = jwt.sign({ username, userId }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, username, userId });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  res.json({ url: '/uploads/' + req.file.filename });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    const data = jwt.verify(token, JWT_SECRET);
    socket.user = data;
    next();
  } catch {
    next();
  }
});

io.on('connection', (socket) => {
  const user = socket.user || { username: 'Guest_' + socket.id.slice(0,5), userId: socket.id };
  users[socket.id] = user;
  userIdToSocket[user.userId] = socket.id;
  socket.join('global');

  io.emit('user_list', Object.values(users));
  io.to('global').emit('system_message', user.username + ' joined');

  socket.on('send_message', (data) => {
    const msg = {
      id: Date.now(),
      sender: user.username,
      text: data.message,
      file: data.file || null,
      time: new Date().toISOString(),
    };
    if (!messages['global']) messages['global'] = [];
    messages['global'].push(msg);
    io.to('global').emit('receive_message', msg);
  });

  socket.on('typing', (isTyping) => {
    io.to('global').emit('user_typing', { username: user.username, isTyping });
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('user_list', Object.values(users));
    io.to('global').emit('system_message', user.username + ' left');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log('Server running on port', PORT));
