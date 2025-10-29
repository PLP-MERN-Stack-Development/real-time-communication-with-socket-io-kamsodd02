import { io } from 'socket.io-client';

export const useSocket = (setMessages, setTypingUser) => {
  const socket = io('http://localhost:5000', { autoConnect: false });

  const connect = (token) => {
    socket.auth = { token };
    socket.connect();
  };

  socket.on('receive_message', (msg) => {
    setMessages(prev => [...prev, msg]);
  });

  socket.on('system_message', (msg) => {
    setMessages(prev => [...prev, { sender: 'System', text: msg, time: new Date().toISOString() }]);
  });

  socket.on('user_typing', ({ username, isTyping }) => {
    setTypingUser(isTyping ? username : '');
  });

  const sendMessage = (text) => socket.emit('send_message', { message: text });
  const setTyping = (isTyping) => socket.emit('typing', isTyping);

  return { socket, connect, sendMessage, setTyping };
};
