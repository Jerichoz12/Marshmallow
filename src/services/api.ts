import { User, UserSettings, Chat, Message, FriendRequest, WsMessage, Post, AppNotification, PostReactionType, PhonePrivacy, ProfilePrivacy, ListPrivacy } from '../types';

let currentUserToken: string | null = null;
let currentUserId: string | null = null;

// Initialize token from localStorage if available
try {
  currentUserToken = localStorage.getItem('marshmallow_token');
  currentUserId = localStorage.getItem('marshmallow_user_id');
} catch (e) {
  // Ignore
}

export function setAuthToken(token: string, userId: string) {
  currentUserToken = token;
  currentUserId = userId;
  try {
    localStorage.setItem('marshmallow_token', token);
    localStorage.setItem('marshmallow_user_id', userId);
  } catch (e) {
    // Ignore
  }
}

export function clearAuthToken() {
  currentUserToken = null;
  currentUserId = null;
  try {
    localStorage.removeItem('marshmallow_token');
    localStorage.removeItem('marshmallow_user_id');
    localStorage.removeItem('marshmallow_user');
    localStorage.removeItem('user_data');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_id');
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {
    // Ignore
  }
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

function getHeaders() {
  const userId = getCurrentUserId();
  return {
    'Content-Type': 'application/json',
    'Authorization': currentUserToken ? `Bearer ${currentUserToken}` : '',
    'x-user-id': userId || ''
  };
}

// REST Client API
export async function registerCodeUser(username: string, password: string, gender?: string, birthday?: string, age?: string): Promise<{ token: string; user: User; settings: UserSettings; message: string }> {
  const res = await fetch('/api/auth/register-code-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, codeNumber: username, password, gender, birthday, age })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Bigo sa paggawa ng account');
  }

  setAuthToken(data.token, data.user.id);
  return data;
}

export async function loginWithCodeNumber(codeNumber: string, secretAnswer?: string): Promise<{ token: string; user: User; settings: UserSettings }> {
  const res = await fetch('/api/auth/code-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeNumber, secretAnswer })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  setAuthToken(data.token, data.user.id);
  return data;
}

export async function setupUserPassword(codeNumber: string, password: string): Promise<{ message: string; codeNumber: string }> {
  const res = await fetch('/api/auth/setup-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codeNumber, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Bigo sa pag-setup ng password');
  }
  return data;
}

export async function loginWithGoogle(email?: string, name?: string, googleId?: string, codeNumber?: string, username?: string, credential?: string, gender?: string, birthday?: string, age?: string): Promise<{ token: string; user: User; settings: UserSettings }> {
  const res = await fetch('/api/auth/google-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, googleId, codeNumber, username, credential, gender, birthday, age })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Google login failed');
  }

  setAuthToken(data.token, data.user.id);
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getHeaders()
    });
  } catch (e) {
    // ignore
  } finally {
    clearAuthToken();
  }
}

export async function loginWithPassword(usernameOrCode: string, password: string): Promise<{ token: string; user: User; settings: UserSettings }> {
  const res = await fetch('/api/auth/login-with-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrCode, password })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Maling Username/Code o Password');
  }

  setAuthToken(data.token, data.user.id);
  return data;
}

export async function updateUsername(newUsername: string): Promise<User> {
  const res = await fetch('/api/users/username', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ newUsername })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update username');
  }
  return data;
}

export async function loginOrRegister(username: string, password: string, mode: 'login' | 'register' = 'login'): Promise<{ token: string; user: User; settings: UserSettings }> {
  const res = await fetch('/api/auth/login-or-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, mode })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Authentication failed');
  }

  setAuthToken(data.token, data.user.id);
  return data;
}

let cachedUserSession: { user: User; settings: UserSettings } | null = null;
const apiCache = new Map<string, { data: any; timestamp: number }>();

export function clearApiCache() {
  cachedUserSession = null;
  apiCache.clear();
}

export async function fetchCurrentUser(forceRefresh = false): Promise<{ user: User; settings: UserSettings } | null> {
  const userId = getCurrentUserId();
  if (!userId) return null;

  if (cachedUserSession && !forceRefresh) {
    // Silently revalidate in background
    fetch('/api/users/me', { headers: getHeaders() })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user) cachedUserSession = data;
      })
      .catch(() => {});
    return cachedUserSession;
  }

  try {
    const res = await fetch('/api/users/me', { headers: getHeaders() });
    if (!res.ok) {
      clearAuthToken();
      cachedUserSession = null;
      return null;
    }
    const data = await res.json();
    cachedUserSession = data;
    return data;
  } catch (e) {
    console.error('Fetch me error:', e);
    return cachedUserSession;
  }
}

export async function updateNickname(nickname: string): Promise<User> {
  const res = await fetch('/api/users/nickname', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ nickname })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update nickname');
  }
  return data.user;
}

export async function fetchChatNicknames(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/chat-nicknames', { headers: getHeaders() });
    if (!res.ok) return {};
    return await res.json();
  } catch (e) {
    return {};
  }
}

