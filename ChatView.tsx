import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Video,
  Search,
  Pin,
  X,
  ChevronLeft,
  Users,
  Tag
} from 'lucide-react';
import { Chat, Message, User } from '../types';
import {
  fetchMessages,
  sendMessage,
  editMessage,
  markChatSeen,
  wsManager
} from '../services/api';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { UserAvatar } from './UserAvatar';
import { ChatNicknameModal } from './ChatNicknameModal';
import { playMessageSound } from '../utils/sound';
import { formatLastSeen } from '../utils/formatLastSeen';
import { getPartnerChatDisplayName } from '../utils/chatNicknames';
import { VerifiedBadge, isDeveloperUser } from './VerifiedBadge';

interface ChatViewProps {
  activeChat: Chat;
  currentUser: User;
  onBackMobile: () => void;
  onStartCall: (friend: User) => void;
  onOpenUserProfile?: (userId: string) => void;
  onImageClick?: (imageUrl: string) => void;
  onMessagesSeen?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  activeChat,
  currentUser,
  onBackMobile,
  onStartCall,
  onOpenUserProfile,
  onImageClick,
  onMessagesSeen
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [isLongPressMenuOpen, setIsLongPressMenuOpen] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameVersion, setNicknameVersion] = useState(0);

  // Message reply & edit state
  const [replyTargetMsg, setReplyTargetMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);

  // Find direct partner user profile
  const partnerUser = activeChat.participantUsers?.find(u => u.id !== currentUser.id);

  // Real-time listener for chat nickname updates
  useEffect(() => {
    const handleNicknameUpdate = (e: any) => {
      setNicknameVersion(v => v + 1);
    };
    window.addEventListener('chat_nickname_changed', handleNicknameUpdate);
    return () => {
      window.removeEventListener('chat_nickname_changed', handleNicknameUpdate);
    };
  }, []);

  const partnerDisplayName = getPartnerChatDisplayName(partnerUser, currentUser.id);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const msgs = await fetchMessages(activeChat.id);
      setMessages(msgs);
      await markChatSeen(activeChat.id);
      onMessagesSeen?.();
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [activeChat.id]);

  // WebSocket Event Listeners for real-time messages & typing
  useEffect(() => {
    const unbindMsg = wsManager.on('message_new', (payload: Message) => {
      if (payload.chatId === activeChat.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
        markChatSeen(activeChat.id).then(() => onMessagesSeen?.());

        if (payload.senderId !== currentUser.id) {
          playMessageSound();
        }
      }
    });

    const unbindUpdate = wsManager.on('message_update', (payload: Message) => {
      if (payload.chatId === activeChat.id) {
        setMessages((prev) => prev.map(m => (m.id === payload.id ? payload : m)));
        markChatSeen(activeChat.id).then(() => onMessagesSeen?.());
      }
    });

    const unbindDelete = wsManager.on('message_delete', (payload: { id: string; chatId: string }) => {
      if (payload.chatId === activeChat.id) {
        setMessages((prev) => prev.filter(m => m.id !== payload.id));
      }
    });

    const unbindTyping = wsManager.on('typing_status', (payload: { chatId: string; userId: string; isTyping: boolean }) => {
      if (payload.chatId === activeChat.id && payload.userId !== currentUser.id) {
        setIsPartnerTyping(payload.isTyping);
      }
    });

    return () => {
      unbindMsg();
      unbindUpdate();
      unbindDelete();
      unbindTyping();
    };
  }, [activeChat.id, currentUser.id]);

  const handleSendMessage = async (data: {
    content: string;
    mediaType?: 'text' | 'image' | 'video' | 'file' | 'audio';
    mediaUrl?: string;
    mediaName?: string;
    mediaSize?: number;
    audioDuration?: number;
    replyToMessageId?: string;
  }) => {
    if (editingMsg) {
      // Handle Edit
      try {
        await editMessage(editingMsg.id, data.content);
        setEditingMsg(null);
      } catch (e) {
        console.error('Edit message failed', e);
      }
      return;
    }

    try {
      const newMsg = await sendMessage({
        chatId: activeChat.id,
        ...data
      });
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setReplyTargetMsg(null);
    } catch (e) {
      console.error('Send message failed', e);
    }
  };

  const handleTypingStatus = (isTyping: boolean) => {
    wsManager.send('typing_status', {
      chatId: activeChat.id,
      isTyping
    });
  };

  const pinnedMessages = messages.filter(m => m.isPinned);

  const filteredMessages = messages.filter(m => {
    if (showPinnedOnly && !m.isPinned) return false;
    if (searchQuery.trim()) {
      return (m.content || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden overflow-x-hidden touch-pan-y bg-[#18191a] text-[#E4E6EB] select-none relative">
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-[#242526] border-b border-[#3A3B3C] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          {/* Mobile Back Button */}
          <button
            onClick={onBackMobile}
            className="md:hidden p-2 text-[#B0B3B8] hover:text-white rounded-xl hover:bg-[#3A3B3C] transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Partner Avatar & Status */}
          <div
            onClick={() => partnerUser && onOpenUserProfile?.(partnerUser.id)}
            className="flex items-center space-x-3 cursor-pointer hover:opacity-90 transition"
            title="View partner profile"
          >
            <div className="relative shrink-0">
              <UserAvatar
                userId={partnerUser?.id}
                borderId={partnerUser?.borderId}
                src={partnerUser?.avatarUrl}
                username={partnerUser?.username || 'chat'}
                nickname={partnerDisplayName}
                size="md"
                showStatus
                status={partnerUser?.status || 'offline'}
              />
            </div>

            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-bold text-sm text-white leading-tight flex items-center">
                  <span>{partnerDisplayName}</span>
                  {partnerUser && isDeveloperUser(partnerUser) && (
                    <VerifiedBadge className="w-4 h-4 ml-1 shrink-0" />
                  )}
                </h3>
                {partnerUser && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNicknameModal(true);
                    }}
                    className="p-1 text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] rounded-lg transition cursor-pointer"
                    title="Change Chat Nickname"
                  >
                    <Tag className="w-3.5 h-3.5 text-[#B0B3B8] hover:text-white" />
                  </button>
                )}
              </div>
              <p className="text-xs font-medium">
                {isPartnerTyping ? (
                  <span className="text-emerald-400 font-bold">Typing...</span>
                ) : (
                  <span className={partnerUser?.status === 'online' ? 'text-emerald-400 font-bold' : 'text-[#B0B3B8]'}>
                    {formatLastSeen(partnerUser?.status, partnerUser?.lastSeenAt)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 sm:space-x-2">

          {/* Chat Nickname Button */}
          {partnerUser && (
            <button
              onClick={() => setShowNicknameModal(true)}
              className="p-2.5 rounded-xl text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C] transition cursor-pointer flex items-center space-x-1"
              title="Change Chat Nickname"
            >
              <Tag className="w-4 h-4 text-[#B0B3B8]" />
            </button>
          )}
          {/* Search Messages in Chat */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              showSearch ? 'bg-[#3A3B3C] text-white' : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]'
            }`}
            title="Search conversation"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Filter Pinned Messages */}
          {pinnedMessages.length > 0 && (
            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={`p-2.5 rounded-xl transition cursor-pointer flex items-center space-x-1 ${
                showPinnedOnly ? 'bg-[#3A3B3C] text-white' : 'text-[#B0B3B8] hover:text-white hover:bg-[#3A3B3C]'
              }`}
              title="Pinned Messages"
            >
              <Pin className="w-4 h-4 fill-white" />
              <span className="text-xs font-bold text-white">{pinnedMessages.length}</span>
            </button>
          )}

          {/* Video Call Button */}
          {partnerUser && (
            <button
              onClick={() => onStartCall(partnerUser)}
              className="p-2.5 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-semibold flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <Video className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Video Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Message Search Bar Header */}
      {showSearch && (
        <div className="p-3 bg-[#242526] border-b border-[#3A3B3C] flex items-center space-x-2">
          <Search className="w-4 h-4 text-[#B0B3B8] ml-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search words in this chat..."
            className="flex-1 bg-transparent text-xs text-white placeholder-[#8A8D91] focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#B0B3B8] hover:text-white text-xs cursor-pointer">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Pinned Messages Bar */}
      {pinnedMessages.length > 0 && !showPinnedOnly && (
        <div className="p-2.5 bg-[#242526] border-b border-[#3A3B3C] flex items-center justify-between px-4 text-xs">
          <div className="flex items-center space-x-2 text-white truncate">
            <Pin className="w-3.5 h-3.5 shrink-0 fill-white" />
            <span className="font-semibold text-white uppercase tracking-wider text-[10px]">Pinned:</span>
            <span className="truncate">{pinnedMessages[pinnedMessages.length - 1].content || 'Media message'}</span>
          </div>
          <button
            onClick={() => setShowPinnedOnly(true)}
            className="text-[10px] font-bold text-white hover:underline shrink-0 ml-2 cursor-pointer"
          >
            View All ({pinnedMessages.length})
          </button>
        </div>
      )}

      {/* Messages Feed Area */}
      <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#18191a]">

        <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#3A3B3C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <MessageList
              messages={filteredMessages}
              currentUser={currentUser}
              onReplyMessage={(msg) => setReplyTargetMsg(msg)}
              onEditMessage={(msg) => setEditingMsg(msg)}
              onImageClick={onImageClick}
              onActiveMenuChange={setIsLongPressMenuOpen}
            />
          )}
        </div>
      </div>

      {/* Input Section - Smoothly slides down when long-press reaction menu is active so nothing is obscured */}
      <div className={`transition-all duration-300 ease-in-out transform ${
        isLongPressMenuOpen ? 'translate-y-full opacity-0 pointer-events-none h-0 overflow-hidden' : 'translate-y-0 opacity-100'
      }`}>
        <ChatInput
          onSendMessage={handleSendMessage}
          onTyping={handleTypingStatus}
          replyToMessage={replyTargetMsg}
          onCancelReply={() => {
            setReplyTargetMsg(null);
            setEditingMsg(null);
          }}
        />
      </div>

      {/* Custom Chat Nickname Modal */}
      {showNicknameModal && partnerUser && (
        <ChatNicknameModal
          currentUser={currentUser}
          partner={partnerUser}
          chatId={activeChat.id}
          onClose={() => setShowNicknameModal(false)}
          onUpdated={() => {
            loadMessages();
          }}
        />
      )}
    </div>
  );
};
