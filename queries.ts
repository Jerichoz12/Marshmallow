import fs from 'fs';
import path from 'path';
import { db, ensureSchema, retryQuery, isPostgresConfigured, isPostgresActive, markPostgresInactive } from './index';
import { getJsonStore, saveJsonStore } from './jsonStore';
export { ensureSchema };

const FALLBACK_POSTS_FILE = path.join(process.cwd(), 'uploads', 'posts_store.json');

const INITIAL_SAMPLE_POSTS: Post[] = [];

function normalizePostAuthorNames(postsList: Post[], userMap?: Map<string, User>): Post[] {
  return postsList.map(p => {
    const userId = p.userId || '';
    const rawCode = userId.replace(/^usr_code_/, '').replace(/^#/, '');
    const canonicalUserId = rawCode ? ('usr_code_' + rawCode) : userId;
    const author = userMap ? (userMap.get(userId) || userMap.get(rawCode) || userMap.get(canonicalUserId)) : undefined;

    let authorName = author?.nickname || author?.username || p.authorName;
    let authorUsername = author?.username || p.authorUsername || rawCode;
    let authorAvatarUrl = author?.avatarUrl || p.authorAvatarUrl;

    return {
      ...p,
      userId: canonicalUserId,
      authorName,
      authorUsername,
      authorAvatarUrl,
      authorBorderId: author?.borderId ?? p.authorBorderId
    };
  });
}

function loadFallbackPosts(): Post[] {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    if (fs.existsSync(FALLBACK_POSTS_FILE)) {
      const raw = fs.readFileSync(FALLBACK_POSTS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        return normalizePostAuthorNames(data);
      }
    }
    fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  } catch (e) {
    return [];
  }
}

function saveFallbackPosts(postsList: Post[]) {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify(postsList, null, 2), 'utf-8');
  } catch (e) {
    // ignore
  }
}

export async function ensureSchemaChecked() {
  if (isPostgresConfigured() && await isPostgresActive()) {
    await ensureSchema();
  }
}
import { users, follows, friendRequests, friendships, chats, messages, posts, postComments, notifications, userSettings, dailyPhotoUploads } from './schema';
import { eq, or, and, like, desc, asc, ilike } from 'drizzle-orm';
import { User, UserSettings, Chat, Message, Post, PostComment, AppNotification, FriendRequest, PostReactionType } from '../types';

const SPECIAL_USER_AVATARS: Record<string, string> = {};

function getCustomAvatar(username: string, id: string, currentAvatar?: string | null): string | undefined {
  if (currentAvatar && currentAvatar.trim() !== '') {
    return currentAvatar;
  }
  return undefined;
}

export function isBlockedUser(userIdOrName: string): boolean {
  if (!userIdOrName) return false;
  const clean = userIdOrName.trim().toLowerCase();
  return clean === '536811' || clean === 'usr_code_536811' || clean.includes('536811');
}

function getJsonStoreUserById(id: string): User | null {
  if (!id || isBlockedUser(id)) return null;
  const store = getJsonStore();
  const cleanId = id.trim();
  const rawCode = cleanId.replace(/^usr_code_/, '').replace(/^#/, '');
  const canonicalId = 'usr_code_' + rawCode;

  const cleanLower = cleanId.toLowerCase();
  const rawLower = rawCode.toLowerCase();
  const canonicalLower = canonicalId.toLowerCase();

  for (const key in store.users) {
    const u = store.users[key];
    if (!u) continue;
    const uIdLower = (u.id || '').toLowerCase();
    const uUsernameLower = (u.username || '').toLowerCase();
    const uNicknameLower = (u.nickname || '').toLowerCase();

    if (
      uIdLower === cleanLower ||
      uIdLower === canonicalLower ||
      uIdLower === rawLower ||
      uUsernameLower === cleanLower ||
      uUsernameLower === rawLower ||
      uNicknameLower === cleanLower
    ) {
      if (isBlockedUser(u.username) || isBlockedUser(u.id)) return null;
      const computedAvatar = getCustomAvatar(u.username, u.id, u.avatarUrl);
      const codeNumber = u.id.startsWith('usr_code_') ? u.id.replace('usr_code_', '') : u.username;

      let displayNickname = u.nickname;
      if (!displayNickname || displayNickname === u.username || displayNickname === '143456' || displayNickname === '547257') {
        if (codeNumber === '143456' || u.username === '143456') displayNickname = 'Official Admin';
        else if (codeNumber === '547257' || u.username === '547257') displayNickname = 'Sweet Dev';
        else if (codeNumber === '537212' || u.username === '537212') displayNickname = 'Marshmallow Dev';
      }

      return {
        id: u.id,
        username: u.username,
        codeNumber,
        usernameChanged: u.usernameChanged ?? undefined,
        usernameLastChangedAt: u.usernameLastChangedAt || null,
        gender: u.gender || undefined,
        birthday: u.birthday || undefined,
        nickname: displayNickname || u.username,
        nicknameLastChangedAt: u.nicknameLastChangedAt || null,
        avatarUrl: computedAvatar,
        borderId: u.borderId ?? undefined,
        coverUrl: u.coverUrl || undefined,
        bio: u.bio || undefined,
        age: u.age || undefined,
        hometown: u.hometown || undefined,
        school: u.school || undefined,
        work: u.work || undefined,
        phone: u.phone || undefined,
        phonePrivacy: u.phonePrivacy || 'public',
        profilePrivacy: u.profilePrivacy || 'public',
        followersPrivacy: u.followersPrivacy || 'public',
        followingPrivacy: u.followingPrivacy || 'public',
        status: u.status || 'online',
        lastSeenAt: u.lastSeenAt || new Date().toISOString(),
        createdAt: u.createdAt || new Date().toISOString(),
      };
    }
  }
  return null;
}

export async function purgeBlockedUsers() {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(users).where(or(
        eq(users.username, '536811'), eq(users.id, 'usr_code_536811'), ilike(users.username, '%536811%')
      )).catch(() => {});

      await db.delete(posts).where(or(
        eq(posts.userId, 'usr_code_536811'), eq(posts.userId, '536811'), eq(posts.authorUsername, '536811')
      )).catch(() => {});

      await db.delete(postComments).where(or(
        eq(postComments.userId, 'usr_code_536811'), eq(postComments.userId, '536811'), eq(postComments.authorUsername, '536811')
      )).catch(() => {});

      await db.delete(messages).where(or(
        eq(messages.senderId, 'usr_code_536811'), eq(messages.senderId, '536811')
      )).catch(() => {});

      await db.delete(chats).where(or(
        ilike(chats.participants, '%536811%')
      )).catch(() => {});
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // Always clean JSON store as well
  const store = getJsonStore();
  let changed = false;
  for (const k of Object.keys(store.users)) {
    const u = store.users[k];
    if (isBlockedUser(u.id) || isBlockedUser(u.username) || isBlockedUser(u.nickname)) {
      delete store.users[k];
      changed = true;
    }
  }
  for (const k of Object.keys(store.posts)) {
    const p = store.posts[k];
    if (isBlockedUser(p.userId) || isBlockedUser(p.authorUsername)) {
      delete store.posts[k];
      changed = true;
    }
  }
  if (changed) {
    saveJsonStore();
  }

  // Clean fallback posts file
  if (fs.existsSync(FALLBACK_POSTS_FILE)) {
    try {
      const raw = fs.readFileSync(FALLBACK_POSTS_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        const cleaned = data.filter((p: any) => !isBlockedUser(p.userId) && !isBlockedUser(p.authorUsername));
        fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify(cleaned, null, 2), 'utf-8');
      }
    } catch (e) {}
  }
}

