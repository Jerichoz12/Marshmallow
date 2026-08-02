// Utility to manage per-user per-partner custom nicknames in chat section
import { saveChatNickname } from '../services/api';

const STORAGE_PREFIX = 'marshmallow_chat_nicknames_';

/**
 * Get all custom chat nicknames set by current user
 */
export function getAllChatNicknames(userId: string): Record<string, string> {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Get custom chat nickname for a specific partner
 */
export function getChatNickname(userId: string, partnerId: string): string | null {
  if (!userId || !partnerId) return null;
  const map = getAllChatNicknames(userId);
  return map[partnerId] || null;
}

/**
 * Set custom chat nickname for a specific partner
 */
export function setChatNickname(userId: string, partnerId: string, nickname: string): void {
  if (!userId || !partnerId) return;
  try {
    const key = `${STORAGE_PREFIX}${userId}`;
    const map = getAllChatNicknames(userId);
    const clean = nickname.trim();

    if (!clean) {
      delete map[partnerId];
    } else {
      map[partnerId] = clean;
    }

    localStorage.setItem(key, JSON.stringify(map));

    // Async sync with API server
    saveChatNickname(partnerId, clean);

    // Dispatch custom event to re-render chat components immediately
    window.dispatchEvent(new CustomEvent('chat_nickname_changed', {
      detail: { userId, partnerId, nickname: clean }
    }));
  } catch (e) {
    console.error('Failed to set chat nickname', e);
  }
}

/**
 * Helper to get display name for chat partner: returns custom chat nickname if set, otherwise falls back to profile nickname or username
 */
export function getPartnerChatDisplayName(
  partner: { id: string; nickname?: string; username: string } | null | undefined,
  currentUserId: string
): string {
  if (!partner) return 'Chat';
  const custom = getChatNickname(currentUserId, partner.id);
  if (custom && custom.trim() !== '') {
    return custom;
  }
  return partner.nickname || partner.username || 'User';
}
