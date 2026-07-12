const fs = require('fs');
const path = require('path');

let db = null;
let useJsonFallback = false;
const JSON_FILE_PATH = path.join(__dirname, 'chat-data.json');

// Initialize JSON database empty structure
function initJsonDb() {
  if (!fs.existsSync(JSON_FILE_PATH)) {
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify({ messages: [], users: {} }, null, 2));
  }
}

function readJsonDb() {
  try {
    initJsonDb();
    const data = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading JSON fallback database:', err);
    return { messages: [], users: {} };
  }
}

function writeJsonDb(data) {
  try {
    fs.writeFileSync(JSON_FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing JSON fallback database:', err);
  }
}

// SQLite database setup
function initDatabase() {
  return new Promise((resolve) => {
    try {
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, 'chat.db');
      
      db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.warn('Failed to connect to SQLite. Falling back to JSON file storage.', err.message);
          useJsonFallback = true;
          initJsonDb();
          resolve();
          return;
        }
        
        // Create tables
        db.serialize(() => {
          db.run(`
            CREATE TABLE IF NOT EXISTS messages (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL,
              text TEXT NOT NULL,
              timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
              status TEXT DEFAULT 'sent'
            )
          `, (err) => {
            if (err) {
              console.error('Failed to create messages table, falling back to JSON storage.', err.message);
              useJsonFallback = true;
              initJsonDb();
              resolve();
              return;
            }
          });

          db.run(`
            CREATE TABLE IF NOT EXISTS users (
              username TEXT PRIMARY KEY,
              status TEXT NOT NULL,
              last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              console.error('Failed to create users table, falling back to JSON storage.', err.message);
              useJsonFallback = true;
              initJsonDb();
              resolve();
              return;
            }
            console.log('SQLite database initialized successfully.');
            resolve();
          });
        });
      });
    } catch (err) {
      console.warn('SQLite module not found or failed to load. Falling back to JSON file storage.', err.message);
      useJsonFallback = true;
      initJsonDb();
      resolve();
    }
  });
}

// Database helper functions
function saveMessage(username, text, status = 'sent') {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    
    if (useJsonFallback) {
      const dbData = readJsonDb();
      const newMessage = {
        id: dbData.messages.length + 1,
        username,
        text,
        timestamp,
        status
      };
      dbData.messages.push(newMessage);
      writeJsonDb(dbData);
      resolve(newMessage);
      return;
    }

    db.run(
      `INSERT INTO messages (username, text, timestamp, status) VALUES (?, ?, ?, ?)`,
      [username, text, timestamp, status],
      function (err) {
        if (err) {
          console.error('Error saving message in SQLite:', err.message);
          reject(err);
          return;
        }
        resolve({
          id: this.lastID,
          username,
          text,
          timestamp,
          status
        });
      }
    );
  });
}

function getMessages(limit = 100) {
  return new Promise((resolve, reject) => {
    if (useJsonFallback) {
      const dbData = readJsonDb();
      const sliceStart = Math.max(0, dbData.messages.length - limit);
      resolve(dbData.messages.slice(sliceStart));
      return;
    }

    db.all(
      `SELECT * FROM messages ORDER BY timestamp ASC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) {
          console.error('Error loading messages from SQLite:', err.message);
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

function upsertUser(username, status) {
  return new Promise((resolve, reject) => {
    const lastSeen = new Date().toISOString();

    if (useJsonFallback) {
      const dbData = readJsonDb();
      dbData.users[username] = {
        username,
        status,
        last_seen: lastSeen
      };
      writeJsonDb(dbData);
      resolve();
      return;
    }

    db.run(
      `INSERT INTO users (username, status, last_seen) VALUES (?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET status = excluded.status, last_seen = excluded.last_seen`,
      [username, status, lastSeen],
      (err) => {
        if (err) {
          console.error('Error updating user status in SQLite:', err.message);
          reject(err);
          return;
        }
        resolve();
      }
    );
  });
}

function getOnlineUsers() {
  return new Promise((resolve, reject) => {
    if (useJsonFallback) {
      const dbData = readJsonDb();
      const online = Object.values(dbData.users)
        .filter(u => u.status === 'online')
        .map(u => u.username);
      resolve(online);
      return;
    }

    db.all(
      `SELECT username FROM users WHERE status = 'online'`,
      [],
      (err, rows) => {
        if (err) {
          console.error('Error fetching online users from SQLite:', err.message);
          reject(err);
          return;
        }
        resolve(rows.map(r => r.username));
      }
    );
  });
}

module.exports = {
  initDatabase,
  saveMessage,
  getMessages,
  upsertUser,
  getOnlineUsers
};
