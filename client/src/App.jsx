import React, { useState, useEffect } from 'react';
import { useSocket } from './socket';

export default function App() {
  const [username, setUsername] = useState('');
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState('');
  const { socket, connect, sendMessage, setTyping } = useSocket(setMessages, setTypingUser);

  const login = async () => {
    const res = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    setToken(data.token);
    connect(data.token);
  };

  if (!token) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Enter Username to Join Chat</h2>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" />
        <button onClick={login}>Join</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Realtime Chat</h2>
      <div style={{ border: '1px solid #ccc', height: 300, overflowY: 'auto', padding: 10 }}>
        {messages.map((m, i) => (
          <div key={i}><b>{m.sender}:</b> {m.text} <small>{new Date(m.time).toLocaleTimeString()}</small></div>
        ))}
        {typingUser && <i>{typingUser} is typing...</i>}
      </div>
      <input
        value={message}
        onChange={e => { setMessage(e.target.value); setTyping(true); }}
        placeholder="Type message"
      />
      <button onClick={() => { sendMessage(message); setMessage(''); }}>Send</button>
    </div>
  );
}