export async function resetAllDatabaseData(): Promise<void> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(postComments).catch(() => {});
      await db.delete(posts).catch(() => {});
      await db.delete(messages).catch(() => {});
      await db.delete(chats).catch(() => {});
      await db.delete(notifications).catch(() => {});
      await db.delete(friendRequests).catch(() => {});
      await db.delete(friendships).catch(() => {});
      await db.delete(follows).catch(() => {});
      await db.delete(dailyPhotoUploads).catch(() => {});
      await db.delete(userSettings).catch(() => {});
      await db.delete(users).catch(() => {});
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  store.users = {};
  store.userSettings = {};
  store.chats = {};
  store.messages = {};
  store.posts = {};
  store.postComments = {};
  store.notifications = {};
  store.friendRequests = [];
  store.friendships = [];
  store.follows = [];
  store.dailyPhotoUploads = {};
  saveJsonStore();

  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_POSTS_FILE, JSON.stringify([], null, 2), 'utf-8');
    const userSeenFile = path.join(uploadsDir, 'user_seen_posts.json');
    if (fs.existsSync(userSeenFile)) {
      fs.writeFileSync(userSeenFile, JSON.stringify({}, null, 2), 'utf-8');
    }
  } catch (e) {
    console.warn('Error resetting fallback files:', e);
  }
}

export async function updateUserLastSeen(userId: string) {
  if (isBlockedUser(userId)) return;
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.update(users).set({
        lastSeenAt: new Date(),
        status: 'online'
      }).where(eq(users.id, userId));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  if (store.users[userId]) {
    store.users[userId].lastSeenAt = new Date().toISOString();
    store.users[userId].status = 'online';
    saveJsonStore();
  }
}

export async function getUserById(id: string): Promise<User | null> {
  if (!id || isBlockedUser(id)) return null;
  const cleanId = id.trim();
  const rawCode = cleanId.replace(/^usr_code_/, '').replace(/^#/, '');
  const canonicalId = 'usr_code_' + rawCode;

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      return await Promise.race([
        (async () => {
          await ensureSchemaChecked();
          const res = await db.select().from(users).where(or(
            eq(users.id, cleanId),
            eq(users.id, canonicalId),
            eq(users.id, rawCode),
            eq(users.username, cleanId),
            eq(users.username, rawCode)
          ));
          if (!res.length) return null;
          const u = res[0];
          if (isBlockedUser(u.username) || isBlockedUser(u.id)) return null;
          const computedAvatar = getCustomAvatar(u.username, u.id, u.avatarUrl);
          const codeNumber = u.id.startsWith('usr_code_') ? u.id.replace('usr_code_', '') : u.username;
          return {
            id: u.id,
            username: u.username,
            codeNumber,
            usernameChanged: u.usernameChanged ?? undefined,
            usernameLastChangedAt: u.usernameLastChangedAt ? u.usernameLastChangedAt.toISOString() : null,
            gender: (u.gender as any) || undefined,
            birthday: u.birthday || undefined,
            nickname: u.nickname,
            nicknameLastChangedAt: u.nicknameLastChangedAt ? u.nicknameLastChangedAt.toISOString() : null,
            avatarUrl: computedAvatar,
            borderId: u.borderId ?? undefined,
            coverUrl: u.coverUrl || undefined,
            bio: u.bio || undefined,
            age: u.age || undefined,
            hometown: u.hometown || undefined,
            school: u.school || undefined,
            work: u.work || undefined,
            phone: u.phone || undefined,
            phonePrivacy: (u.phonePrivacy as any) || 'public',
            profilePrivacy: (u.profilePrivacy as any) || 'public',
            followersPrivacy: (u.followersPrivacy as any) || 'public',
            followingPrivacy: (u.followingPrivacy as any) || 'public',
            status: (u.status as any) || 'online',
            lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : new Date().toISOString(),
            createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
          };
        })(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('User timeout')), 1500))
      ]);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return getJsonStoreUserById(id);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const rawClean = username.trim().replace(/^#/, '');
  if (!rawClean || isBlockedUser(rawClean)) return null;

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      return await retryQuery(async () => {
        await ensureSchemaChecked();
        const cleanLower = rawClean.toLowerCase();
        const cleanNoSpaces = cleanLower.replaceAll(/\s+/g, '');
        const res = await db.select().from(users).where(or(
          ilike(users.username, rawClean),
          ilike(users.username, cleanLower),
          ilike(users.username, cleanNoSpaces),
          ilike(users.id, rawClean),
          ilike(users.id, 'usr_code_' + rawClean),
          ilike(users.id, 'usr_code_' + cleanLower),
          ilike(users.id, 'usr_code_' + cleanNoSpaces)
        ));
        if (!res.length) return null;
        const u = res[0];
        if (isBlockedUser(u.username) || isBlockedUser(u.id)) return null;
        const computedAvatar = getCustomAvatar(u.username, u.id, u.avatarUrl);
        const codeNumber = u.id.startsWith('usr_code_') ? u.id.replace('usr_code_', '') : u.username;
        return {
          id: u.id,
          username: u.username,
          codeNumber,
          usernameChanged: u.usernameChanged ?? undefined,
          usernameLastChangedAt: u.usernameLastChangedAt ? u.usernameLastChangedAt.toISOString() : null,
          gender: (u.gender as any) || undefined,
          birthday: u.birthday || undefined,
          nickname: u.nickname,
          nicknameLastChangedAt: u.nicknameLastChangedAt ? u.nicknameLastChangedAt.toISOString() : null,
          avatarUrl: computedAvatar,
          borderId: u.borderId ?? undefined,
          coverUrl: u.coverUrl || undefined,
          bio: u.bio || undefined,
          age: u.age || undefined,
          hometown: u.hometown || undefined,
          school: u.school || undefined,
          work: u.work || undefined,
          phone: u.phone || undefined,
          phonePrivacy: (u.phonePrivacy as any) || 'public',
          profilePrivacy: (u.profilePrivacy as any) || 'public',
          followersPrivacy: (u.followersPrivacy as any) || 'public',
          followingPrivacy: (u.followingPrivacy as any) || 'public',
          status: (u.status as any) || 'online',
          lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : new Date().toISOString(),
          createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
        };
      });
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return getJsonStoreUserById(rawClean);
}

