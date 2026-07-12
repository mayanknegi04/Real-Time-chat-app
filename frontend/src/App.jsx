import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Login from './components/Login';
import ChatRoom from './components/ChatRoom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function App() {
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('chat_username') || '';
  });
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const socketRef = useRef(null);

  // Fetch previous messages (chat history) via REST API
  const fetchChatHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      } else {
        console.error('Failed to fetch chat history.');
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  };

  // Connect to Socket.io and fetch history when logged in
  useEffect(() => {
    if (!username) return;

    // Fetch chat history from REST API first
    fetchChatHistory();

    // Initialize socket connection
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    // Emit join event with nickname
    socket.emit('join', username);

    // Listen for incoming messages
    socket.on('message', (msg) => {
      setMessages((prev) => {
        // Prevent duplicate messages if any
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Listen for system notification messages (join / leave)
    socket.on('system-message', (sysMsg) => {
      setMessages((prev) => [...prev, { ...sysMsg, isSystem: true }]);
    });

    // Listen for updated online users list
    socket.on('online-users', (users) => {
      setOnlineUsers(users);
    });

    // Listen for typing indicator updates
    socket.on('typing-status', ({ username: typingUser, isTyping }) => {
      setTypingUsers((prev) => {
        if (isTyping) {
          if (!prev.includes(typingUser)) {
            return [...prev, typingUser];
          }
          return prev;
        } else {
          return prev.filter((u) => u !== typingUser);
        }
      });
    });

    // Handle connection error
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [username]);

  const handleLogin = (name) => {
    localStorage.setItem('chat_username', name);
    setUsername(name);
  };

  const handleLogout = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem('chat_username');
    setUsername('');
    setMessages([]);
    setOnlineUsers([]);
    setTypingUsers([]);
  };

  // Send message using REST API POST request
  // This uses the REST API endpoint, which in turn broadcasts the message to all clients via Socket.io
  const handleSendMessage = async (text) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          text
        })
      });

      if (!response.ok) {
        console.error('REST API failed to send message.');
        // Fallback: emit message directly via Socket.io if REST API fails
        if (socketRef.current) {
          socketRef.current.emit('message', { username, text });
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // Fallback: emit message directly via Socket.io if fetch encounters network error
      if (socketRef.current) {
        socketRef.current.emit('message', { username, text });
      }
    }
  };

  // Broadcast typing status
  const handleTyping = (isTyping) => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { username, isTyping });
    }
  };

  return (
    <>
      {!username ? (
        <Login onLogin={handleLogin} />
      ) : (
        <ChatRoom
          username={username}
          messages={messages}
          onlineUsers={onlineUsers}
          typingUsers={typingUsers}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
