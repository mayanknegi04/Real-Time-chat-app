import React, { useState, useEffect, useRef } from 'react';
import { Send, Users, LogOut, MessageCircle, AlertCircle } from 'lucide-react';

export default function ChatRoom({
  username,
  messages,
  onlineUsers,
  typingUsers,
  onSendMessage,
  onTyping,
  onLogout
}) {
  const [text, setText] = useState('');
  const [isSidebarActive, setIsSidebarActive] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Handle typing status notification
  useEffect(() => {
    if (text.trim()) {
      onTyping(true);
    } else {
      onTyping(false);
    }

    const delayDebounceFn = setTimeout(() => {
      onTyping(false);
    }, 1500);

    return () => clearTimeout(delayDebounceFn);
  }, [text]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
    onTyping(false);
  };

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const getInitials = (name) => {
    return name ? name.charAt(0).toUpperCase() : '?';
  };

  // Compile typing text
  const getTypingText = () => {
    const activeTypers = typingUsers.filter(u => u !== username);
    if (activeTypers.length === 0) return '';
    if (activeTypers.length === 1) return `${activeTypers[0]} is typing`;
    if (activeTypers.length === 2) return `${activeTypers[0]} and ${activeTypers[1]} are typing`;
    return 'Several people are typing';
  };

  const typingText = getTypingText();

  return (
    <div className="app-container">
      {/* Sidebar for Online Users */}
      <aside className={`sidebar ${isSidebarActive ? 'active' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <Users size={20} />
            <span>Chat Room</span>
          </div>
          <span className="online-badge">
            {onlineUsers.length} Online
          </span>
        </div>

        {/* Current User Profile Section */}
        <div className="user-profile-section">
          <div className="avatar-circle">
            {getInitials(username)}
          </div>
          <div className="user-profile-info">
            <div className="profile-username">{username}</div>
            <div className="profile-status">Active Now</div>
          </div>
          <button className="icon-btn" title="Leave Chat" onClick={onLogout}>
            <LogOut size={16} />
          </button>
        </div>

        {/* User List */}
        <div className="user-list">
          {onlineUsers.map((user, idx) => (
            <div key={`${user}-${idx}`} className="user-list-item">
              <div className="user-list-avatar">
                {getInitials(user)}
              </div>
              <div className="user-list-name">
                {user} {user === username ? '(You)' : ''}
              </div>
              <div className="user-list-status"></div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        {/* Chat Header */}
        <header className="chat-header">
          <button 
            className="icon-btn mobile-menu-btn" 
            style={{ display: window.innerWidth <= 768 ? 'flex' : 'none' }}
            onClick={() => setIsSidebarActive(!isSidebarActive)}
          >
            <Users size={18} />
          </button>

          <div className="chat-room-info">
            <h3># General Room</h3>
            <p>Real-time updates active</p>
          </div>

          <div className="chat-actions">
            <div className="icon-btn" title="Public chatroom. All messages are synchronized.">
              <MessageCircle size={18} />
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <AlertCircle size={32} style={{ marginBottom: '12px', color: 'var(--text-muted)' }} />
              <p>No messages yet. Say hello to start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              if (msg.isSystem) {
                return (
                  <div key={`sys-${idx}`} className="system-message-wrapper">
                    <div className="system-message-bubble">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const isSelf = msg.username === username;
              return (
                <div key={msg.id || idx} className={`message-wrapper ${isSelf ? 'self' : 'other'}`}>
                  <span className="message-sender">
                    {isSelf ? 'You' : msg.username}
                  </span>
                  <div className="message-bubble">
                    {msg.text}
                    <div className="message-meta">
                      <span>{formatTime(msg.timestamp)}</span>
                      {isSelf && (
                        <span className="status-checkmark" title="Delivered">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* Scroll Target */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input & Footer */}
        <div className="input-area-container">
          {/* Typing Indicator */}
          <div className="typing-indicator-bar">
            {typingText && (
              <>
                <span>{typingText}</span>
                <div className="typing-indicator-dots">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="input-box-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="Write a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="send-btn" disabled={!text.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