export async function getUserRecordWithPassword(identifier: string): Promise<{ user: User; passwordHash: string } | null> {
  const rawClean = identifier.trim().replace(/^#/, '');
  if (!rawClean || isBlockedUser(rawClean)) return null;

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await ensureSchemaChecked();
      const cleanLower = rawClean.toLowerCase();
      const cleanNoSpaces = cleanLower.replaceAll(/\s+/g, '');
      const res = await db.select().from(users).where(or(
        ilike(users.username, rawClean),
        ilike(users.username, cleanLower),
        ilike(users.username, cleanNoSpaces),
        ilike(users.nickname, rawClean),
        ilike(users.nickname, cleanLower),
        ilike(users.id, rawClean),
        ilike(users.id, 'usr_code_' + rawClean),
        ilike(users.id, 'usr_code_' + cleanLower),
        ilike(users.id, 'usr_code_' + cleanNoSpaces)
      ));
      if (res.length) {
        const u = res[0];
        if (!isBlockedUser(u.username) && !isBlockedUser(u.id)) {
          const cleanUser = await getUserById(u.id);
          if (cleanUser) {
            return {
              user: cleanUser,
              passwordHash: u.passwordHash
            };
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const cleanUser = await getUserByUsername(rawClean) || await getUserById(rawClean);
  if (cleanUser) {
    const store = getJsonStore();
    const stored = store.users[cleanUser.id] || store.users[cleanUser.username];
    const passwordHash = stored?.passwordHash || ('code_pass_' + cleanUser.username);
    return { user: cleanUser, passwordHash };
  }

  return null;
}

export async function searchUsersByCode(query: string): Promise<User[]> {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await ensureSchemaChecked();
      const res = await db.select().from(users).where(or(
        eq(users.username, clean),
        eq(users.nickname, clean)
      ));
      return res
        .filter(u => !isBlockedUser(u.id) && !isBlockedUser(u.username))
        .map(u => ({
          id: u.id,
          username: u.username,
          nickname: u.nickname,
          nicknameLastChangedAt: u.nicknameLastChangedAt ? u.nicknameLastChangedAt.toISOString() : null,
          avatarUrl: getCustomAvatar(u.username, u.id, u.avatarUrl),
          borderId: u.borderId ?? undefined,
          coverUrl: u.coverUrl || undefined,
          bio: u.bio || undefined,
          age: u.age || undefined,
          hometown: u.hometown || undefined,
          school: u.school || undefined,
          work: u.work || undefined,
          phone: u.phone || undefined,
          phonePrivacy: (u.phonePrivacy as any) || 'public',
          profilePrivacy: (u.profilePrivacy as any) || 'public',
          followersPrivacy: (u.followersPrivacy as any) || 'public',
          followingPrivacy: (u.followingPrivacy as any) || 'public',
          status: (u.status as any) || 'online',
          lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : new Date().toISOString(),
          createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString(),
        }));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const results: User[] = [];
  for (const k in store.users) {
    const u = store.users[k];
    if (u.username.toLowerCase() === clean || u.nickname?.toLowerCase() === clean) {
      const parsed = getJsonStoreUserById(u.id);
      if (parsed) results.push(parsed);
    }
  }
  return results;
}

export async function createOrUpdateCodeUser(codeNumber: string) {
  const cleanCode = codeNumber.trim().replace(/^#/, '').replaceAll(/\s+/g, '');
  if (isBlockedUser(cleanCode)) {
    throw new Error('Your account has been blocked.');
  }

  let defaultNickname = cleanCode;
  if (cleanCode === '143456') defaultNickname = 'Official Admin';
  else if (cleanCode === '547257') defaultNickname = 'Sweet Dev';
  else if (cleanCode === '537212') defaultNickname = 'Marshmallow Dev';

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await ensureSchemaChecked();
      let existing = await getUserByUsername(cleanCode) || await getUserById('usr_code_' + cleanCode);
      const customAvatar = SPECIAL_USER_AVATARS[cleanCode] || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanCode}`;

      if (!existing) {
        const userId = 'usr_code_' + cleanCode;
        await db.insert(users).values({
          id: userId,
          username: cleanCode,
          passwordHash: 'code_pass_' + cleanCode,
          nickname: defaultNickname,
          avatarUrl: customAvatar,
          status: 'online',
          lastSeenAt: new Date(),
          createdAt: new Date()
        }).onConflictDoNothing();

        await db.insert(userSettings).values({
          userId,
          theme: 'dark',
          notificationsEnabled: true,
          readReceipts: true,
          onlineStatusVisible: true
        }).onConflictDoNothing();

        existing = await getUserById(userId) || await getUserByUsername(cleanCode);
      } else {
        const updateObj: Record<string, any> = {
          status: 'online',
          lastSeenAt: new Date()
        };
        if (!existing.avatarUrl && SPECIAL_USER_AVATARS[cleanCode]) {
          updateObj.avatarUrl = SPECIAL_USER_AVATARS[cleanCode];
        }
        await db.update(users).set(updateObj).where(eq(users.id, existing.id));
        existing.status = 'online';
        existing.lastSeenAt = new Date().toISOString();
        if (updateObj.avatarUrl) existing.avatarUrl = updateObj.avatarUrl;
      }
      if (existing) return existing;
    } catch (err: any) {
      if (err?.message === 'Your account has been blocked.') throw err;
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // Fallback to JSON store
  const store = getJsonStore();
  const userId = 'usr_code_' + cleanCode;
  const customAvatar = SPECIAL_USER_AVATARS[cleanCode] || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanCode}`;

  if (!store.users[userId]) {
    store.users[userId] = {
      id: userId,
      username: cleanCode,
      passwordHash: 'code_pass_' + cleanCode,
      nickname: defaultNickname,
      avatarUrl: customAvatar,
      status: 'online',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    store.userSettings[userId] = {
      theme: 'dark',
      notificationsEnabled: true,
      readReceipts: true,
      onlineStatusVisible: true
    };
    saveJsonStore();
  } else {
    store.users[userId].status = 'online';
    store.users[userId].lastSeenAt = new Date().toISOString();
    if (!store.users[userId].nickname || store.users[userId].nickname === cleanCode) {
      store.users[userId].nickname = defaultNickname;
    }
    saveJsonStore();
  }

  return (await getUserById(userId))!;
}

export async function updateUserProfile(userId: string, updates: Record<string, any>): Promise<User | null> {
  const setObj: Record<string, any> = {};
  if (updates.nickname !== undefined) {
    setObj.nickname = updates.nickname;
    setObj.nicknameLastChangedAt = new Date();
  }
  if (updates.username !== undefined) setObj.username = updates.username;
  if (updates.usernameChanged !== undefined) {
    setObj.usernameChanged = updates.usernameChanged;
    setObj.usernameLastChangedAt = new Date();
  }
  if (updates.usernameLastChangedAt !== undefined) setObj.usernameLastChangedAt = updates.usernameLastChangedAt ? new Date(updates.usernameLastChangedAt) : null;
  if (updates.gender !== undefined) setObj.gender = updates.gender;
  if (updates.birthday !== undefined) setObj.birthday = updates.birthday;
  if (updates.password !== undefined) setObj.passwordHash = updates.password;
  if (updates.avatarUrl !== undefined) setObj.avatarUrl = updates.avatarUrl;
  if (updates.borderId !== undefined) setObj.borderId = updates.borderId;
  if (updates.coverUrl !== undefined) setObj.coverUrl = updates.coverUrl;
  if (updates.bio !== undefined) setObj.bio = updates.bio;
  if (updates.age !== undefined) setObj.age = updates.age;
  if (updates.hometown !== undefined) setObj.hometown = updates.hometown;
  if (updates.school !== undefined) setObj.school = updates.school;
  if (updates.work !== undefined) setObj.work = updates.work;
  if (updates.phone !== undefined) setObj.phone = updates.phone;
  if (updates.phonePrivacy !== undefined) setObj.phonePrivacy = updates.phonePrivacy;
  if (updates.profilePrivacy !== undefined) setObj.profilePrivacy = updates.profilePrivacy;
  if (updates.followersPrivacy !== undefined) setObj.followersPrivacy = updates.followersPrivacy;
  if (updates.followingPrivacy !== undefined) setObj.followingPrivacy = updates.followingPrivacy;
  if (updates.status !== undefined) {
    setObj.status = updates.status;
    setObj.lastSeenAt = new Date();
  }

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      if (Object.keys(setObj).length > 0) {
        await db.update(users).set(setObj).where(eq(users.id, userId));
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // Update JSON Store
  const store = getJsonStore();
  if (store.users[userId]) {
    Object.assign(store.users[userId], updates);
    if (updates.password) store.users[userId].passwordHash = updates.password;
    saveJsonStore();
  }

  return await getUserById(userId);
}


export async function getUserSettings(userId: string): Promise<UserSettings> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const res = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      if (res.length) {
        return {
          theme: (res[0].theme as any) || 'dark',
          notificationsEnabled: res[0].notificationsEnabled ?? true,
          readReceipts: res[0].readReceipts ?? true,
          onlineStatusVisible: res[0].onlineStatusVisible ?? true,
        };
      }
      // Create default
      await db.insert(userSettings).values({
        userId,
        theme: 'dark',
        notificationsEnabled: true,
        readReceipts: true,
        onlineStatusVisible: true
      }).onConflictDoNothing();
      return { theme: 'dark', notificationsEnabled: true, readReceipts: true, onlineStatusVisible: true };
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  if (!store.userSettings[userId]) {
    store.userSettings[userId] = {
      theme: 'dark',
      notificationsEnabled: true,
      readReceipts: true,
      onlineStatusVisible: true
    };
    saveJsonStore();
  }
  return store.userSettings[userId];
}

export async function updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.insert(userSettings).values({
        userId,
        theme: updates.theme || 'dark',
        notificationsEnabled: updates.notificationsEnabled ?? true,
        readReceipts: updates.readReceipts ?? true,
        onlineStatusVisible: updates.onlineStatusVisible ?? true,
      }).onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          ...(updates.theme !== undefined && { theme: updates.theme }),
          ...(updates.notificationsEnabled !== undefined && { notificationsEnabled: updates.notificationsEnabled }),
          ...(updates.readReceipts !== undefined && { readReceipts: updates.readReceipts }),
          ...(updates.onlineStatusVisible !== undefined && { onlineStatusVisible: updates.onlineStatusVisible }),
        }
      });
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  if (!store.userSettings[userId]) {
    store.userSettings[userId] = {
      theme: 'dark',
      notificationsEnabled: true,
      readReceipts: true,
      onlineStatusVisible: true
    };
  }
  Object.assign(store.userSettings[userId], updates);
  saveJsonStore();
  return store.userSettings[userId];
}

export async function getChatsForUser(userId: string): Promise<Chat[]> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      return await retryQuery(async () => {
        await ensureSchemaChecked();
        const allChats = await db.select().from(chats);
        const userChats = allChats.filter(c => {
          try {
            const parts: string[] = JSON.parse(c.participants);
            return parts.includes(userId);
          } catch {
            return false;
          }
        });

        const result: Chat[] = [];
        for (const c of userChats) {
          const parts: string[] = JSON.parse(c.participants);
          const participantUsers: User[] = [];
          for (const pId of parts) {
            const u = await getUserById(pId);
            if (u) participantUsers.push(u);
          }

          const msgRes = await db.select().from(messages).where(eq(messages.chatId, c.id)).orderBy(desc(messages.createdAt)).limit(1);
          let lastMessage: Message | undefined = undefined;
          if (msgRes.length) {
            const m = msgRes[0];
            const sender = await getUserById(m.senderId);
            let reactionsParsed: Record<string, string[]> = {};
            let seenByParsed: string[] = [];
            try { reactionsParsed = JSON.parse(m.reactions || '{}'); } catch {}
            try { seenByParsed = JSON.parse(m.seenBy || '[]'); } catch {}

            lastMessage = {
              id: m.id,
              chatId: m.chatId,
              senderId: m.senderId,
              senderNickname: sender?.nickname,
              senderUsername: sender?.username,
              senderAvatarUrl: sender?.avatarUrl,
              senderBorderId: sender?.borderId,
              content: m.content,
              mediaType: (m.mediaType as any) || undefined,
              mediaUrl: m.mediaUrl || undefined,
              mediaName: m.mediaName || undefined,
              mediaSize: m.mediaSize || undefined,
              audioDuration: m.audioDuration || undefined,
              replyToMessageId: m.replyToMessageId || undefined,
              reactions: reactionsParsed,
              isPinned: m.isPinned ?? false,
              isEdited: m.isEdited ?? false,
              seenBy: seenByParsed,
              createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString()
            };
          }

          const allMsgs = await db.select().from(messages).where(eq(messages.chatId, c.id));
          let unreadCount = 0;
          allMsgs.forEach(m => {
            try {
              const seen: string[] = JSON.parse(m.seenBy || '[]');
              if (!seen.includes(userId)) {
                unreadCount++;
              }
            } catch {
              if (m.senderId !== userId) unreadCount++;
            }
          });

          result.push({
            id: c.id,
            type: (c.type as any) || 'direct',
            participants: parts,
            participantUsers,
            lastMessage,
            unreadCount,
            updatedAt: c.updatedAt ? c.updatedAt.toISOString() : new Date().toISOString()
          });
        }

        return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // JSON store fallback for chats
  const store = getJsonStore();
  const userChats: Chat[] = [];
  for (const chatId in store.chats) {
    const c = store.chats[chatId];
    if (c.participants.includes(userId)) {
      const participantUsers: User[] = [];
      for (const pId of c.participants) {
        const u = await getUserById(pId);
        if (u) participantUsers.push(u);
      }
      
      const chatMsgs = (store.messages[chatId] || []).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const lastMessage = chatMsgs.length ? chatMsgs[chatMsgs.length - 1] : undefined;
      const unreadCount = chatMsgs.filter(m => !m.seenBy?.includes(userId)).length;

      userChats.push({
        id: c.id,
        type: c.type || 'direct',
        participants: c.participants,
        participantUsers,
        lastMessage,
        unreadCount,
        updatedAt: c.updatedAt || new Date().toISOString()
      });
    }
  }
  return userChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<Chat> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const allChats = await db.select().from(chats).where(eq(chats.type, 'direct'));
      for (const c of allChats) {
        try {
          const parts: string[] = JSON.parse(c.participants);
          if (parts.length === 2 && parts.includes(user1Id) && parts.includes(user2Id)) {
            const userChats = await getChatsForUser(user1Id);
            const found = userChats.find(chat => chat.id === c.id);
            if (found) return found;
          }
        } catch {}
      }

      const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const participants = JSON.stringify([user1Id, user2Id]);
      await db.insert(chats).values({
        id: chatId,
        type: 'direct',
        participants,
        updatedAt: new Date()
      });

      const userChats = await getChatsForUser(user1Id);
      const found = userChats.find(chat => chat.id === chatId);
      if (found) return found;
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // JSON store fallback
  const store = getJsonStore();
  for (const chatId in store.chats) {
    const c = store.chats[chatId];
    if (c.participants.length === 2 && c.participants.includes(user1Id) && c.participants.includes(user2Id)) {
      const userChats = await getChatsForUser(user1Id);
      const found = userChats.find(chat => chat.id === chatId);
      if (found) return found;
    }
  }

  const chatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  store.chats[chatId] = {
    id: chatId,
    type: 'direct',
    participants: [user1Id, user2Id],
    updatedAt: new Date().toISOString()
  };
  store.messages[chatId] = [];
  saveJsonStore();

  const userChats = await getChatsForUser(user1Id);
  return userChats.find(chat => chat.id === chatId)!;
}

export async function getMessagesByChatId(chatId: string): Promise<Message[]> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await ensureSchemaChecked();
      const rows = await db.select().from(messages).where(eq(messages.chatId, chatId)).orderBy(asc(messages.createdAt));
      const result: Message[] = [];
      for (const m of rows) {
        const sender = await getUserById(m.senderId);
        let reactionsParsed: Record<string, string[]> = {};
        let seenByParsed: string[] = [];
        let hiddenForParsed: string[] = [];
        try { reactionsParsed = JSON.parse(m.reactions || '{}'); } catch {}
        try { seenByParsed = JSON.parse(m.seenBy || '[]'); } catch {}
        try { hiddenForParsed = JSON.parse(m.hiddenFor || '[]'); } catch {}

        let replyToMessage = undefined;
        if (m.replyToMessageId) {
          const replyRow = await db.select().from(messages).where(eq(messages.id, m.replyToMessageId));
          if (replyRow.length) {
            const replySender = await getUserById(replyRow[0].senderId);
            replyToMessage = {
              id: replyRow[0].id,
              senderNickname: replySender?.nickname,
              content: replyRow[0].content,
              mediaType: (replyRow[0].mediaType as any) || undefined
            };
          }
        }

        const isUnsentBool = Boolean(m.isUnsent) || m.content === 'This message was unsent.';

        result.push({
          id: m.id,
          chatId: m.chatId,
          senderId: m.senderId,
          senderNickname: sender?.nickname,
          senderUsername: sender?.username,
          senderAvatarUrl: sender?.avatarUrl,
          senderBorderId: sender?.borderId,
          content: m.content,
          mediaType: (m.mediaType as any) || undefined,
          mediaUrl: m.mediaUrl || undefined,
          mediaName: m.mediaName || undefined,
          mediaSize: m.mediaSize || undefined,
          audioDuration: m.audioDuration || undefined,
          replyToMessageId: m.replyToMessageId || undefined,
          replyToMessage,
          reactions: reactionsParsed,
          isPinned: m.isPinned ?? false,
          isEdited: m.isEdited ?? false,
          isUnsent: isUnsentBool,
          hiddenFor: hiddenForParsed,
          seenBy: seenByParsed,
          createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString()
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // JSON store fallback
  const store = getJsonStore();
  const msgs = store.messages[chatId] || [];
  const result: Message[] = [];
  for (const m of msgs) {
    const sender = await getUserById(m.senderId);
    result.push({
      ...m,
      senderNickname: sender?.nickname || m.senderNickname,
      senderUsername: sender?.username || m.senderUsername,
      senderAvatarUrl: sender?.avatarUrl || m.senderAvatarUrl,
      senderBorderId: sender?.borderId || m.senderBorderId,
    });
  }
  return result;
}

export async function createMessage(data: {
  chatId: string;
  senderId: string;
  content: string;
  mediaType?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  audioDuration?: number;
  replyToMessageId?: string;
}): Promise<Message> {
  const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const seenByArr = [data.senderId];
  const sender = await getUserById(data.senderId);

  const newMsg: Message = {
    id: msgId,
    chatId: data.chatId,
    senderId: data.senderId,
    senderNickname: sender?.nickname,
    senderUsername: sender?.username,
    senderAvatarUrl: sender?.avatarUrl,
    senderBorderId: sender?.borderId,
    content: data.content,
    mediaType: data.mediaType as any,
    mediaUrl: data.mediaUrl,
    mediaName: data.mediaName,
    mediaSize: data.mediaSize,
    audioDuration: data.audioDuration,
    replyToMessageId: data.replyToMessageId,
    reactions: {},
    seenBy: seenByArr,
    createdAt: new Date().toISOString()
  };

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.insert(messages).values({
        id: msgId,
        chatId: data.chatId,
        senderId: data.senderId,
        content: data.content,
        mediaType: data.mediaType,
        mediaUrl: data.mediaUrl,
        mediaName: data.mediaName,
        mediaSize: data.mediaSize,
        audioDuration: data.audioDuration,
        replyToMessageId: data.replyToMessageId,
        reactions: '{}',
        seenBy: JSON.stringify(seenByArr),
        createdAt: new Date()
      });

      await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, data.chatId));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  // JSON store fallback
  const store = getJsonStore();
  if (!store.messages[data.chatId]) store.messages[data.chatId] = [];
  store.messages[data.chatId].push(newMsg);
  if (store.chats[data.chatId]) {
    store.chats[data.chatId].updatedAt = new Date().toISOString();
  }
  saveJsonStore();

  return newMsg;
}

export async function markMessagesSeen(chatId: string, userId: string): Promise<void> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const rows = await db.select().from(messages).where(eq(messages.chatId, chatId));
      for (const m of rows) {
        try {
          let seenArr: string[] = JSON.parse(m.seenBy || '[]');
          if (!seenArr.includes(userId)) {
            seenArr.push(userId);
            await db.update(messages).set({ seenBy: JSON.stringify(seenArr) }).where(eq(messages.id, m.id));
          }
        } catch {}
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const msgs = store.messages[chatId] || [];
  msgs.forEach(m => {
    if (!m.seenBy) m.seenBy = [];
    if (!m.seenBy.includes(userId)) m.seenBy.push(userId);
  });
  saveJsonStore();
}

export async function toggleMessageReaction(messageId: string, userId: string, emoji: string): Promise<Message> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const row = await db.select().from(messages).where(eq(messages.id, messageId));
      if (row.length) {
        const msgRow = row[0];
        let rxMap: Record<string, string[]> = {};
        try { rxMap = JSON.parse(msgRow.reactions || '{}'); } catch {}

        const uIds = rxMap[emoji] || [];
        if (uIds.includes(userId)) {
          rxMap[emoji] = uIds.filter(id => id !== userId);
          if (rxMap[emoji].length === 0) delete rxMap[emoji];
        } else {
          rxMap[emoji] = [...uIds, userId];
        }

        await db.update(messages).set({
          reactions: JSON.stringify(rxMap),
          seenBy: JSON.stringify([userId])
        }).where(eq(messages.id, messageId));

        await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, msgRow.chatId));
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  let foundMsg: Message | null = null;
  for (const cid in store.messages) {
    const m = store.messages[cid].find(msg => msg.id === messageId);
    if (m) {
      if (!m.reactions) m.reactions = {};
      const uIds = m.reactions[emoji] || [];
      if (uIds.includes(userId)) {
        m.reactions[emoji] = uIds.filter(id => id !== userId);
        if (m.reactions[emoji].length === 0) delete m.reactions[emoji];
      } else {
        m.reactions[emoji] = [...uIds, userId];
      }
      foundMsg = m;
      saveJsonStore();
      break;
    }
  }
  return foundMsg || { id: messageId, chatId: '', senderId: userId, content: '', reactions: {}, seenBy: [], createdAt: new Date().toISOString() };
}

