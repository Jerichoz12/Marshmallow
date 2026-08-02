import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname').notNull(),
  nicknameLastChangedAt: timestamp('nickname_last_changed_at'),
  avatarUrl: text('avatar_url'),
  borderId: integer('border_id'),
  coverUrl: text('cover_url'),
  bio: text('bio'),
  age: text('age'),
  gender: text('gender'),
  birthday: text('birthday'),
  usernameChanged: boolean('username_changed').default(false),
  usernameLastChangedAt: timestamp('username_last_changed_at'),
  hometown: text('hometown'),
  school: text('school'),
  work: text('work'),
  phone: text('phone'),
  phonePrivacy: text('phone_privacy').default('public'),
  profilePrivacy: text('profile_privacy').default('public'),
  followersPrivacy: text('followers_privacy').default('public'),
  followingPrivacy: text('following_privacy').default('public'),
  status: text('status').default('online'),
  lastSeenAt: timestamp('last_seen_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const follows = pgTable('follows', {
  id: text('id').primaryKey(),
  followerId: text('follower_id').notNull(),
  followingId: text('following_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const friendRequests = pgTable('friend_requests', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
  status: text('status').notNull(), // 'pending' | 'accepted' | 'rejected'
  createdAt: timestamp('created_at').defaultNow(),
});

export const friendships = pgTable('friendships', {
  id: text('id').primaryKey(),
  user1Id: text('user1_id').notNull(),
  user2Id: text('user2_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'direct' | 'group'
  participants: text('participants').notNull(), // JSON array string
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  senderId: text('sender_id').notNull(),
  content: text('content').notNull(),
  mediaType: text('media_type'),
  mediaUrl: text('media_url'),
  mediaName: text('media_name'),
  mediaSize: integer('media_size'),
  audioDuration: integer('audio_duration'),
  replyToMessageId: text('reply_to_message_id'),
  reactions: text('reactions').default('{}'), // JSON Record<string, string[]>
  isPinned: boolean('is_pinned').default(false),
  isEdited: boolean('is_edited').default(false),
  isUnsent: boolean('is_unsent').default(false),
  hiddenFor: text('hidden_for').default('[]'), // JSON array string
  seenBy: text('seen_by').default('[]'), // JSON array string
  createdAt: timestamp('created_at').defaultNow(),
});

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  authorName: text('author_name').notNull(),
  authorUsername: text('author_username').notNull(),
  authorAvatarUrl: text('author_avatar_url'),
  content: text('content'),
  mediaType: text('media_type'),
  mediaUrl: text('media_url'),
  videoDurationSecs: integer('video_duration_secs'),
  reactions: text('reactions').default('{}'),
  shareCount: integer('share_count').default(0),
  viewsCount: integer('views_count').default(0),
  originalPostId: text('original_post_id'),
  originalAuthorName: text('original_author_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const postComments = pgTable('post_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  userId: text('user_id').notNull(),
  authorName: text('author_name').notNull(),
  authorUsername: text('author_username').notNull(),
  authorAvatarUrl: text('author_avatar_url'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  recipientUserId: text('recipient_user_id').notNull(),
  senderUserId: text('sender_user_id').notNull(),
  senderName: text('sender_name').notNull(),
  senderAvatarUrl: text('sender_avatar_url'),
  type: text('type').notNull(),
  postId: text('post_id'),
  text: text('text').notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey(),
  theme: text('theme').default('dark'),
  notificationsEnabled: boolean('notifications_enabled').default(true),
  readReceipts: boolean('read_receipts').default(true),
  onlineStatusVisible: boolean('online_status_visible').default(true),
});

export const dailyPhotoUploads = pgTable('daily_photo_uploads', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  date: text('date').notNull(),
  count: integer('count').default(0),
});
