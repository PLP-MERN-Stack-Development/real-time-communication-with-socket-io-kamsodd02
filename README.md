# Realtime Chat App (Full Features)

This folder contains a full-featured realtime chat app (Node.js/Express + Socket.io backend and React/Vite frontend)
with the following implemented features grouped by Tasks:

## Task 2 — Core Chat Functionality
- Username-based JWT authentication (simple)
- Global chat room where all users can send/receive messages
- Messages display sender name and timestamp
- Typing indicators when a user composes a message
- Online/offline status for users

## Task 3 — Advanced Chat Features
- Private messaging between users
- Multiple chat rooms/channels (join/leave)
- File/image sharing (upload via /api/upload)
- Read receipts for messages
- Message reactions (e.g., 👍)

## Task 4 — Real-Time Notifications
- Sound notifications for new messages (notify.mp3 placeholder)
- Browser notifications via Web Notifications API
- Notifications when users join/leave rooms
- Unread message count handling (client-side)

## Task 5 — Performance & UX
- Message pagination for loading older messages (`/api/messages?room=...&before=...`)
- Reconnection logic (socket.io client reconnection enabled)
- Use of Socket.io rooms for optimizing message broadcasts
- Message delivery acknowledgements and server acks
- Message search (socket 'search' event)
- Responsive UI for desktop and mobile

## Quick Start (for beginners)

### Prerequisites
- Node.js v18+ (https://nodejs.org)
- npm (comes with Node.js)

### Run locally (step-by-step)
1. Unzip this folder.
2. Start the server:
   ```
   cd realtime-chat-app-final/server
   npm install
   npm run dev
   ```
   Server defaults to http://localhost:5000
3. Start the client in a second terminal:
   ```
   cd realtime-chat-app-final/client
   npm install
   npm run dev
   ```
   Client defaults to http://localhost:5173
4. Open the client URL, enter a username, and start chatting. Open multiple tabs to test realtime features.

## Deploying Live (short)
- Deploy the server to Render (or Heroku). Point VITE_SOCKET_URL on the client to the server URL.
- Deploy the client to Vercel (or Netlify). Set the environment variable VITE_SOCKET_URL to your server URL.

## Notes & Next Steps
- This project stores data in memory (for demo). For production, replace with a database (MongoDB/Postgres) and use Redis adapter for socket scaling.
- Add HTTPS and secure cookies for production.
- Replace the notify.mp3 placeholder with a real sound file.