export async function saveChatNickname(partnerId: string, nickname: string): Promise<void> {
  try {
    await fetch('/api/chat-nicknames', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ partnerId, nickname })
    });
  } catch (e) {
    console.error('Failed to sync chat nickname', e);
  }
}

export async function updateUserProfile(profileData: {
  nickname?: string;
  avatarUrl?: string;
  borderId?: number;
  coverUrl?: string;
  bio?: string;
  gender?: string;
  birthday?: string;
  age?: string;
  hometown?: string;
  school?: string;
  work?: string;
  phone?: string;
  phonePrivacy?: PhonePrivacy;
  profilePrivacy?: ProfilePrivacy;
  followersPrivacy?: ListPrivacy;
  followingPrivacy?: ListPrivacy;
}): Promise<User> {
  const res = await fetch('/api/users/profile', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(profileData)
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }
  return data.user;
}

export async function markPostsAsSeen(postIds: string[]) {
  try {
    await fetch('/api/posts/mark-seen', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ postIds })
    });
  } catch (e) {
    console.error('Failed to mark posts as seen:', e);
  }
}

export async function updateUserSettings(settings: Partial<UserSettings>) {
  const res = await fetch('/api/users/settings', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(settings)
  });
  return await res.json();
}

// FB Posts API
export async function fetchPosts(): Promise<Post[]> {
  const cached = apiCache.get('posts');
  if (cached && (Date.now() - cached.timestamp < 1500)) {
    return cached.data;
  }

  try {
    const res = await fetch('/api/posts', { headers: getHeaders() });
    if (!res.ok) return cached ? cached.data : [];
    const rawData = await res.json();
    const data: Post[] = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.posts) ? rawData.posts : []);
    apiCache.set('posts', { data, timestamp: Date.now() });
    return data;
  } catch (e) {
    return cached ? cached.data : [];
  }
}

export async function fetchVideoPosts(): Promise<Post[]> {
  const cached = apiCache.get('video_posts');
  if (cached && (Date.now() - cached.timestamp < 1500)) {
    return cached.data;
  }

  try {
    const res = await fetch('/api/posts/video', { headers: getHeaders() });
    if (!res.ok) return cached ? cached.data : [];
    const rawData = await res.json();
    const data: Post[] = Array.isArray(rawData) ? rawData : (rawData && Array.isArray(rawData.posts) ? rawData.posts : []);
    apiCache.set('video_posts', { data, timestamp: Date.now() });
    return data;
  } catch (e) {
    return cached ? cached.data : [];
  }
}

export async function createPost(postData: {
  content?: string;
  mediaType?: 'none' | 'image' | 'video';
  mediaUrl?: string;
  mediaBase64?: string;
  videoDurationSecs?: number;
}): Promise<Post> {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      ...postData,
      mediaUrl: postData.mediaUrl || postData.mediaBase64
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create post');
  }
  apiCache.delete('posts');
  apiCache.delete('video_posts');
  return data;
}

export async function reactToPost(postId: string, reactionType: PostReactionType): Promise<Post> {
  const res = await fetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ reactionType })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to react');
  return data;
}

