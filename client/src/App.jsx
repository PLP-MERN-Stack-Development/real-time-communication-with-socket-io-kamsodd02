import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './socket';
import './styles.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('global');
  const [rooms, setRooms] = useState(['global']);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typing, setTypingUser] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const { socket, connect, sendMessage, joinRoom, leaveRoom, reactMessage, markRead, loadMessages, searchMessages } = useSocket(setMessages, setTypingUser, setUsers, setRooms);

  useEffect(() => {
    if (token) {
      connect(token, currentRoom);
      loadMessages(currentRoom).then(res => setMessages(res || []));
    }
  }, [token]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  const login = async () => {
    if (!username) return alert('Enter username');
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ username })
    });
    const j = await res.json();
    setToken(j.token);
  };

  const [text, setText] = useState('');
  const [file, setFile] = useState(null);

  const handleSend = async () => {
    if (!text && !file) return;
    let fileUrl = null;
    if (file) {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('http://localhost:5000/api/upload', { method: 'POST', body: fd });
      const j = await r.json(); fileUrl = j.url; setFile(null);
    }
    sendMessage({ room: currentRoom, text, file: fileUrl }, (ack) => console.log('ack', ack));
    setText('');
    socket.emit('typing', { room: currentRoom, isTyping: false });
  };

  const handleReact = (messageId, reaction) => reactMessage({ room: currentRoom, messageId, reaction });

  const loadOlder = async () => {
    if (!messages.length || loadingOlder) return;
    setLoadingOlder(true);
    const before = messages[0].id;
    const older = await loadMessages(currentRoom, before);
    if (!older || older.length === 0) setHasMore(false);
    else setMessages(prev => [...older, ...prev]);
    setLoadingOlder(false);
  };

  const doSearch = async () => {
    if (!searchQ) return;
    const results = await searchMessages(searchQ);
    setMessages(results);
  };

  if (!token) {
    return (
      <div className="login">
        <h2>Join Chat</h2>
        <input placeholder="Choose a username" value={username} onChange={e=>setUsername(e.target.value)} />
        <button onClick={login}>Join</button>
      </div>
    );
  }

  return (
    <div className="container">
      <aside className="sidebar">
        <h3>Rooms</h3>
        <ul>
          {rooms.map(r => <li key={r} className={r===currentRoom?'active':''} onClick={()=>{
            setCurrentRoom(r); joinRoom(r); loadMessages(r).then(res=>setMessages(res||[]));
          }}>{r}</li>)}
        </ul>
        <h3>Users</h3>
        <ul>{users.map(u => <li key={u.userId}>{u.username} {u.online? '•':'○'}</li>)}</ul>
        <div className="search"><input placeholder="Search messages or users" value={searchQ} onChange={e=>setSearchQ(e.target.value)} /><button onClick={doSearch}>Search</button></div>
      </aside>

      <main className="chat">
        <header><h2>{currentRoom}</h2><div className="typing">{typing}</div></header>

        <div className="messages">
          {hasMore && <button onClick={loadOlder} disabled={loadingOlder}>{loadingOlder?'Loading...':'Load older messages'}</button>}
          {messages.map(m => (
            <div key={m.id} className={'msg '+(m.isPrivate?'private':'')}>
              <div className="meta"><strong>{m.sender}</strong> <span className="time">{new Date(m.timestamp).toLocaleTimeString()}</span>{m.readBy && m.readBy.length>0 && <span className="reads"> • read: {m.readBy.length}</span>}</div>
              <div className="body">{m.text}{m.file && <div><a href={m.file} target="_blank" rel="noreferrer">Attachment</a></div>}</div>
              <div className="actions"><button onClick={()=>handleReact(m.id,'👍')}>👍 {m.reactions && m.reactions['👍']? m.reactions['👍'].length:0}</button><button onClick={()=>{ markRead(currentRoom, m.id); }}>Mark Read</button></div>
            </div>
          ))}
        </div>

        <footer className="composer">
          <input value={text} onChange={e=>{ setText(e.target.value); socket.emit('typing',{ room: currentRoom, isTyping: !!e.target.value }); }} placeholder="Type a message" />
          <input type="file" onChange={e=>setFile(e.target.files[0])} />
          <button onClick={handleSend}>Send</button>
        </footer>
      </main>
    </div>
  );
}
