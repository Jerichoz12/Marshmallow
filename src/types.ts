export type UserStatus = 'online' | 'offline';

export type PhonePrivacy = 'public' | 'friends' | 'only_me';
export type ProfilePrivacy = 'public' | 'only_me';
export type ListPrivacy = 'public' | 'friends' | 'only_me';

export interface User {
  id: string;
  username: string;
  codeNumber?: string;
  usernameChanged?: boolean;
  usernameLastChangedAt?: string | null;
  gender?: 'male' | 'female';
  birthday?: string;
  nickname: string;
  nicknameLastChangedAt: string | null; // ISO string
  avatarUrl?: string;
  borderId?: number;
  coverUrl?: string;
  bio?: string;
  age?: string;
  hometown?: string;
  school?: string;
  work?: string;
  phone?: string;
  phonePrivacy?: PhonePrivacy;
  profilePrivacy?: ProfilePrivacy;
  followersPrivacy?: ListPrivacy;
  followingPrivacy?: ListPrivacy;
  followersCount?: number;
  followingCount?: number;
  status: UserStatus;
  lastSeenAt: string;
  createdAt: string;
}

export type MediaType = 'text' | 'image' | 'video' | 'file' | 'audio';

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderUsername?: string;
  senderNickname?: string;
  senderAvatarUrl?: string;
  senderBorderId?: number;
  content: string;
  mediaType?: MediaType;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  audioDuration?: number;
  replyToMessageId?: string;
  replyToMessage?: {
    id: string;
    senderNickname?: string;
    content: string;
    mediaType?: MediaType;
  };
  reactions: Record<string, string[]>; // emoji -> array of userIds
  isPinned?: boolean;
  isEdited?: boolean;
  isUnsent?: boolean;
  hiddenFor?: string[];
  seenBy: string[]; // array of userIds who saw this message
  createdAt: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  participantUsers?: User[];
  lastMessage?: Message;
  unreadCount?: number;
  updatedAt: string;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderUser?: User;
  receiverId: string;
  receiverUser?: User;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface CallSignalPayload {
  callId: string;
  callerId: string;
  callerUsername: string;
  callerNickname: string;
  callerAvatarUrl?: string;
  receiverId: string;
  type: 'video' | 'audio';
  sdp?: any;
  candidate?: any;
  reason?: string;
}

export interface ActiveCallState {
  callId: string;
  peerId: string; // The user ID on the other end
  peerUsername: string;
  peerNickname: string;
  peerAvatarUrl?: string;
  peerBorderId?: number;
  type: 'video' | 'audio';
  isCaller: boolean;
  status: 'ringing' | 'connected' | 'ended';
  startTime?: number;
}

export interface UserSettings {
  theme: 'dark' | 'light';
  notificationsEnabled: boolean;
  readReceipts: boolean;
  onlineStatusVisible: boolean;
}

// FB-Style Posts & Social Features
export type PostReactionType = 'like' | 'heart' | 'care' | 'haha' | 'wow' | 'sad' | 'angry';

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string;
  authorBorderId?: number;
  content: string;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl?: string;
  authorBorderId?: number;
  content: string;
  mediaType?: 'none' | 'image' | 'video';
  mediaUrl?: string;
  videoDurationSecs?: number;
  reactions: Record<string, PostReactionType>; // userId -> reactionType
  comments: PostComment[];
  shareCount: number;
  viewsCount?: number;
  isViral?: boolean;
  originalPostId?: string;
  originalAuthorName?: string;
  createdAt: string;
}

// Notifications
export type NotificationType = 'friend_request' | 'friend_accept' | 'post_like' | 'post_comment' | 'post_share';

export interface AppNotification {
  id: string;
  recipientUserId: string;
  senderUserId: string;
  senderName: string;
  senderAvatarUrl?: string;
  senderBorderId?: number;
  type: NotificationType;
  postId?: string;
  text: string;
  isRead: boolean;
  createdAt: string;
}

export type WsEventType =
  | 'auth'
  | 'presence_update'
  | 'typing_status'
  | 'message_new'
  | 'message_update'
  | 'message_delete'
  | 'message_seen'
  | 'friend_request_new'
  | 'friend_request_update'
  | 'call_offer'
  | 'call_answer'
  | 'call_ice_candidate'
  | 'call_decline'
  | 'call_end'
  | 'call_busy'
  | 'post_new'
  | 'post_update'
  | 'notification_new'
  | 'message_reaction_notice';

export interface WsMessage {
  type: WsEventType;
  payload: any;
}

