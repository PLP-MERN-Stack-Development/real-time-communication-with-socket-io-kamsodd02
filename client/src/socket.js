import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const useSocket = (setMessages, setTypingUser, setUsers, setRooms) => {
  const socket = io(SOCKET_URL, { autoConnect: false, reconnection: true, reconnectionAttempts: Infinity });

  const connect = (token, room='global') => {
    socket.auth = { token };
    socket.connect();
    socket.on('connect', () => socket.emit('join_room', room, ()=>{}));
  };

  socket.on('receive_message', (msg) => {
    setMessages(prev => [...prev, msg]);
    if (Notification && Notification.permission === 'granted') {
      try { new Notification(msg.sender, { body: msg.text || 'Sent attachment' }); } catch(e){}
    }
    try { const a = new Audio('/notify.mp3'); a.play().catch(()=>{}); } catch(e){}
  });

  socket.on('private_message', (msg) => setMessages(prev => [...prev, msg]));
  socket.on('system_message', (m) => setMessages(prev => [...prev, { id: 'sys_'+Date.now(), sender:'System', text:m.text, timestamp: m.timestamp }]));
  socket.on('message_reaction', ({ messageId, reactions }) => setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m)));
  socket.on('message_read', ({ messageId, readBy }) => setMessages(prev => prev.map(m => m.id === messageId ? { ...m, readBy } : m)));
  socket.on('user_typing', ({ username, isTyping }) => setTypingUser(isTyping ? `${username} is typing...` : ''));
  socket.on('user_list', (list) => setUsers(list));
  socket.on('room_list', (r) => setRooms(r));
  socket.on('message_delivered', ({ messageId, userId }) => setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deliveredTo: (m.deliveredTo||[]).concat(userId) } : m)));

  const sendMessage = (payload, cb) => socket.emit('send_message', payload, cb);
  const joinRoom = (room) => socket.emit('join_room', room);
  const leaveRoom = (room) => socket.emit('leave_room', room);
  const reactMessage = ({ room, messageId, reaction }) => socket.emit('message_reaction', { room, messageId, reaction });
  const markRead = (room, messageId) => socket.emit('message_read', { room, messageId });
  const loadMessages = async (room, before=null, limit=30) => {
    const serverOrigin = SOCKET_URL;
    const params = new URLSearchParams({ room, limit: String(limit) });
    if (before) params.append('before', before);
    const resp = await fetch(`${serverOrigin}/api/messages?${params.toString()}`);
    if (!resp.ok) return [];
    return await resp.json();
  };
  const searchMessages = (q) => new Promise((res)=> socket.emit('search', { q }, (r)=>res(r)));

  return { socket, connect, sendMessage, joinRoom, leaveRoom, reactMessage, markRead, loadMessages, searchMessages };
};

export default null;
