require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // For demo purposes, allow all origins
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Active socket connection mappings (socketId -> username)
const socketToUser = new Map();

// Helper to broadcast online users list
async function broadcastOnlineUsers(io) {
  try {
    const onlineUsers = await db.getOnlineUsers();
    io.emit('online-users', onlineUsers);
  } catch (err) {
    console.error('Error broadcasting online users:', err);
  }
}

// REST APIs
// Fetch chat history
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await db.getMessages();
    res.status(200).json(messages);
  } catch (err) {
    console.error('Error in GET /api/messages:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Send a message (REST endpoint alternative)
app.post('/api/messages', async (req, res) => {
  try {
    const { username, text } = req.body;
    if (!username || !text) {
      return res.status(400).json({ error: 'Bad Request', message: 'Username and text are required.' });
    }
    
    // Save to database
    const savedMsg = await db.saveMessage(username, text, 'sent');
    
    // Broadcast via socket.io
    if (global.io) {
      global.io.emit('message', savedMsg);
    }
    
    res.status(201).json(savedMsg);
  } catch (err) {
    console.error('Error in POST /api/messages:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Setup Server and Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
global.io = io; // Attach globally for access in REST API

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Handle user joining the chat
  socket.on('join', async (username) => {
    if (!username) return;
    
    // Associate socket with username
    socketToUser.set(socket.id, username);
    console.log(`User joined: ${username} (${socket.id})`);
    
    try {
      // Mark online in database
      await db.upsertUser(username, 'online');
      // Broadcast updated online list
      await broadcastOnlineUsers(io);
      
      // Notify other users
      socket.broadcast.emit('system-message', {
        text: `${username} has joined the chat.`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error handling user join event:', err);
    }
  });

  // Handle real-time messaging
  socket.on('message', async (data) => {
    const { username, text } = data;
    if (!username || !text) return;

    try {
      // Save message
      const savedMsg = await db.saveMessage(username, text, 'delivered'); // delivered since socket emits directly
      // Broadcast to everyone
      io.emit('message', savedMsg);
    } catch (err) {
      console.error('Error handling chat message:', err);
      socket.emit('error', { message: 'Failed to send message.' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { username, isTyping } = data;
    socket.broadcast.emit('typing-status', { username, isTyping });
  });

  // Handle disconnect
  socket.on('disconnect', async () => {
    const username = socketToUser.get(socket.id);
    if (username) {
      console.log(`User disconnected: ${username} (${socket.id})`);
      socketToUser.delete(socket.id);
      
      try {
        // Mark offline in database
        await db.upsertUser(username, 'offline');
        // Broadcast updated online list
        await broadcastOnlineUsers(io);
        
        // Broadcast stopped typing in case they were typing
        socket.broadcast.emit('typing-status', { username, isTyping: false });

        // Notify other users
        socket.broadcast.emit('system-message', {
          text: `${username} has left the chat.`,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error handling user disconnect:', err);
      }
    } else {
      console.log(`Socket disconnected before joining: ${socket.id}`);
    }
  });
});

// Initialize database first, then start server
db.initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database. Server cannot start.', err);
});