export async function togglePinMessage(messageId: string): Promise<Message> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const row = await db.select().from(messages).where(eq(messages.id, messageId));
      if (row.length) {
        const msgRow = row[0];
        await db.update(messages).set({ isPinned: !msgRow.isPinned }).where(eq(messages.id, messageId));
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  let foundMsg: Message | null = null;
  for (const cid in store.messages) {
    const m = store.messages[cid].find(msg => msg.id === messageId);
    if (m) {
      m.isPinned = !m.isPinned;
      foundMsg = m;
      saveJsonStore();
      break;
    }
  }
  return foundMsg || { id: messageId, chatId: '', senderId: '', content: '', reactions: {}, seenBy: [], createdAt: new Date().toISOString() };
}

export async function editMessageContent(messageId: string, content: string): Promise<Message> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.update(messages).set({ content, isEdited: true }).where(eq(messages.id, messageId));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  let foundMsg: Message | null = null;
  for (const cid in store.messages) {
    const m = store.messages[cid].find(msg => msg.id === messageId);
    if (m) {
      m.content = content;
      m.isEdited = true;
      foundMsg = m;
      saveJsonStore();
      break;
    }
  }
  return foundMsg || { id: messageId, chatId: '', senderId: '', content, reactions: {}, seenBy: [], createdAt: new Date().toISOString() };
}

