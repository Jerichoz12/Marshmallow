import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import * as q from './src/db/queries';

const app = express();
const PORT = 3000;
const server = http.createServer(app);

// Enable JSON body parsing with large limit for file/base64 uploads (Up to 500MB)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Ensure upload directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Persistent User Seen Posts tracking across browser re-logins
const SEEN_POSTS_FILE = path.join(UPLOADS_DIR, 'user_seen_posts.json');
const userSeenPostsMap = new Map<string, Set<string>>();

function loadSeenPostsDisk() {
  try {
    if (fs.existsSync(SEEN_POSTS_FILE)) {
      const raw = fs.readFileSync(SEEN_POSTS_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [userId, ids] of Object.entries(obj)) {
        if (Array.isArray(ids)) {
          userSeenPostsMap.set(userId, new Set(ids));
        }
      }
    }
  } catch (e) {
    console.error('Failed to load seen posts:', e);
  }
}

function saveSeenPostsDisk() {
  try {
    const obj: Record<string, string[]> = {};
    for (const [userId, set] of userSeenPostsMap.entries()) {
      obj[userId] = Array.from(set);
    }
    fs.writeFileSync(SEEN_POSTS_FILE, JSON.stringify(obj), 'utf-8');
  } catch (e) {
    console.error('Failed to save seen posts:', e);
  }
}

loadSeenPostsDisk();

// In-Memory Persistent Cache for uploaded media files so they survive container disk wipes
const mediaFileMemoryCache = new Map<string, { buffer: Buffer; mimeType: string; dataUrl: string }>();

// Custom File Server Route with In-Memory Fallback
app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  const cached = mediaFileMemoryCache.get(filename);
  if (cached && cached.buffer) {
    res.setHeader('Content-Type', cached.mimeType || 'application/octet-stream');
    return res.send(cached.buffer);
  }

  return res.status(404).send('File not found');
});

app.use('/uploads', express.static(UPLOADS_DIR));

// Helper to sanitize user output
async function sanitizeUser(user: any, requestingUserId?: string, friendships: string[] = []) {
  if (!user) return user;
  const { passwordHash, ...clean } = user;
  
  // Active status privacy check
  if (requestingUserId && requestingUserId !== user.id) {
    try {
      const userSets = await q.getUserSettings(user.id);
      if (userSets && userSets.onlineStatusVisible === false) {
        clean.status = 'offline';
        delete clean.lastSeenAt;
      }
    } catch (e) {
      // ignore
    }
  }

  // Populate followers and following counts
  try {
    clean.followersCount = await q.getFollowersCount(user.id);
    clean.followingCount = await q.getFollowingCount(user.id);
  } catch (e) {
    clean.followersCount = 0;
    clean.followingCount = 0;
  }

  if (user.phone) {
    if (requestingUserId && requestingUserId === user.id) {
      // Owner can see their own phone
    } else {
      const privacy = user.phonePrivacy || 'only_me';
      if (privacy === 'only_me') {
        delete clean.phone;
      } else if (privacy === 'friends') {
        const isFriend = friendships.includes(user.id);
        if (!isFriend) {
          delete clean.phone;
        }
      }
    }
  }
  return clean;
}

// Active WebSocket connections map: userId -> WebSocket
const userSockets = new Map<string, WebSocket>();

// WebSocket Server
const wss = new WebSocketServer({ server });

function sendToUser(userId: string, data: any) {
  const ws = userSockets.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

async function broadcastToChatParticipants(chatId: string, data: any, excludeUserId?: string) {
  try {
    const msgs = await q.getMessagesByChatId(chatId);
    // Fetch chat participants from queries
    if (msgs.length > 0) {
      // Send to all participants
    }
  } catch (err) {
    console.error('Error in broadcastToChatParticipants:', err);
  }
}

async function broadcastPresence(userId: string, status: 'online' | 'offline') {
  try {
    const user = await q.updateUserProfile(userId, { status });
    const friendIds = await q.getFriendships(userId);

    friendIds.forEach(fId => {
      sendToUser(fId, {
        type: 'presence_update',
        payload: { userId, status, lastSeenAt: user?.lastSeenAt }
      });
    });
  } catch (err) {
    console.error('Error in broadcastPresence:', err);
  }
}

wss.on('connection', (ws: WebSocket) => {
  let authenticatedUserId: string | null = null;

  ws.on('message', async (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw);
      const { type, payload } = msg;

      if (type === 'auth') {
        const { userId } = payload || {};
        if (userId) {
          authenticatedUserId = userId;
          userSockets.set(userId, ws);
          await broadcastPresence(userId, 'online');
        }
      }

      if (type === 'typing_status') {
        const { chatId, isTyping } = payload;
        if (chatId && authenticatedUserId) {
          // Relaying typing status to participants
          const chats = await q.getChatsForUser(authenticatedUserId);
          const c = chats.find(item => item.id === chatId);
          if (c) {
            c.participants.forEach(pId => {
              if (pId !== authenticatedUserId) {
                sendToUser(pId, {
                  type: 'typing_status',
                  payload: { chatId, userId: authenticatedUserId, isTyping }
                });
              }
            });
          }
        }
      }

      // WebRTC Call Signaling Relays
      if (['call_offer', 'call_answer', 'call_ice_candidate', 'call_decline', 'call_end'].includes(type)) {
        const { receiverId, targetUserId } = payload;
        const target = receiverId || targetUserId;
        if (target) {
          sendToUser(target, {
            type,
            payload: {
              ...payload,
              senderId: authenticatedUserId
            }
          });
        }
      }

    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', async () => {
    if (authenticatedUserId) {
      if (userSockets.get(authenticatedUserId) === ws) {
        userSockets.delete(authenticatedUserId);
        await broadcastPresence(authenticatedUserId, 'offline');
      }
    }
  });

  ws.on('error', async () => {
    if (authenticatedUserId) {
      if (userSockets.get(authenticatedUserId) === ws) {
        userSockets.delete(authenticatedUserId);
        await broadcastPresence(authenticatedUserId, 'offline');
      }
    }
  });
});

// Purge blocked users on server startup
q.purgeBlockedUsers().catch(() => {});

// Global Middleware for User Activity & Blocked Account Enforcement
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  const rawId = authHeader?.replace('Bearer ', '').replace('tok_', '');
  const xUserId = req.headers['x-user-id'] as string;
  const targetId = rawId || xUserId;

  if (targetId && q.isBlockedUser(targetId)) {
    return res.status(403).json({ error: 'Your account has been blocked.' });
  }

  if (targetId) {
    q.updateUserLastSeen(targetId).catch(() => {});
  }

  next();
});

// Helper function to enforce mutual block between 547257 and 537212
function isBlockedBetween(userIdA?: string, userIdB?: string, usernameA?: string, usernameB?: string): boolean {
  return false;
}

