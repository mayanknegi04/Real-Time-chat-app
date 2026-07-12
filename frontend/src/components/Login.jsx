import React, { useState } from 'react';
import { User, MessageSquare, LogIn } from 'lucide-react';

export default function Login({ onLogin }) {
  const [usernameInput, setUsernameInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanUsername = usernameInput.trim();
    
    if (!cleanUsername) {
      setError('Username cannot be empty.');
      return;
    }
    if (cleanUsername.length < 2) {
      setError('Username must be at least 2 characters.');
      return;
    }
    if (cleanUsername.length > 20) {
      setError('Username must be 20 characters or less.');
      return;
    }
    
    setError('');
    onLogin(cleanUsername);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <MessageSquare size={36} />
        </div>
        
        <h2>Welcome to ChatWave</h2>
        <p>A premium real-time chatting experience</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="username">
              Choose your nickname
            </label>
            <div className="input-wrapper">
              <User className="input-icon" size={20} />
              <input
                id="username"
                type="text"
                className="login-input"
                placeholder="e.g. Alex"
                value={usernameInput}
                onChange={(e) => {
                  setUsernameInput(e.target.value);
                  if (error) setError('');
                }}
                maxLength={20}
                autoComplete="off"
                required
              />
            </div>
            {error && (
              <span style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px', display: 'block' }}>
                {error}
              </span>
            )}
          </div>

          <button type="submit" className="login-button">
            <LogIn size={18} />
            Join Chatroom
          </button>
        </form>
      </div>
    </div>
  );
}