export async function deleteMessageById(messageId: string): Promise<{ id: string; chatId: string }> {
  let chatId = '';
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const row = await db.select().from(messages).where(eq(messages.id, messageId));
      if (row.length) {
        chatId = row[0].chatId;
        await db.delete(messages).where(eq(messages.id, messageId));
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  for (const cid in store.messages) {
    const idx = store.messages[cid].findIndex(msg => msg.id === messageId);
    if (idx !== -1) {
      chatId = cid;
      store.messages[cid].splice(idx, 1);
      saveJsonStore();
      break;
    }
  }
  return { id: messageId, chatId };
}

export async function unsendMessage(messageId: string, userId: string, type: 'everyone' | 'me'): Promise<Message> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const row = await db.select().from(messages).where(eq(messages.id, messageId));
      if (row.length) {
        const msgRow = row[0];
        if (type === 'everyone') {
          await db.update(messages).set({
            isUnsent: true,
            content: 'This message was unsent.',
            mediaType: null,
            mediaUrl: null,
            mediaName: null,
            mediaSize: null,
            audioDuration: null,
            reactions: '{}'
          }).where(eq(messages.id, messageId));
        } else {
          let hiddenArr: string[] = [];
          try { hiddenArr = JSON.parse(msgRow.hiddenFor || '[]'); } catch {}
          if (!hiddenArr.includes(userId)) hiddenArr.push(userId);
          await db.update(messages).set({ hiddenFor: JSON.stringify(hiddenArr) }).where(eq(messages.id, messageId));
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  let foundMsg: Message | null = null;
  for (const cid in store.messages) {
    const m = store.messages[cid].find(msg => msg.id === messageId);
    if (m) {
      if (type === 'everyone') {
        m.isUnsent = true;
        m.content = 'This message was unsent.';
        delete m.mediaType;
        delete m.mediaUrl;
        delete m.mediaName;
        delete m.mediaSize;
        delete m.audioDuration;
        m.reactions = {};
      } else {
        if (!m.hiddenFor) m.hiddenFor = [];
        if (!m.hiddenFor.includes(userId)) m.hiddenFor.push(userId);
      }
      foundMsg = m;
      saveJsonStore();
      break;
    }
  }
  return foundMsg || { id: messageId, chatId: '', senderId: userId, content: 'This message was unsent.', reactions: {}, seenBy: [], createdAt: new Date().toISOString() };
}

export async function getPosts(): Promise<Post[]> {
  const fallbackList = loadFallbackPosts();

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const dbPosts = await Promise.race([
        (async () => {
          await ensureSchemaChecked();
          const rows = await db.select().from(posts).orderBy(desc(posts.createdAt));
          if (!rows.length) return [];

          const allUsersList = await db.select().from(users);
          const userMap = new Map<string, User>();
          allUsersList.forEach(u => {
            if (!isBlockedUser(u.id) && !isBlockedUser(u.username)) {
              const avatarUrl = getCustomAvatar(u.username, u.id, u.avatarUrl);
              const userObj: User = {
                id: u.id,
                username: u.username,
                nickname: u.nickname,
                avatarUrl,
                coverUrl: u.coverUrl || undefined,
                borderId: u.borderId || undefined,
                bio: u.bio || undefined,
                gender: (u.gender as any) || undefined,
                birthday: u.birthday || undefined,
                age: u.age || undefined,
                hometown: u.hometown || undefined,
                school: u.school || undefined,
                work: u.work || undefined,
                phone: u.phone || undefined,
                status: (u.status as any) || 'offline',
                lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : undefined,
                nicknameLastChangedAt: u.nicknameLastChangedAt ? u.nicknameLastChangedAt.toISOString() : undefined,
                createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString()
              };
              userMap.set(u.id, userObj);
              userMap.set(u.username, userObj);
              const rawCode = u.id.replace(/^usr_code_/, '');
              userMap.set(rawCode, userObj);
              userMap.set('usr_code_' + rawCode, userObj);
            }
          });

          const allComments = await db.select().from(postComments).orderBy(asc(postComments.createdAt));
          const commentsByPost = new Map<string, PostComment[]>();

          allComments.forEach(c => {
            const cAuthor = userMap.get(c.userId);
            const parsed: PostComment = {
              id: c.id,
              postId: c.postId,
              userId: c.userId,
              authorName: cAuthor?.nickname || c.authorName,
              authorUsername: cAuthor?.username || c.authorUsername,
              authorAvatarUrl: cAuthor?.avatarUrl || c.authorAvatarUrl || undefined,
              authorBorderId: cAuthor?.borderId,
              content: c.content,
              createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString()
            };
            if (!commentsByPost.has(c.postId)) {
              commentsByPost.set(c.postId, []);
            }
            commentsByPost.get(c.postId)!.push(parsed);
          });

          const result: Post[] = [];
          for (const p of rows) {
            if (isBlockedUser(p.userId) || isBlockedUser(p.authorUsername)) continue;

            let reactionsParsed: Record<string, PostReactionType> = {};
            try { reactionsParsed = JSON.parse(p.reactions || '{}'); } catch {}

            const author = userMap.get(p.userId);
            const parsedCmts = commentsByPost.get(p.id) || [];

            result.push({
              id: p.id,
              userId: p.userId,
              authorName: author?.nickname || p.authorName,
              authorUsername: author?.username || p.authorUsername,
              authorAvatarUrl: author?.avatarUrl || p.authorAvatarUrl || undefined,
              authorBorderId: author?.borderId,
              content: p.content || '',
              mediaType: (p.mediaType as any) || 'none',
              mediaUrl: p.mediaUrl || undefined,
              videoDurationSecs: p.videoDurationSecs || undefined,
              reactions: reactionsParsed,
              comments: parsedCmts,
              shareCount: p.shareCount || 0,
              viewsCount: p.viewsCount || 0,
              originalPostId: p.originalPostId || undefined,
              originalAuthorName: p.originalAuthorName || undefined,
              createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString()
            });
          }
          return result;
        })(),
        new Promise<Post[]>((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1500))
      ]);

      if (dbPosts && dbPosts.length > 0) {
        const postMap = new Map<string, Post>();
        fallbackList.forEach(p => postMap.set(p.id, p));
        dbPosts.forEach(p => postMap.set(p.id, p));

        const merged = normalizePostAuthorNames(Array.from(postMap.values())).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        saveFallbackPosts(merged);
        return merged;
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return normalizePostAuthorNames(fallbackList).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getVideoPosts(): Promise<Post[]> {
  try {
    const all = await getPosts();
    return all.filter(p => p.mediaType === 'video' && Boolean(p.mediaUrl));
  } catch (err) {
    console.error('Error in getVideoPosts:', err);
    return [];
  }
}

export async function createPost(data: {
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string;
  content: string;
  mediaType?: 'none' | 'image' | 'video';
  mediaUrl?: string;
  videoDurationSecs?: number;
  originalPostId?: string;
  originalAuthorName?: string;
}): Promise<Post> {
  const postId = 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newPost: Post = {
    id: postId,
    userId: data.userId,
    authorName: data.authorName,
    authorUsername: data.authorUsername,
    authorAvatarUrl: data.authorAvatarUrl,
    content: data.content,
    mediaType: data.mediaType || 'none',
    mediaUrl: data.mediaUrl,
    videoDurationSecs: data.videoDurationSecs,
    reactions: {},
    comments: [],
    shareCount: 0,
    viewsCount: 0,
    originalPostId: data.originalPostId,
    originalAuthorName: data.originalAuthorName,
    createdAt: new Date().toISOString()
  };

  const fallbackList = loadFallbackPosts();
  fallbackList.unshift(newPost);
  saveFallbackPosts(fallbackList);

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      db.insert(posts).values({
        id: postId,
        userId: data.userId,
        authorName: data.authorName,
        authorUsername: data.authorUsername,
        authorAvatarUrl: data.authorAvatarUrl,
        content: data.content,
        mediaType: data.mediaType || 'none',
        mediaUrl: data.mediaUrl,
        videoDurationSecs: data.videoDurationSecs,
        reactions: '{}',
        shareCount: 0,
        viewsCount: 0,
        originalPostId: data.originalPostId,
        originalAuthorName: data.originalAuthorName,
        createdAt: new Date()
      }).catch(e => console.warn('createPost background DB insert note:', e?.message));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return newPost;
}

export async function incrementPostViews(postId: string): Promise<number> {
  let newCount = 1;
  const fallbackList = loadFallbackPosts();
  const targetPost = fallbackList.find(p => p.id === postId);

  if (targetPost) {
    targetPost.viewsCount = (targetPost.viewsCount || 0) + 1;
    newCount = targetPost.viewsCount;
    saveFallbackPosts(fallbackList);
  }

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const p = await db.select().from(posts).where(eq(posts.id, postId));
      if (p.length) {
        const currentCount = p[0].viewsCount || 0;
        newCount = currentCount + 1;
        await db.update(posts).set({ viewsCount: newCount }).where(eq(posts.id, postId));
      }
    } catch (err) {
      console.warn('Postgres increment view count warning:', err);
    }
  }

  return newCount;
}

export async function togglePostReaction(postId: string, userId: string, reaction: PostReactionType): Promise<Post | null> {
  const fallbackList = loadFallbackPosts();
  const targetPost = fallbackList.find(p => p.id === postId);

  if (targetPost) {
    if (!targetPost.reactions) targetPost.reactions = {};
    if (targetPost.reactions[userId] === reaction) {
      delete targetPost.reactions[userId];
    } else {
      targetPost.reactions[userId] = reaction;
    }
    saveFallbackPosts(fallbackList);
  }

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const p = await db.select().from(posts).where(eq(posts.id, postId));
      if (p.length) {
        let rxMap: Record<string, PostReactionType> = {};
        try { rxMap = JSON.parse(p[0].reactions || '{}'); } catch {}

        if (rxMap[userId] === reaction) {
          delete rxMap[userId];
        } else {
          rxMap[userId] = reaction;
        }
        await db.update(posts).set({ reactions: JSON.stringify(rxMap) }).where(eq(posts.id, postId));
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return targetPost || null;
}

export async function addPostComment(data: {
  postId: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string;
  content: string;
}): Promise<Post | null> {
  const cmtId = 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newComment: PostComment = {
    id: cmtId,
    postId: data.postId,
    userId: data.userId,
    authorName: data.authorName,
    authorUsername: data.authorUsername,
    authorAvatarUrl: data.authorAvatarUrl,
    content: data.content,
    createdAt: new Date().toISOString()
  };

  const fallbackList = loadFallbackPosts();
  const targetPost = fallbackList.find(p => p.id === data.postId);
  if (targetPost) {
    if (!targetPost.comments) targetPost.comments = [];
    targetPost.comments.push(newComment);
    saveFallbackPosts(fallbackList);
  }

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.insert(postComments).values({
        id: cmtId,
        postId: data.postId,
        userId: data.userId,
        authorName: data.authorName,
        authorUsername: data.authorUsername,
        authorAvatarUrl: data.authorAvatarUrl,
        content: data.content,
        createdAt: new Date()
      });
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return targetPost || null;
}

export async function deletePost(postId: string, userId: string): Promise<boolean> {
  const fallbackList = loadFallbackPosts();
  const filtered = fallbackList.filter(p => !(p.id === postId && p.userId === userId));
  saveFallbackPosts(filtered);

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(postComments).where(eq(postComments.postId, postId));
      await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, userId)));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  return true;
}