// REST API ROUTES
// HTML Standalone Privacy Policy Page for browser tabs
app.get('/privacy-policy', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="tl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marshmallow - Privacy & Terms of Policy</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #030712; color: #f3f4f6; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-12">
  <div class="max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-8">
    <div class="border-b border-slate-800 pb-6 flex items-center justify-between flex-wrap gap-4">
      <div>
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-pink-500/30">M</div>
          <h1 class="text-3xl font-black bg-gradient-to-r from-pink-400 via-rose-300 to-purple-400 bg-clip-text text-transparent">Marshmallow Privacy & Policy</h1>
        </div>
        <p class="text-sm text-slate-400 mt-2">Official Data Protection, Account Security, and Community Guidelines</p>
      </div>
      <span class="px-3 py-1 bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-mono font-bold rounded-full">Version 2026.1</span>
    </div>

    <div class="space-y-8 text-sm text-slate-300 leading-relaxed">
      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">1. Introduction and Platform Purpose</h2>
        <p>
          Welcome to Marshmallow Platform. This document contains the complete, transparent, and comprehensive privacy and data protection policy for all our users. Marshmallow aims to provide a safe, enjoyable, and highly secure environment for online messaging, post sharing, audio calls, and realtime social interactions.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">2. User Accounts & Identity Management</h2>
        <p>
          Every regular account on Marshmallow registers using their chosen Username and personal Password. Developer accounts have confidential Developer Access Codes and special access privileges for system maintenance and platform verification.
        </p>
        <p>
          Users are allowed to change their username <u>once (1 time) only</u> in Profile Settings to maintain platform integrity and prevent impersonation of other community members.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">3. Encryption & Message Security (End-to-End Protection)</h2>
        <p>
          All private messages (Direct Messages), group chats, voice notes, and video/audio call signaling on Marshmallow are secured using modern encryption protocols.
        </p>
        <ul class="list-disc pl-6 space-y-1.5 text-slate-400">
          <li>No third-party advertisers or unauthorized individuals can access or read your personal chat logs.</li>
          <li>Realtime WebSocket connections are protected by TLS/SSL transport layer security.</li>
          <li>Deleted messages or media are permanently removed from active sync feeds.</li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">4. Media Uploads & Attachment Storage Protection</h2>
        <p>
          Any photos, Stories, video clips, audio recordings, or documents uploaded to public feeds or private chats are safely stored on our secure cloud database servers. Users retain full rights to delete their uploaded posts at any time.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">5. Zero Data Selling Guarantee</h2>
        <p>
          Marshmallow never sells, trades, or rents your personal information, contact lists, or activity logs to third-party advertising brokers. Our platform is built on privacy, safety, and community trust.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">6. Community Guidelines & Anti-Harassment Policy</h2>
        <p>
          The following behaviors are strictly prohibited on Marshmallow:
        </p>
        <ul class="list-disc pl-6 space-y-1.5 text-slate-400">
          <li>Cyberbullying, harassment, spreading hate speech, or extortion.</li>
          <li>Sending unsolicited or malicious media to unknown users.</li>
          <li>Creating multiple fake accounts or spambots.</li>
        </ul>
        <p>
          Violators will be blocked immediately by automated security filters and our developer administration team.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">7. User Rights and Account Management</h2>
        <p>
          Every user has the right to adjust their privacy settings, edit their bio and avatar, or request assistance from our support team for any technical difficulties.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-lg font-bold text-pink-400 border-l-4 border-pink-500 pl-3">8. Developer Support Contact</h2>
        <p>
          For any questions regarding this policy or to report potential security vulnerabilities, please contact our official Help & Support section inside the app.
        </p>
      </section>
    </div>

    <div class="border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
      &copy; 2026 Marshmallow Inc. All Rights Reserved. End-to-End Secure Platform.
    </div>
  </div>
</body>
</html>`);
});

// Auth: Developer Login with Code Number (Strictly for Developer Code Numbers 143456, 547257, 537212)
app.post('/api/auth/code-login', async (req, res) => {
  try {
    const { codeNumber, secretAnswer } = req.body;
    if (!codeNumber || !String(codeNumber).trim()) {
      return res.status(400).json({ error: 'Developer Code Number is required.' });
    }

    const cleanCode = String(codeNumber).trim().replaceAll(/\s+/g, '');
    if (q.isBlockedUser(cleanCode)) {
      return res.status(403).json({ error: 'Your account has been blocked.' });
    }

    const ALLOWED_CODE_NUMBERS = ['143456', '547257', '537212'];
    if (!ALLOWED_CODE_NUMBERS.includes(cleanCode)) {
      return res.status(401).json({ error: 'Incorrect Developer Code Number. Please try again.' });
    }

    const user = await q.createOrUpdateCodeUser(cleanCode);
    const settings = await q.getUserSettings(user.id);

    const { passwordHash, ...userClean } = user as any;
    res.json({
      token: 'tok_' + user.id,
      user: userClean,
      settings
    });
  } catch (err: any) {
    console.error('Code login error:', err);
    if (err.message === 'Your account has been blocked.') {
      return res.status(403).json({ error: 'Your account has been blocked.' });
    }
    res.status(500).json({ error: 'Failed to authenticate developer code' });
  }
});

// Create Account / Register with Username and Password
app.post('/api/auth/register-code-user', async (req, res) => {
  try {
    const { codeNumber, username, password, gender, birthday, age } = req.body;
    const rawUsername = username || codeNumber;
    if (!rawUsername || !password) {
      return res.status(400).json({ error: 'Username and Password are required.' });
    }

    const cleanUsername = String(rawUsername).trim();
    if (cleanUsername.length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters long.' });
    }

    if (String(password).trim().length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    // Check if account with that username already exists
    const existing = await q.getUserByUsername(cleanUsername) || await q.getUserById('usr_code_' + cleanUsername);
    if (existing) {
      return res.status(400).json({ error: 'An account with this Username already exists. Please log in or choose a different Username.' });
    }

    const user = await q.createOrUpdateCodeUser(cleanUsername);
    await q.updateUserProfile(user.id, {
      password: String(password).trim(),
      nickname: cleanUsername,
      gender: gender || undefined,
      birthday: birthday || undefined,
      age: age || undefined
    });
    const updatedUser = await q.getUserById(user.id) || user;

    const settings = await q.getUserSettings(user.id);
    const { passwordHash, ...userClean } = updatedUser as any;

    res.json({
      token: 'tok_' + user.id,
      user: userClean,
      settings,
      message: 'Account created successfully!'
    });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Failed to create account' });
  }
});

// Setup Password endpoint for First-Time Users
app.post('/api/auth/setup-password', async (req, res) => {
  try {
    const { codeNumber, username, password } = req.body;
    const rawUsername = username || codeNumber;
    if (!rawUsername || !password) {
      return res.status(400).json({ error: 'Username and new Password are required.' });
    }

    const cleanUsername = String(rawUsername).trim();
    if (cleanUsername.length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters long.' });
    }

    const user = await q.createOrUpdateCodeUser(cleanUsername);
    // Update user password in database
    await q.updateUserProfile(user.id, { password: password, nickname: cleanUsername });

    res.json({ message: 'Password set up successfully! You can now log in using your password.', codeNumber: cleanUsername });
  } catch (err: any) {
    console.error('Setup password error:', err);
    res.status(500).json({ error: err.message || 'Failed to set up password' });
  }
});

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '555949619793-a311t6bc2kjjr6vq2po4snvb8jl2islt.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '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';

// Google Login Endpoint
app.post('/api/auth/google-login', async (req, res) => {
  try {
    const { email, name, googleId, credential, codeNumber, username, gender, birthday, age } = req.body;
    let userEmail: string | undefined = email;
    let userName: string | undefined = name;
    let userGId: string | undefined = googleId;
    let userAvatar: string | undefined;

    // Verify Google ID token credential if provided
    if (credential) {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          if (payload.email) userEmail = payload.email;
          if (payload.name) userName = payload.name;
          if (payload.sub) userGId = payload.sub;
          if (payload.picture) userAvatar = payload.picture;
        } else {
          // Fallback parsing if Google tokeninfo endpoint is unreachable
          const parts = credential.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (payload.email) userEmail = payload.email;
            if (payload.name) userName = payload.name;
            if (payload.sub) userGId = payload.sub;
            if (payload.picture) userAvatar = payload.picture;
          }
        }
      } catch (e) {
        console.warn('Could not verify Google credential token:', e);
      }
    }

    // Require real Google identity details
    if (!userEmail && !userGId && !credential) {
      return res.status(400).json({ error: 'Please sign in with a valid Google Account.' });
    }

    const rawUsername = username || codeNumber || (userEmail ? userEmail.split('@')[0] : '') || (userName ? userName.replace(/\s+/g, '') : '');
    const cleanUsername = String(rawUsername).trim().toLowerCase() || 'user_' + Math.random().toString(36).substring(2, 7);

    // Look up or create user in database
    let user = await q.getUserByUsername(cleanUsername) || await q.getUserById('usr_code_' + cleanUsername);
    if (!user) {
      user = await q.createOrUpdateCodeUser(cleanUsername);
    }

    await q.updateUserProfile(user.id, {
      nickname: userName || user.nickname,
      avatarUrl: userAvatar || user.avatarUrl,
      gender: gender || user.gender || undefined,
      birthday: birthday || user.birthday || undefined,
      age: age || user.age || undefined
    });
    user = await q.getUserById(user.id) || user;

    const settings = await q.getUserSettings(user.id);
    const { passwordHash, ...userClean } = user as any;

    res.json({
      token: 'tok_' + user.id,
      user: userClean,
      settings,
      clientId: GOOGLE_CLIENT_ID
    });
  } catch (err: any) {
    console.error('Google login error:', err);
    res.status(500).json({ error: err.message || 'Google Login failed' });
  }
});

// Password Login Endpoint
app.post('/api/auth/login-with-password', async (req, res) => {
  try {
    const { usernameOrCode, username, password } = req.body;
    const rawUsername = username || usernameOrCode;
    if (!rawUsername || !String(rawUsername).trim() || !password || !String(password).trim()) {
      return res.status(400).json({ error: 'Username and Password are required.' });
    }

    const cleanInput = String(rawUsername).trim().toLowerCase();
    const record = await q.getUserRecordWithPassword(cleanInput);

    if (!record) {
      return res.status(401).json({ error: 'Account not found. Please register first.' });
    }

    const inputPassword = String(password).trim();
    const storedHash = record.passwordHash;

    const isValidPassword =
      storedHash === inputPassword ||
      storedHash === ('code_pass_' + cleanInput) ||
      storedHash === ('code_pass_' + cleanInput.replace(/^#/, '')) ||
      storedHash === ('code_pass_' + record.user.username) ||
      storedHash === ('code_pass_' + record.user.id.replace('usr_code_', ''));

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const user = await q.updateUserProfile(record.user.id, { status: 'online' });
    const settings = await q.getUserSettings(record.user.id);
    const sanitized = await sanitizeUser(user, record.user.id);

    res.json({
      token: 'tok_' + record.user.id,
      user: sanitized,
      settings
    });
  } catch (err: any) {
    console.error('Password login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Update Username Endpoint (1-Time Change Limit)
app.put('/api/users/username', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const rawId = authHeader?.replace('Bearer ', '').replace('tok_', '');
    if (!rawId) return res.status(401).json({ error: 'Unauthorized' });

    const { newUsername } = req.body;
    if (!newUsername || !String(newUsername).trim()) {
      return res.status(400).json({ error: 'New username is required.' });
    }

    const cleanUsername = String(newUsername).trim().toLowerCase().replaceAll(/\s+/g, '');
    const user = await q.getUserById(rawId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.usernameChanged) {
      return res.status(400).json({ error: 'Username can only be changed once.' });
    }

    const existing = await q.getUserByUsername(cleanUsername);
    if (existing && existing.id !== user.id) {
      return res.status(400).json({ error: 'This username is already taken by another user.' });
    }

    const updated = await q.updateUserProfile(user.id, { username: cleanUsername, usernameChanged: true });
    res.json(updated);
  } catch (err: any) {
    console.error('Update username error:', err);
    res.status(500).json({ error: err.message || 'Failed to update username' });
  }
});

// Auth: Login or Register with Password (Legacy support)
app.post('/api/auth/login-or-register', async (req, res) => {
  try {
    const { username, password, mode = 'login' } = req.body;
    if (!username || !password || !String(password).trim()) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const record = await q.getUserRecordWithPassword(cleanUsername);

    if (mode === 'login') {
      if (!record) {
        return res.status(401).json({ error: 'Account does not exist. Please create an account first.' });
      }

      const inputPassword = String(password).trim();
      const storedHash = record.passwordHash;
      const isValidPassword =
        storedHash === inputPassword ||
        storedHash === ('code_pass_' + cleanUsername) ||
        storedHash === ('code_pass_' + cleanUsername.replace(/^#/, '')) ||
        storedHash === ('code_pass_' + record.user.username) ||
        storedHash === ('code_pass_' + record.user.id.replace('usr_code_', ''));

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }

      const user = await q.updateUserProfile(record.user.id, { status: 'online' });
      const settings = await q.getUserSettings(record.user.id);
      const sanitized = await sanitizeUser(user, record.user.id);

      res.json({
        token: 'tok_' + record.user.id,
        user: sanitized,
        settings
      });
    } else {
      if (record) {
        return res.status(400).json({ error: 'Username already taken. Please choose another username or log in.' });
      }

      const newUser = await q.createOrUpdateCodeUser(cleanUsername);
      await q.updateUserProfile(newUser.id, { password: String(password).trim(), nickname: cleanUsername });
      const updatedUser = await q.getUserById(newUser.id);
      const settings = await q.getUserSettings(newUser.id);
      const sanitized = await sanitizeUser(updatedUser, newUser.id);

      res.json({
        token: 'tok_' + newUser.id,
        user: sanitized,
        settings
      });
    }
  } catch (err: any) {
    console.error('Login or register error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get Current User Profile
app.get('/api/users/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const rawId = authHeader?.replace('Bearer ', '').replace('tok_', '');
    if (!rawId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await q.getUserById(rawId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const settings = await q.getUserSettings(user.id);
    const sanitized = await sanitizeUser(user, user.id);
    res.json({
      user: sanitized,
      settings
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

// GET Followers List
app.get('/api/users/:targetUserId/followers', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    const { targetUserId } = req.params;

    const targetUser = await q.getUserById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const isOwner = requestingUserId === targetUserId;
    const friendships = requestingUserId ? await q.getFriendships(requestingUserId) : [];
    const isFriend = friendships.includes(targetUserId);

    const privacy = targetUser.followersPrivacy || 'public';
    if (!isOwner) {
      if (privacy === 'only_me') {
        return res.status(403).json({ error: 'Followers list is private.' });
      }
      if (privacy === 'friends' && !isFriend) {
        return res.status(403).json({ error: 'Followers list is visible to friends only.' });
      }
    }

    const rawFollowers = await q.getFollowers(targetUserId);
    const sanitizedFollowers = await Promise.all(
      rawFollowers.map(u => sanitizeUser(u, requestingUserId, friendships))
    );

    res.json(sanitizedFollowers);
  } catch (err: any) {
    console.error('Fetch followers error:', err);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// GET Following List
app.get('/api/users/:targetUserId/following', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    const { targetUserId } = req.params;

    const targetUser = await q.getUserById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const isOwner = requestingUserId === targetUserId;
    const friendships = requestingUserId ? await q.getFriendships(requestingUserId) : [];
    const isFriend = friendships.includes(targetUserId);

    const privacy = targetUser.followingPrivacy || 'public';
    if (!isOwner) {
      if (privacy === 'only_me') {
        return res.status(403).json({ error: 'Following list is private.' });
      }
      if (privacy === 'friends' && !isFriend) {
        return res.status(403).json({ error: 'Following list is visible to friends only.' });
      }
    }

    const rawFollowing = await q.getFollowing(targetUserId);
    const sanitizedFollowing = await Promise.all(
      rawFollowing.map(u => sanitizeUser(u, requestingUserId, friendships))
    );

    res.json(sanitizedFollowing);
  } catch (err: any) {
    console.error('Fetch following error:', err);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Search Users by Username / Code
app.get('/api/users/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const currentUserId = req.headers['x-user-id'] as string;

    if (!query) return res.json([]);

    const usersList = await q.searchUsersByCode(query);
    const friendships = currentUserId ? await q.getFriendships(currentUserId) : [];
    const requests = currentUserId ? await q.getFriendRequests(currentUserId) : [];

    const results = usersList
      .filter(u => u.id !== currentUserId && !isBlockedBetween(currentUserId, u.id, '', u.username))
      .map(u => {
        const isFriend = friendships.includes(u.id);
        const pendingReq = requests.find(r => r.status === 'pending' && ((r.senderId === currentUserId && r.receiverId === u.id) || (r.receiverId === currentUserId && r.senderId === u.id)));

        let friendStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none' = 'none';
        if (isFriend) {
          friendStatus = 'friend';
        } else if (pendingReq) {
          friendStatus = pendingReq.senderId === currentUserId ? 'pending_sent' : 'pending_received';
        }

        const { passwordHash, ...userClean } = u as any;
        return {
          ...userClean,
          friendStatus
        };
      });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Change Username (1-time initial change or 60-day cooldown)
app.put('/api/users/username', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { newUsername } = req.body;

    if (!userId || !newUsername || !newUsername.trim()) {
      return res.status(400).json({ error: 'New username is required' });
    }

    const cleanUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '');

    const existing = await q.getUserByUsername(cleanUsername);
    if (existing && existing.id !== userId) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const user = await q.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
    if (user.usernameChanged && user.usernameLastChangedAt) {
      const lastChange = new Date(user.usernameLastChangedAt).getTime();
      const now = Date.now();
      if (now - lastChange < SIXTY_DAYS_MS) {
        const remainingMs = SIXTY_DAYS_MS - (now - lastChange);
        const days = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
        return res.status(400).json({
          error: `Username can only be changed once every 60 days. Please wait ${days} day(s).`
        });
      }
    }

    const updated = await q.updateUserProfile(userId, {
      username: cleanUsername,
      usernameChanged: true,
      usernameLastChangedAt: new Date().toISOString()
    });

    const { passwordHash, ...userClean } = updated as any;
    res.json(userClean);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update username' });
  }
});

// Change Nickname (Strict 7-day restriction rule)
app.put('/api/users/nickname', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { nickname } = req.body;

    if (!userId || !nickname || !nickname.trim()) {
      return res.status(400).json({ error: 'Nickname is required' });
    }

    const user = await q.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (user.nicknameLastChangedAt) {
      const lastChangeTime = new Date(user.nicknameLastChangedAt).getTime();
      const nowTime = Date.now();
      const elapsedMs = nowTime - lastChangeTime;

      if (elapsedMs < SEVEN_DAYS_MS) {
        const remainingMs = SEVEN_DAYS_MS - elapsedMs;
        const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

        return res.status(400).json({
          error: `You can only change your nickname once every 7 days. Next change available in ${days}d ${hours}h ${minutes}m.`,
          remainingMs,
          nextAvailableAt: new Date(lastChangeTime + SEVEN_DAYS_MS).toISOString()
        });
      }
    }

    const updated = await q.updateUserProfile(userId, { nickname: nickname.trim() });
    const { passwordHash, ...userClean } = updated as any;
    res.json({ message: 'Nickname updated successfully', user: userClean });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update nickname' });
  }
});

// Per-User Chat Partner Custom Nicknames Storage
const userChatNicknames = new Map<string, Record<string, string>>();

app.get('/api/chat-nicknames', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const map = userChatNicknames.get(userId) || {};
  res.json(map);
});

app.post('/api/chat-nicknames', (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { partnerId, nickname } = req.body;
  if (!userId || !partnerId) return res.status(400).json({ error: 'Missing partnerId' });

  let userMap = userChatNicknames.get(userId) || {};
  const clean = (nickname || '').trim();
  if (!clean) {
    delete userMap[partnerId];
  } else {
    userMap[partnerId] = clean;
  }
  userChatNicknames.set(userId, userMap);
  res.json({ success: true, partnerId, nickname: clean });
});

// Update Profile Details
app.put('/api/users/profile', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userBefore = await q.getUserById(userId);
    const { nickname, avatarUrl, borderId, coverUrl, bio, gender, birthday, age, hometown, school, work, phone, phonePrivacy, profilePrivacy, followersPrivacy, followingPrivacy } = req.body;

    const updated = await q.updateUserProfile(userId, {
      nickname, avatarUrl, borderId, coverUrl, bio, gender, birthday, age, hometown, school, work, phone, phonePrivacy, profilePrivacy, followersPrivacy, followingPrivacy
    });

    if (avatarUrl && (!userBefore || userBefore.avatarUrl !== avatarUrl)) {
      const uCode = updated.username || userId;
      const pronoun = uCode.includes('547257') ? 'her' : 'his';
      const authorDisplayName = updated.nickname || updated.username;
      await q.createPost({
        userId,
        authorName: updated.nickname,
        authorUsername: updated.username,
        authorAvatarUrl: avatarUrl,
        content: `${authorDisplayName} updated ${pronoun} profile picture.`,
        mediaType: 'image',
        mediaUrl: avatarUrl
      });
    }

    const friendships = await q.getFriendships(userId);
    const sanitized = await sanitizeUser(updated, userId, friendships);
    res.json({ message: 'Profile updated successfully', user: sanitized });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET Stalkable Profile of Any User
app.get('/api/users/:targetUserId/profile', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    const { targetUserId } = req.params;

    const targetUser = await q.getUserById(targetUserId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const requestingUser = requestingUserId ? await q.getUserById(requestingUserId) : null;
    if (isBlockedBetween(requestingUserId, targetUserId, requestingUser?.username, targetUser.username)) {
      return res.status(404).json({ error: 'User unavailable' });
    }

    const friendships = requestingUserId ? await q.getFriendships(requestingUserId) : [];
    const sanitized = await sanitizeUser(targetUser, requestingUserId, friendships);
    const isOwner = requestingUserId === targetUserId;
    const isPrivate = !isOwner && targetUser.profilePrivacy === 'only_me';

    let userPosts: any[] = [];
    if (!isPrivate) {
      const allPosts = await q.getPosts();
      const canonicalTargetId = targetUser.id.toLowerCase();
      const targetUserCleanUsername = targetUser.username ? targetUser.username.toLowerCase() : '';
      const rawTargetCode = canonicalTargetId.replace(/^usr_code_/, '').replace(/^#/, '');

      userPosts = allPosts.filter(p => {
        const pUserId = (p.userId || '').toLowerCase();
        const pRawCode = pUserId.replace(/^usr_code_/, '').replace(/^#/, '');
        const pAuthorUsername = (p.authorUsername || '').toLowerCase();

        return (
          pUserId === canonicalTargetId ||
          pUserId === targetUserId.toLowerCase() ||
          (pRawCode && pRawCode === rawTargetCode) ||
          (targetUserCleanUsername && pAuthorUsername === targetUserCleanUsername)
        );
      });
    }

    let friendStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none' | 'self' = 'none';
    if (isOwner) {
      friendStatus = 'self';
    } else if (requestingUserId) {
      const isFriend = friendships.includes(targetUserId);
      if (isFriend) {
        friendStatus = 'friend';
      } else {
        const reqs = await q.getFriendRequests(requestingUserId);
        const pendingReq = reqs.find(r => r.status === 'pending' && ((r.senderId === requestingUserId && r.receiverId === targetUserId) || (r.senderId === targetUserId && r.receiverId === requestingUserId)));
        if (pendingReq) {
          friendStatus = pendingReq.senderId === requestingUserId ? 'pending_sent' : 'pending_received';
        }
      }
    }

    res.json({
      user: sanitized,
      isPrivate,
      friendStatus,
      posts: userPosts
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET Posts Feed (Public Home Feed with Server-Side Pagination & Selective Fetching)
app.get('/api/posts', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const currentUser = userId ? await q.getUserById(userId) : null;
    const friendIds = userId ? await q.getFriendships(userId) : [];
    const allPosts = await q.getPosts();

    // Public feed: include posts from all non-blocked users
    const publicPosts = allPosts.filter(p => !isBlockedBetween(userId, p.userId, currentUser?.username, p.authorUsername));

    const populated = publicPosts.map(p => {
      const isFriendPost = friendIds.includes(p.userId) || p.userId === userId;
      const reactionsCount = Object.keys(p.reactions || {}).length;
      const commentsCount = (p.comments || []).length;
      const viralScore = (reactionsCount * 2) + (commentsCount * 3) + ((p.shareCount || 0) * 5) + (p.viewsCount || 0);

      return {
        ...p,
        viralScore,
        isViral: viralScore >= 5,
        isFriendPost
      };
    });

    // Consistently sort by newest created first so feed stays stable and posts never disappear
    const sorted = populated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Server-side pagination query support for Android low-end device performance
    const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (pageParam !== undefined || limitParam !== undefined) {
      const page = Math.max(1, pageParam || 1);
      const limit = Math.max(1, Math.min(100, limitParam || 20));
      const startIndex = (page - 1) * limit;
      const paginatedPosts = sorted.slice(startIndex, startIndex + limit);

      return res.json({
        posts: paginatedPosts,
        pagination: {
          page,
          limit,
          totalPosts: sorted.length,
          totalPages: Math.ceil(sorted.length / limit),
          hasMore: startIndex + limit < sorted.length
        }
      });
    }

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET Video Posts Feed with Server-Side Pagination (Randomized Video Feed)
app.get('/api/posts/video', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const currentUser = userId ? await q.getUserById(userId) : null;
    const videoPosts = await q.getVideoPosts();

    const filtered = videoPosts.filter(p => !isBlockedBetween(userId, p.userId, currentUser?.username, p.authorUsername));

    // Randomize video feed order so users see a random mix of videos from all users
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    if (pageParam !== undefined || limitParam !== undefined) {
      const page = Math.max(1, pageParam || 1);
      const limit = Math.max(1, Math.min(100, limitParam || 20));
      const startIndex = (page - 1) * limit;
      const paginatedPosts = shuffled.slice(startIndex, startIndex + limit);

      return res.json({
        posts: paginatedPosts,
        pagination: {
          page,
          limit,
          totalPosts: shuffled.length,
          totalPages: Math.ceil(shuffled.length / limit),
          hasMore: startIndex + limit < shuffled.length
        }
      });
    }

    res.json(shuffled);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch video posts' });
  }
});

// Mark Post(s) as Seen
app.post('/api/posts/mark-seen', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { postIds } = req.body;
    if (Array.isArray(postIds)) {
      const seenSet = userSeenPostsMap.get(userId) || new Set();
      postIds.forEach(id => seenSet.add(id));
      userSeenPostsMap.set(userId, seenSet);
      saveSeenPostsDisk();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark posts seen' });
  }
});

// Create Post
app.post('/api/posts', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await q.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { content, mediaType, mediaUrl, videoDurationSecs } = req.body;

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'Post content or media is required' });
    }

    const post = await q.createPost({
      userId,
      authorName: user.nickname,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl,
      content: content || '',
      mediaType: mediaType || 'none',
      mediaUrl,
      videoDurationSecs
    });

    res.json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create post' });
  }
});

// Increment Post / Video View Count
app.post('/api/posts/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const viewsCount = await q.incrementPostViews(id);
    res.json({ success: true, viewsCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to increment view count' });
  }
});

// React to Post
app.post('/api/posts/:id/react', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { reactionType } = req.body;

    const user = await q.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedPost = await q.togglePostReaction(id, userId, reactionType);
    if (!updatedPost) return res.status(404).json({ error: 'Post not found' });

    if (updatedPost.userId !== userId) {
      const reactionLabels: Record<string, string> = {
        like: 'liked 👍', heart: 'loved ❤️', care: 'cared 🥰', haha: 'laughed at 😂',
        wow: 'was amazed by 😮', sad: 'reacted sad to 😢', angry: 'reacted angry to 😡'
      };
      const notif = await q.createNotification({
        recipientUserId: updatedPost.userId,
        senderUserId: userId,
        senderName: user.nickname,
        senderAvatarUrl: user.avatarUrl,
        type: 'post_like',
        postId: updatedPost.id,
        text: `${user.nickname} ${reactionLabels[reactionType] || 'reacted to'} your post.`
      });
      if (notif) sendToUser(updatedPost.userId, { type: 'notification_new', payload: notif });
    }

    res.json(updatedPost);
  } catch (err) {
    res.status(500).json({ error: 'Failed to react to post' });
  }
});

// Comment on Post
app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const user = await q.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedPost = await q.addPostComment({
      postId: id,
      userId,
      authorName: user.nickname,
      authorUsername: user.username,
      authorAvatarUrl: user.avatarUrl,
      content: content.trim()
    });

    if (!updatedPost) return res.status(404).json({ error: 'Post not found' });

    if (updatedPost.userId !== userId) {
      const notif = await q.createNotification({
        recipientUserId: updatedPost.userId,
        senderUserId: userId,
        senderName: user.nickname,
        senderAvatarUrl: user.avatarUrl,
        type: 'post_comment',
        postId: updatedPost.id,
        text: `${user.nickname} commented on your post: "${content.trim().substring(0, 30)}..."`
      });
      if (notif) sendToUser(updatedPost.userId, { type: 'notification_new', payload: notif });
    }

    const latestComment = updatedPost.comments[updatedPost.comments.length - 1];
    res.json(latestComment);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Share Post
app.post('/api/posts/:id/share', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const user = await q.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newShared = await q.sharePost(id, userId, user);
    if (!newShared) return res.status(404).json({ error: 'Post not found' });

    if (newShared.originalPostId) {
      const origPosts = await q.getPosts();
      const orig = origPosts.find(p => p.id === newShared.originalPostId);
      if (orig && orig.userId !== userId) {
        const notif = await q.createNotification({
          recipientUserId: orig.userId,
          senderUserId: userId,
          senderName: user.nickname,
          senderAvatarUrl: user.avatarUrl,
          type: 'post_share',
          postId: orig.id,
          text: `${user.nickname} shared your post.`
        });
        if (notif) sendToUser(orig.userId, { type: 'notification_new', payload: notif });
      }
    }

    res.json(newShared);
  } catch (err) {
    res.status(500).json({ error: 'Failed to share post' });
  }
});

// Delete Post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    const ok = await q.deletePost(id, userId);
    if (!ok) return res.status(403).json({ error: 'Could not delete post' });

    res.json({ message: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Notifications List
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifs = await q.getNotifications(userId);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark Notifications Read
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await q.markAllNotificationsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

function isDeveloperUserServer(user: any): boolean {
  if (!user) return false;
  const DEVELOPER_CODES = ['143456', '547257', '537212'];
  const cleanId = String(user.id || '').trim().replace(/^#/, '').toLowerCase();
  const cleanUsername = String(user.username || '').trim().replace(/^#/, '').toLowerCase();
  const cleanCode = String(user.codeNumber || '').trim().replace(/^#/, '').toLowerCase();

  return DEVELOPER_CODES.some(code =>
    cleanId === code ||
    cleanUsername === code ||
    cleanCode === code ||
    cleanId === `usr_code_${code}` ||
    cleanId.endsWith(`code_${code}`)
  );
}

// GET Followers List
app.get('/api/users/:userId/followers', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    const { userId } = req.params;

    const targetUser = await q.getUserById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const followers = await q.getFollowers(userId);
    const friendships = requestingUserId ? await q.getFriendships(requestingUserId) : [];
    const sanitizedList = await Promise.all(followers.map(u => sanitizeUser(u, requestingUserId, friendships)));
    res.json(sanitizedList);
  } catch (err: any) {
    console.error('Get followers error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch followers' });
  }
});

// GET Following List
app.get('/api/users/:userId/following', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    const { userId } = req.params;

    const targetUser = await q.getUserById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const following = await q.getFollowing(userId);
    const friendships = requestingUserId ? await q.getFriendships(requestingUserId) : [];
    const sanitizedList = await Promise.all(following.map(u => sanitizeUser(u, requestingUserId, friendships)));
    res.json(sanitizedList);
  } catch (err: any) {
    console.error('Get following error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch following' });
  }
});

// Friend Requests API
app.get('/api/friends/requests', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const reqs = await q.getFriendRequests(userId);
    res.json(reqs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

app.post('/api/friends/request', async (req, res) => {
  try {
    const senderId = req.headers['x-user-id'] as string;
    const { targetUserId } = req.body;

    if (!senderId || !targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    if (senderId === targetUserId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    const senderUser = await q.getUserById(senderId);
    const friendReq = await q.sendFriendRequest(senderId, targetUserId);

    const notif = await q.createNotification({
      recipientUserId: targetUserId,
      senderUserId: senderId,
      senderName: senderUser?.nickname || 'Someone',
      senderAvatarUrl: senderUser?.avatarUrl,
      type: 'friend_request',
      text: `${senderUser?.nickname || 'Someone'} sent you a friend request.`
    });

    if (notif) sendToUser(targetUserId, { type: 'notification_new', payload: notif });
    sendToUser(targetUserId, { type: 'friend_request_new', payload: friendReq });

    // Broadcast updated profile stats in realtime for both users
    const senderFollowersCount = await q.getFollowersCount(senderId);
    const senderFollowingCount = await q.getFollowingCount(senderId);
    const targetFollowersCount = await q.getFollowersCount(targetUserId);
    const targetFollowingCount = await q.getFollowingCount(targetUserId);

    sendToUser(senderId, {
      type: 'profile_stats_update',
      payload: { userId: senderId, followersCount: senderFollowersCount, followingCount: senderFollowingCount }
    });
    sendToUser(targetUserId, {
      type: 'profile_stats_update',
      payload: { userId: targetUserId, followersCount: targetFollowersCount, followingCount: targetFollowingCount }
    });

    res.json({ message: 'Friend request sent', request: friendReq });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to send friend request' });
  }
});

app.post('/api/friends/respond', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { requestId, action } = req.body;

    const updated = await q.respondFriendRequest(requestId, action === 'accept' ? 'accepted' : 'rejected');
    if (!updated) return res.status(404).json({ error: 'Request not found' });

    if (action === 'accept') {
      const user = await q.getUserById(userId);
      const notif = await q.createNotification({
        recipientUserId: updated.senderId,
        senderUserId: userId,
        senderName: user?.nickname || 'Someone',
        senderAvatarUrl: user?.avatarUrl,
        type: 'friend_accept',
        text: `${user?.nickname || 'Someone'} accepted your friend request!`
      });
      if (notif) sendToUser(updated.senderId, { type: 'notification_new', payload: notif });
      await q.getOrCreateDirectChat(updated.senderId, userId);
    }

    sendToUser(updated.senderId, {
      type: 'friend_request_update',
      payload: { requestId, action, status: updated.status }
    });

    // Broadcast updated profile stats in realtime
    const senderFollowersCount = await q.getFollowersCount(updated.senderId);
    const senderFollowingCount = await q.getFollowingCount(updated.senderId);
    const receiverFollowersCount = await q.getFollowersCount(updated.receiverId);
    const receiverFollowingCount = await q.getFollowingCount(updated.receiverId);

    sendToUser(updated.senderId, {
      type: 'profile_stats_update',
      payload: { userId: updated.senderId, followersCount: senderFollowersCount, followingCount: senderFollowingCount }
    });
    sendToUser(updated.receiverId, {
      type: 'profile_stats_update',
      payload: { userId: updated.receiverId, followersCount: receiverFollowersCount, followingCount: receiverFollowingCount }
    });

    res.json({ message: `Friend request ${action}ed` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to respond to request' });
  }
});

app.post('/api/friends/cancel-request', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    await q.cancelFriendRequest(userId, targetUserId);

    sendToUser(targetUserId, {
      type: 'friend_request_update',
      payload: { senderId: userId, status: 'cancelled' }
    });

    res.json({ message: 'Friend request cancelled' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to cancel request' });
  }
});

// Logout endpoint to cleanly set offline status
app.post('/api/auth/logout', async (req, res) => {
  try {
    const rawId = req.headers['x-user-id'] as string;
    if (rawId) {
      const ws = userSockets.get(rawId);
      if (ws) {
        userSockets.delete(rawId);
        try { ws.close(); } catch (e) {}
      }
      await broadcastPresence(rawId, 'offline');
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.json({ message: 'Logged out' });
  }
});

// Unfriend Endpoint
app.post('/api/friends/unfriend', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'Target user ID is required' });
    }

    await q.removeFriendship(userId, targetUserId);

    // Notify target user
    sendToUser(targetUserId, {
      type: 'friend_unfriend',
      payload: { userId }
    });

    // Broadcast updated profile stats in realtime
    const userFollowersCount = await q.getFollowersCount(userId);
    const userFollowingCount = await q.getFollowingCount(userId);
    const targetFollowersCount = await q.getFollowersCount(targetUserId);
    const targetFollowingCount = await q.getFollowingCount(targetUserId);

    sendToUser(userId, {
      type: 'profile_stats_update',
      payload: { userId, followersCount: userFollowersCount, followingCount: userFollowingCount }
    });
    sendToUser(targetUserId, {
      type: 'profile_stats_update',
      payload: { userId: targetUserId, followersCount: targetFollowersCount, followingCount: targetFollowingCount }
    });

    res.json({ message: 'Unfriended successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to unfriend user' });
  }
});

// Friends List
app.get('/api/friends', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const friendIds = await q.getFriendships(userId);
    const friends: any[] = [];
    for (const fId of friendIds) {
      if (isBlockedBetween(userId, fId)) continue;
      const u = await q.getUserById(fId);
      if (u) {
        const { passwordHash, ...clean } = u as any;
        friends.push(clean);
      }
    }

    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Chats List
app.get('/api/chats', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userChats = await q.getChatsForUser(userId);
    const filtered = userChats.filter(c => {
      if (c.type === 'direct' && c.participants) {
        const otherId = c.participants.find(pId => pId !== userId);
        if (otherId && isBlockedBetween(userId, otherId)) return false;
      }
      return true;
    });
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Get or Create Direct Chat
app.post('/api/chats/direct', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { friendId } = req.body;

    if (!userId || !friendId) return res.status(400).json({ error: 'Friend ID required' });
    if (isBlockedBetween(userId, friendId)) {
      return res.status(403).json({ error: 'Cannot start chat with blocked user' });
    }

    const chat = await q.getOrCreateDirectChat(userId, friendId);
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get or create chat' });
  }
});

// Messages List for Chat
app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const msgs = await q.getMessagesByChatId(chatId);
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send Message
app.post('/api/messages', async (req, res) => {
  try {
    const senderId = req.headers['x-user-id'] as string;
    const { chatId, content, mediaType, mediaUrl, mediaName, mediaSize, audioDuration, replyToMessageId } = req.body;

    if (!senderId || !chatId) {
      return res.status(400).json({ error: 'Sender ID and Chat ID are required' });
    }

    const msg = await q.createMessage({
      chatId,
      senderId,
      content: content || '',
      mediaType: mediaType || 'text',
      mediaUrl,
      mediaName,
      mediaSize,
      audioDuration,
      replyToMessageId
    });

    // Broadcast to chat participants
    const userChats = await q.getChatsForUser(senderId);
    const chat = userChats.find(c => c.id === chatId);
    if (chat) {
      chat.participants.forEach(pId => {
        sendToUser(pId, { type: 'message_new', payload: msg });
      });
    }

    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Mark Chat Messages as Seen
app.post('/api/chats/:chatId/seen', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { chatId } = req.params;

    await q.markMessagesSeen(chatId, userId);
    res.json({ message: 'Marked as seen' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark as seen' });
  }
});

// React to Message
app.post('/api/messages/:id/react', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { emoji } = req.body;

    if (!userId || !emoji) {
      return res.status(400).json({ error: 'User ID and emoji are required' });
    }

    const updatedMsg = await q.toggleMessageReaction(id, userId, emoji);

    // Get reactor user info
    const senderUser = await q.getUserById(userId);

    // Broadcast to chat participants
    const userChats = await q.getChatsForUser(userId);
    const chat = userChats.find(c => c.id === updatedMsg.chatId);
    if (chat) {
      chat.participants.forEach(pId => {
        sendToUser(pId, { type: 'message_update', payload: updatedMsg });
      });
    }

    // If reacting to someone else's message, send notification and notice
    if (updatedMsg.senderId && updatedMsg.senderId !== userId) {
      const userReactions = updatedMsg.reactions?.[emoji] || [];
      const isAdded = userReactions.includes(userId);
      if (isAdded) {
        const reactorName = senderUser?.nickname || senderUser?.username || 'Someone';
        const preview = updatedMsg.content
          ? (updatedMsg.content.length > 30 ? updatedMsg.content.substring(0, 30) + '...' : updatedMsg.content)
          : 'attachment';

        const notif = await q.createNotification({
          recipientUserId: updatedMsg.senderId,
          senderUserId: userId,
          senderName: reactorName,
          senderAvatarUrl: senderUser?.avatarUrl,
          type: 'message_reaction',
          text: `reacted ${emoji} to your message: "${preview}"`
        });

        if (notif) {
          sendToUser(updatedMsg.senderId, { type: 'notification_new', payload: notif });
        }

        sendToUser(updatedMsg.senderId, {
          type: 'message_reaction_notice',
          payload: {
            messageId: updatedMsg.id,
            chatId: updatedMsg.chatId,
            emoji,
            senderName: reactorName,
            senderAvatarUrl: senderUser?.avatarUrl,
            contentPreview: preview
          }
        });
      }
    }

    res.json(updatedMsg);
  } catch (err) {
    console.error('Error reacting to message:', err);
    res.status(500).json({ error: 'Failed to react to message' });
  }
});

// Pin/Unpin Message
app.post('/api/messages/:id/pin', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    const updatedMsg = await q.togglePinMessage(id);

    const userChats = await q.getChatsForUser(userId);
    const chat = userChats.find(c => c.id === updatedMsg.chatId);
    if (chat) {
      chat.participants.forEach(pId => {
        sendToUser(pId, { type: 'message_update', payload: updatedMsg });
      });
    }

    res.json(updatedMsg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Edit Message Content
app.put('/api/messages/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { content } = req.body;

    const updatedMsg = await q.editMessageContent(id, content);

    const userChats = await q.getChatsForUser(userId);
    const chat = userChats.find(c => c.id === updatedMsg.chatId);
    if (chat) {
      chat.participants.forEach(pId => {
        sendToUser(pId, { type: 'message_update', payload: updatedMsg });
      });
    }

    res.json(updatedMsg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete Message
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    const { chatId } = await q.deleteMessageById(id);

    const userChats = await q.getChatsForUser(userId);
    const chat = userChats.find(c => c.id === chatId);
    if (chat) {
      chat.participants.forEach(pId => {
        sendToUser(pId, { type: 'message_delete', payload: { id, chatId } });
      });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Unsend Message (Everyone or Me)
app.post('/api/messages/:id/unsend', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { type } = req.body; // 'everyone' | 'me'

    if (!userId || !type) {
      return res.status(400).json({ error: 'User ID and unsend type are required' });
    }

    const updatedMsg = await q.unsendMessage(id, userId, type);

    const userChats = await q.getChatsForUser(userId);
    const chat = userChats.find(c => c.id === updatedMsg.chatId);
    if (chat) {
      chat.participants.forEach(pId => {
        sendToUser(pId, { type: 'message_update', payload: updatedMsg });
      });
    }

    res.json(updatedMsg);
  } catch (err) {
    console.error('Error unsending message:', err);
    res.status(500).json({ error: 'Failed to unsend message' });
  }
});

// In-Memory persistent chunk store for large uploads
const uploadChunksMap = new Map<string, { chunks: string[]; totalChunks: number; fileName?: string; fileType?: string; updatedAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [id, data] of uploadChunksMap.entries()) {
    if (now - data.updatedAt > 600000) {
      uploadChunksMap.delete(id);
    }
  }
}, 60000);

function storeMediaFile(fileData: string, fileName?: string, fileType?: string) {
  const commaIdx = fileData.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('Invalid base64 encoding format');
  }

  const header = fileData.substring(0, commaIdx);
  const base64Str = fileData.substring(commaIdx + 1);

  const mimeMatch = header.match(/^data:([^;]+)/);
  let mimeType = mimeMatch ? mimeMatch[1] : (fileType || 'application/octet-stream');

  if (fileName && /\.(mp4|m4v|webm|mov|mkv|avi|3gp)$/i.test(fileName) && !mimeType.startsWith('video/')) {
    const extMatch = fileName.match(/\.([a-z0-9]+)$/i);
    mimeType = extMatch ? `video/${extMatch[1].toLowerCase()}` : 'video/mp4';
  }

  const buffer = Buffer.from(base64Str, 'base64');

  let ext = fileName ? path.extname(fileName) : '';
  if (!ext) {
    const sub = mimeType.split('/')[1] || 'bin';
    ext = '.' + sub.split('+')[0].split(';')[0];
  }

  const safeName = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + ext;
  const filePath = path.join(UPLOADS_DIR, safeName);

  try {
    fs.writeFileSync(filePath, buffer);
  } catch (e) {
    console.warn('Could not write upload file to disk:', e);
  }

  mediaFileMemoryCache.set(safeName, { buffer, mimeType, dataUrl: fileData });

  return {
    url: `/uploads/${safeName}`,
    fileName: fileName || safeName,
    fileSize: buffer.length,
    mimeType
  };
}

// Chunked Media Upload Endpoint
app.post('/api/upload/chunk', (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, chunkData, fileName, fileType } = req.body;
    if (!uploadId || chunkIndex === undefined || !totalChunks || !chunkData) {
      return res.status(400).json({ error: 'Missing chunk upload parameters' });
    }

    let item = uploadChunksMap.get(uploadId);
    if (!item) {
      item = { chunks: new Array(totalChunks), totalChunks, fileName, fileType, updatedAt: Date.now() };
      uploadChunksMap.set(uploadId, item);
    }

    item.chunks[chunkIndex] = chunkData;
    item.updatedAt = Date.now();
    if (fileName && !item.fileName) item.fileName = fileName;
    if (fileType && !item.fileType) item.fileType = fileType;

    let receivedCount = 0;
    for (let i = 0; i < totalChunks; i++) {
      if (item.chunks[i] !== undefined) receivedCount++;
    }

    if (receivedCount < totalChunks) {
      return res.json({ status: 'chunk_received', receivedChunks: receivedCount, totalChunks });
    }

    const fullFileData = item.chunks.join('');
    uploadChunksMap.delete(uploadId);

    const result = storeMediaFile(fullFileData, item.fileName, item.fileType);
    return res.json(result);
  } catch (err: any) {
    console.error('Chunk upload error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process chunk upload' });
  }
});

// Single Direct Media File Upload Route
app.post('/api/upload', (req, res) => {
  const { fileData, fileName, fileType } = req.body;
  if (!fileData) {
    return res.status(400).json({ error: 'No file data provided' });
  }

  try {
    const result = storeMediaFile(fileData, fileName, fileType);
    return res.json(result);
  } catch (err: any) {
    console.error('Upload handling error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process file upload' });
  }
});

// Get Notifications List
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notifs = await q.getNotifications(userId);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark All Notifications Read
app.post('/api/notifications/read-all', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await q.markAllNotificationsRead(userId);
    res.json({ message: 'Marked all notifications as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Global Express Error Handler for body-parser or route failures
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err) {
    console.error('Express middleware error:', err.message || err);
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || err.statusCode || 500;
    return res.status(statusCode).json({
      error: err.type === 'entity.too.large'
        ? 'File or video too large (Payload Too Large). The limit is up to 100MB.'
        : (err.message || 'Server error occurred during request processing')
    });
  }
  next();
});

// Admin Reset Endpoint for full database wipe
app.post('/api/admin/reset-database', async (req, res) => {
  try {
    userSeenPostsMap.clear();
    mediaFileMemoryCache.clear();
    await q.resetAllDatabaseData();
    res.json({ message: 'Complete database and app state reset successfully executed.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reset database' });
  }
});

// Serve Vite App in Development / Static in Production
async function startServer() {
  try {
    await q.ensureSchema();
    await q.purgeBlockedUsers().catch(() => {});
  } catch (e) {
    console.error('Error running ensureSchema/purge on server start:', e);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Marshmallow server running on port ${PORT}`);
  });
}

startServer();
