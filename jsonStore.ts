import fs from 'fs';
import path from 'path';
import { User, UserSettings, Chat, Message, Post, PostComment, AppNotification, FriendRequest } from '../types';

const STORE_FILE = path.join(process.cwd(), 'uploads', 'json_db_store.json');

export interface JsonDbData {
  users: Record<string, any>; // id or username -> user object with passwordHash
  userSettings: Record<string, UserSettings>;
  chats: Record<string, Chat>;
  messages: Record<string, Message[]>;
  posts: Record<string, Post>;
  postComments: Record<string, PostComment>;
  notifications: Record<string, AppNotification[]>;
  friendRequests: FriendRequest[];
  friendships: { id: string; user1Id: string; user2Id: string; createdAt: string }[];
  follows: { id: string; followerId: string; followingId: string; createdAt: string }[];
  dailyPhotoUploads: Record<string, number>;
}

const DEFAULT_STORE: JsonDbData = {
  users: {},
  userSettings: {},
  chats: {},
  messages: {},
  posts: {},
  postComments: {},
  notifications: {},
  friendRequests: [],
  friendships: [],
  follows: [],
  dailyPhotoUploads: {}
};

let inMemoryStore: JsonDbData | null = null;

export function getJsonStore(): JsonDbData {
  if (inMemoryStore) return inMemoryStore;

  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      inMemoryStore = { ...DEFAULT_STORE, ...JSON.parse(raw) };
      return inMemoryStore!;
    }
  } catch (e) {
    // fallback
  }

  inMemoryStore = { ...DEFAULT_STORE };
  saveJsonStore();
  return inMemoryStore;
}

export function saveJsonStore() {
  if (!inMemoryStore) return;
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(inMemoryStore, null, 2), 'utf-8');
  } catch (e) {
    // ignore
  }
}