export async function sharePost(postId: string, userId: string, user: User): Promise<Post | null> {
  const fallbackList = loadFallbackPosts();
  const orig = fallbackList.find(p => p.id === postId);

  if (!orig) return null;

  orig.shareCount = (orig.shareCount || 0) + 1;
  saveFallbackPosts(fallbackList);

  return await createPost({
    userId,
    authorName: user.nickname,
    authorUsername: user.username,
    authorAvatarUrl: user.avatarUrl,
    content: orig.content || '',
    mediaType: orig.mediaType || 'none',
    mediaUrl: orig.mediaUrl,
    videoDurationSecs: orig.videoDurationSecs,
    originalPostId: orig.id,
    originalAuthorName: orig.authorName
  });
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const rows = await db.select().from(notifications).where(eq(notifications.recipientUserId, userId)).orderBy(desc(notifications.createdAt));
      const result: AppNotification[] = [];
      for (const n of rows) {
        const sender = await getUserById(n.senderUserId);
        result.push({
          id: n.id,
          recipientUserId: n.recipientUserId,
          senderUserId: n.senderUserId,
          senderName: sender?.nickname || n.senderName,
          senderAvatarUrl: sender?.avatarUrl || n.senderAvatarUrl || undefined,
          senderBorderId: sender?.borderId,
          type: (n.type as any),
          postId: n.postId || undefined,
          text: n.text,
          isRead: n.isRead ?? false,
          createdAt: n.createdAt ? n.createdAt.toISOString() : new Date().toISOString()
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  return store.notifications[userId] || [];
}

export async function createNotification(payload: {
  recipientUserId: string;
  senderUserId: string;
  senderName: string;
  senderAvatarUrl?: string;
  type: any;
  postId?: string;
  text: string;
}) {
  if (payload.recipientUserId === payload.senderUserId) return null;
  const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.insert(notifications).values({
        id: notifId,
        recipientUserId: payload.recipientUserId,
        senderUserId: payload.senderUserId,
        senderName: payload.senderName,
        senderAvatarUrl: payload.senderAvatarUrl,
        type: payload.type,
        postId: payload.postId,
        text: payload.text,
        isRead: false,
        createdAt: new Date()
      });
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  if (!store.notifications[payload.recipientUserId]) store.notifications[payload.recipientUserId] = [];
  const sender = await getUserById(payload.senderUserId);
  const newNotif: AppNotification = {
    id: notifId,
    recipientUserId: payload.recipientUserId,
    senderUserId: payload.senderUserId,
    senderName: sender?.nickname || payload.senderName,
    senderAvatarUrl: sender?.avatarUrl || payload.senderAvatarUrl,
    senderBorderId: sender?.borderId,
    type: payload.type,
    postId: payload.postId,
    text: payload.text,
    isRead: false,
    createdAt: new Date().toISOString()
  };
  store.notifications[payload.recipientUserId].unshift(newNotif);
  saveJsonStore();

  return newNotif;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  for (const uid in store.notifications) {
    const n = store.notifications[uid].find(item => item.id === id);
    if (n) {
      n.isRead = true;
      saveJsonStore();
      break;
    }
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.recipientUserId, userId));
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  if (store.notifications[userId]) {
    store.notifications[userId].forEach(n => n.isRead = true);
    saveJsonStore();
  }
}

export async function getDailyPhotoCount(userId: string, date: string): Promise<number> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const res = await db.select().from(dailyPhotoUploads).where(and(eq(dailyPhotoUploads.userId, userId), eq(dailyPhotoUploads.date, date)));
      return res.length ? (res[0].count || 0) : 0;
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const id = `${userId}_${date}`;
  return store.dailyPhotoUploads[id] || 0;
}

export async function incrementDailyPhotoCount(userId: string, date: string): Promise<number> {
  const current = await getDailyPhotoCount(userId, date);
  const newCount = current + 1;
  const id = `${userId}_${date}`;

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.insert(dailyPhotoUploads).values({
        id,
        userId,
        date,
        count: newCount
      }).onConflictDoUpdate({
        target: dailyPhotoUploads.id,
        set: { count: newCount }
      });
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  store.dailyPhotoUploads[id] = newCount;
  saveJsonStore();

  return newCount;
}

export async function getFriendRequests(userId: string): Promise<FriendRequest[]> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const rows = await db.select().from(friendRequests).where(or(eq(friendRequests.receiverId, userId), eq(friendRequests.senderId, userId))).orderBy(desc(friendRequests.createdAt));
      const result: FriendRequest[] = [];
      for (const r of rows) {
        const senderUser = await getUserById(r.senderId);
        const receiverUser = await getUserById(r.receiverId);
        result.push({
          id: r.id,
          senderId: r.senderId,
          senderUser: senderUser || undefined,
          receiverId: r.receiverId,
          receiverUser: receiverUser || undefined,
          status: (r.status as any) || 'pending',
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString()
        });
      }
      return result;
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const result: FriendRequest[] = [];
  for (const r of store.friendRequests) {
    if (r.receiverId === userId || r.senderId === userId) {
      const senderUser = await getUserById(r.senderId);
      const receiverUser = await getUserById(r.receiverId);
      result.push({
        id: r.id,
        senderId: r.senderId,
        senderUser: senderUser || undefined,
        receiverId: r.receiverId,
        receiverUser: receiverUser || undefined,
        status: r.status as any || 'pending',
        createdAt: r.createdAt || new Date().toISOString()
      });
    }
  }
  return result;
}