export async function incrementPostView(postId: string): Promise<{ viewsCount: number }> {
  try {
    const res = await fetch(`/api/posts/${postId}/view`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to increment view');
    return data;
  } catch (err) {
    console.warn('incrementPostView error:', err);
    return { viewsCount: 1 };
  }
}

export async function commentPost(postId: string, content: string) {
  const res = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to comment');
  return data;
}

export async function deleteComment(postId: string, commentId: string) {
  const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete comment');
}

export async function sharePost(postId: string): Promise<Post> {
  const res = await fetch(`/api/posts/${postId}/share`, {
    method: 'POST',
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to share post');
  return data;
}

export async function deletePost(postId: string): Promise<void> {
  const res = await fetch(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete post');
}

export async function recordPostView(postId: string): Promise<void> {
  await fetch(`/api/posts/${postId}/view`, {
    method: 'POST',
    headers: getHeaders()
  }).catch(() => {});
}

export async function fetchTargetUserProfile(targetUserId: string): Promise<{
  user: User;
  isPrivate: boolean;
  friendStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none' | 'self';
  posts: Post[];
}> {
  const res = await fetch(`/api/users/${targetUserId}/profile`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to load user profile');
  return await res.json();
}

// Notifications API
export async function fetchNotifications(): Promise<AppNotification[]> {
  const res = await fetch('/api/notifications', { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function markNotificationsRead(): Promise<void> {
  await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: getHeaders()
  });
}

export async function searchUsers(q: string): Promise<Array<User & { friendStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none' }>> {
  const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function sendFriendRequest(targetUserId: string): Promise<FriendRequest> {
  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ targetUserId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send friend request');
  return data.request;
}

export async function respondFriendRequest(requestId: string, action: 'accept' | 'reject') {
  const res = await fetch('/api/friends/respond', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ requestId, action })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to respond to request');
  return data;
}

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  const res = await fetch('/api/friends/requests', { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function fetchFriends(): Promise<User[]> {
  const res = await fetch('/api/friends', { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function unfriendUser(targetUserId: string): Promise<void> {
  const res = await fetch('/api/friends/unfriend', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ targetUserId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to unfriend user');
}

export async function cancelFriendRequest(targetUserId: string): Promise<void> {
  const res = await fetch('/api/friends/cancel-request', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ targetUserId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to cancel friend request');
}

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch('/api/chats', { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function createDirectChat(friendId: string): Promise<Chat> {
  const res = await fetch('/api/chats/direct', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ friendId })
  });
  if (!res.ok) {
    let errText = 'Failed to create chat';
    try {
      const data = await res.json();
      if (data && data.error) errText = data.error;
    } catch {}
    throw new Error(errText);
  }
  return await res.json();
}

export async function fetchMessages(chatId: string): Promise<Message[]> {
  const res = await fetch(`/api/chats/${chatId}/messages`, { headers: getHeaders() });
  if (!res.ok) return [];
  return await res.json();
}

export async function sendMessage(msgData: {
  chatId: string;
  content: string;
  mediaType?: 'text' | 'image' | 'video' | 'file' | 'audio';
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  audioDuration?: number;
  replyToMessageId?: string;
}): Promise<Message> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(msgData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send message');
  return data;
}

export async function editMessage(id: string, content: string): Promise<Message> {
  const res = await fetch(`/api/messages/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ content })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to edit message');
  return data;
}

export async function deleteMessage(id: string): Promise<void> {
  const res = await fetch(`/api/messages/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete message');
}

export async function reactMessage(id: string, emoji: string): Promise<Message> {
  const res = await fetch(`/api/messages/${id}/react`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ emoji })
  });
  return await res.json();
}

export async function unsendMessage(id: string, type: 'everyone' | 'me'): Promise<Message> {
  const res = await fetch(`/api/messages/${id}/unsend`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ type })
  });
  if (!res.ok) throw new Error('Failed to unsend message');
  return await res.json();
}

export async function pinMessage(id: string): Promise<Message> {
  const res = await fetch(`/api/messages/${id}/pin`, {
    method: 'POST',
    headers: getHeaders()
  });
  return await res.json();
}

export async function markChatSeen(chatId: string): Promise<void> {
  await fetch(`/api/chats/${chatId}/seen`, {
    method: 'POST',
    headers: getHeaders()
  });
}

export async function uploadMediaFile(fileData: string, fileName?: string): Promise<{ url: string; fileName: string; fileSize: number; mimeType: string }> {
  try {
    // If base64 string is under 1.5MB (~1.1MB file), upload in a single direct request
    if (fileData.length <= 1500000) {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ fileData, fileName })
      });

      const contentType = res.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('Non-JSON upload response:', res.status, text);
        throw new Error(`Upload failed (${res.status}): File too large or could not be processed by server.`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      return data;
    }

    // Large file / video: upload in 500,000 char (~500KB) chunks safely bypassing proxy size limits
    const chunkSize = 500000;
    const totalChunks = Math.ceil(fileData.length / chunkSize);
    const uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

    let lastResult: any = null;
    for (let i = 0; i < totalChunks; i++) {
      const chunkData = fileData.substring(i * chunkSize, (i + 1) * chunkSize);
      const res = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          uploadId,
          chunkIndex: i,
          totalChunks,
          chunkData,
          fileName
        })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON chunk upload response:', res.status, text);
        throw new Error(`Chunk upload failed (${res.status}): Proxy error or connection interrupted.`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Chunk upload failed');
      }

      if (data.url) {
        lastResult = data;
      }
    }

    if (!lastResult || !lastResult.url) {
      throw new Error('Upload completed but server did not return file URL');
    }

    return lastResult;
  } catch (err: any) {
    console.error('uploadMediaFile error:', err);
    throw err;
  }
}

// WebSocket Connection Manager
class WsManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Array<(payload: any) => void>> = new Map();
  private reconnectTimer: any = null;

  public connect(userId: string) {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.send('auth', { userId });
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.socket.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data);
        const handlers = this.listeners.get(msg.type);
        if (handlers) {
          handlers.forEach(h => h(msg.payload));
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    this.socket.onclose = () => {
      // Reconnect automatically after 3 seconds
      this.reconnectTimer = setTimeout(() => {
        const uId = getCurrentUserId();
        if (uId) this.connect(uId);
      }, 3000);
    };
  }

  public disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public send(type: string, payload: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, payload }));
    }
  }

  public on(type: string, handler: (payload: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler);
    return () => {
      const list = this.listeners.get(type) || [];
      this.listeners.set(type, list.filter(h => h !== handler));
    };
  }
}

export const wsManager = new WsManager();

export async function getUserFollowers(userId: string): Promise<User[]> {
  const res = await fetch(`/api/users/${userId}/followers`, {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch followers');
  }
  return data;
}

export async function getUserFollowing(userId: string): Promise<User[]> {
  const res = await fetch(`/api/users/${userId}/following`, {
    headers: getHeaders()
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch following');
  }
  return data;
}