export async function sendFriendRequest(senderId: string, receiverId: string): Promise<FriendRequest> {
  const reqId = 'freq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(friendRequests).where(
        or(
          and(eq(friendRequests.senderId, senderId), eq(friendRequests.receiverId, receiverId)),
          and(eq(friendRequests.senderId, receiverId), eq(friendRequests.receiverId, senderId))
        )
      );
      await db.insert(friendRequests).values({
        id: reqId,
        senderId,
        receiverId,
        status: 'pending',
        createdAt: new Date()
      });
      await followUser(senderId, receiverId);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  store.friendRequests = store.friendRequests.filter(r => 
    !((r.senderId === senderId && r.receiverId === receiverId) || (r.senderId === receiverId && r.receiverId === senderId))
  );
  store.friendRequests.push({
    id: reqId,
    senderId,
    receiverId,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  saveJsonStore();
  await followUser(senderId, receiverId);

  const reqs = await getFriendRequests(receiverId);
  return reqs.find(r => r.id === reqId)!;
}

export async function cancelFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(friendRequests).where(
        and(
          eq(friendRequests.senderId, senderId),
          eq(friendRequests.receiverId, receiverId),
          eq(friendRequests.status, 'pending')
        )
      );
      await unfollowUser(senderId, receiverId);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  store.friendRequests = store.friendRequests.filter(r =>
    !(r.senderId === senderId && r.receiverId === receiverId && r.status === 'pending')
  );
  saveJsonStore();
  await unfollowUser(senderId, receiverId);
  return true;
}

export async function respondFriendRequest(requestId: string, status: 'accepted' | 'rejected'): Promise<FriendRequest | null> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const reqRow = await db.select().from(friendRequests).where(eq(friendRequests.id, requestId));
      if (reqRow.length) {
        await db.update(friendRequests).set({ status }).where(eq(friendRequests.id, requestId));
        if (status === 'accepted') {
          const shipId = 'ship_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          await db.insert(friendships).values({
            id: shipId,
            user1Id: reqRow[0].senderId,
            user2Id: reqRow[0].receiverId,
            createdAt: new Date()
          });
          await followUser(reqRow[0].senderId, reqRow[0].receiverId);
          await followUser(reqRow[0].receiverId, reqRow[0].senderId);
        } else if (status === 'rejected') {
          await unfollowUser(reqRow[0].senderId, reqRow[0].receiverId);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const req = store.friendRequests.find(r => r.id === requestId);
  if (req) {
    req.status = status;
    if (status === 'accepted') {
      store.friendships.push({
        id: 'ship_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user1Id: req.senderId,
        user2Id: req.receiverId,
        createdAt: new Date().toISOString()
      });
      await followUser(req.senderId, req.receiverId);
      await followUser(req.receiverId, req.senderId);
    } else if (status === 'rejected') {
      await unfollowUser(req.senderId, req.receiverId);
    }
    saveJsonStore();
    const reqs = await getFriendRequests(req.receiverId);
    return reqs.find(r => r.id === requestId) || null;
  }
  return null;
}

export async function getFriendships(userId: string): Promise<string[]> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const rows = await db.select().from(friendships).where(or(eq(friendships.user1Id, userId), eq(friendships.user2Id, userId)));
      return rows.map(f => f.user1Id === userId ? f.user2Id : f.user1Id);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const friends: string[] = [];
  store.friendships.forEach(f => {
    if (f.user1Id === userId) friends.push(f.user2Id);
    else if (f.user2Id === userId) friends.push(f.user1Id);
  });
  return friends;
}

export async function removeFriendship(user1Id: string, user2Id: string): Promise<boolean> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(friendships).where(
        or(
          and(eq(friendships.user1Id, user1Id), eq(friendships.user2Id, user2Id)),
          and(eq(friendships.user1Id, user2Id), eq(friendships.user2Id, user1Id))
        )
      );
      await db.delete(friendRequests).where(
        or(
          and(eq(friendRequests.senderId, user1Id), eq(friendRequests.receiverId, user2Id)),
          and(eq(friendRequests.senderId, user2Id), eq(friendRequests.receiverId, user1Id))
        )
      );
      await unfollowUser(user1Id, user2Id);
      await unfollowUser(user2Id, user1Id);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  store.friendships = store.friendships.filter(f =>
    !((f.user1Id === user1Id && f.user2Id === user2Id) || (f.user1Id === user2Id && f.user2Id === user1Id))
  );
  store.friendRequests = store.friendRequests.filter(r =>
    !((r.senderId === user1Id && r.receiverId === user2Id) || (r.senderId === user2Id && r.receiverId === user1Id))
  );
  saveJsonStore();
  await unfollowUser(user1Id, user2Id);
  await unfollowUser(user2Id, user1Id);
  return true;
}

export async function followUser(followerId: string, followingId: string): Promise<boolean> {
  if (followerId === followingId) return false;

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      const fid = `fol_${followerId}_${followingId}`;
      await db.insert(follows).values({
        id: fid,
        followerId,
        followingId,
        createdAt: new Date()
      }).onConflictDoNothing();
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const fid = `fol_${followerId}_${followingId}`;
  if (!store.follows.some(f => f.followerId === followerId && f.followingId === followingId)) {
    store.follows.push({
      id: fid,
      followerId,
      followingId,
      createdAt: new Date().toISOString()
    });
    saveJsonStore();
  }
  return true;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<boolean> {
  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await db.delete(follows).where(
        and(eq(follows.followerId, followerId), eq(follows.followingId, followingId))
      );
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  store.follows = store.follows.filter(f => !(f.followerId === followerId && f.followingId === followingId));
  saveJsonStore();
  return true;
}

export async function getFollowers(userId: string): Promise<User[]> {
  const friendIds = await getFriendships(userId);
  let extraFollowerIds: string[] = [];
  let pendingSenderIds: string[] = [];

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await ensureSchemaChecked();
      const followRows = await db.select().from(follows).where(eq(follows.followingId, userId));
      extraFollowerIds = followRows.map(f => f.followerId);

      const reqRows = await db.select().from(friendRequests).where(and(eq(friendRequests.receiverId, userId), eq(friendRequests.status, 'pending')));
      pendingSenderIds = reqRows.map(r => r.senderId);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const storeExtra = store.follows.filter(f => f.followingId === userId).map(f => f.followerId);
  const storePending = store.friendRequests.filter(r => r.receiverId === userId && r.status === 'pending').map(r => r.senderId);

  const allFollowerIds = Array.from(new Set([...friendIds, ...extraFollowerIds, ...storeExtra, ...pendingSenderIds, ...storePending])).filter(id => id !== userId);

  const followerUsers: User[] = [];
  for (const id of allFollowerIds) {
    const u = await getUserById(id);
    if (u) followerUsers.push(u);
  }
  return followerUsers;
}

export async function getFollowing(userId: string): Promise<User[]> {
  const friendIds = await getFriendships(userId);
  let extraFollowingIds: string[] = [];
  let pendingReceiverIds: string[] = [];

  if (isPostgresConfigured() && await isPostgresActive()) {
    try {
      await ensureSchemaChecked();
      const followRows = await db.select().from(follows).where(eq(follows.followerId, userId));
      extraFollowingIds = followRows.map(f => f.followingId);

      const reqRows = await db.select().from(friendRequests).where(and(eq(friendRequests.senderId, userId), eq(friendRequests.status, 'pending')));
      pendingReceiverIds = reqRows.map(r => r.receiverId);
    } catch (err: any) {
      if (err?.message?.includes('ECONNREFUSED') || err?.cause?.message?.includes('ECONNREFUSED')) {
        markPostgresInactive();
      }
    }
  }

  const store = getJsonStore();
  const storeExtra = store.follows.filter(f => f.followerId === userId).map(f => f.followingId);
  const storePending = store.friendRequests.filter(r => r.senderId === userId && r.status === 'pending').map(r => r.receiverId);

  const allFollowingIds = Array.from(new Set([...friendIds, ...extraFollowingIds, ...storeExtra, ...pendingReceiverIds, ...storePending])).filter(id => id !== userId);

  const followingUsers: User[] = [];
  for (const id of allFollowingIds) {
    const u = await getUserById(id);
    if (u) followingUsers.push(u);
  }
  return followingUsers;
}

export async function getFollowersCount(userId: string): Promise<number> {
  const list = await getFollowers(userId);
  return list.length;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const list = await getFollowing(userId);
  return list.length;
}

