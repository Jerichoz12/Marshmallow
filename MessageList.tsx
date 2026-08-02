import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Check,
  CheckCheck,
  MoreVertical,
  Pin,
  Reply,
  Trash2,
  Edit2,
  FileText,
  Download,
  Smile,
  Volume2,
  RotateCcw,
  EyeOff,
  Ban,
  Copy,
  Plus,
  X,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { Message, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { LiveEmoji } from './LiveEmoji';
import { reactMessage, pinMessage, deleteMessage, unsendMessage } from '../services/api';
import { playTouchSound, playLongPressSound, playReactionPopSound } from '../utils/audioSound';

interface MessageListProps {
  messages: Message[];
  currentUser: User;
  onReplyMessage: (msg: Message) => void;
  onEditMessage: (msg: Message) => void;
  onImageClick?: (imageUrl: string) => void;
  onActiveMenuChange?: (isOpen: boolean) => void;
}

// Messenger Primary Emoji Reactions (Matches Screenshot 1)
const MESSENGER_PRIMARY_EMOJIS = ['❤️', '😆', '😮', '😢', '😡', '👍'];

// Expanded Emojis for '+' button
const EXPANDED_EMOJIS = [
  '❤️', '😆', '😮', '😢', '😡', '👍',
  '🔥', '🎉', '💖', '👏', '💯', '🙏',
  '😍', '👀', '⚡', '✨', '🥳', '🤔',
  '😎', '🙌', '💔', '💩', '💙', '💜',
  '💚', '💛', '🧡', '⭐'
];

export const MessageList: React.FC<MessageListProps> = React.memo(({
  messages,
  currentUser,
  onReplyMessage,
  onEditMessage,
  onImageClick,
  onActiveMenuChange
}) => {
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);

  useEffect(() => {
    onActiveMenuChange?.(Boolean(activeMenuMsgId));
  }, [activeMenuMsgId, onActiveMenuChange]);
  const [activeMsgRect, setActiveMsgRect] = useState<{
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } | null>(null);
  const [showMoreEmojiPicker, setShowMoreEmojiPicker] = useState<string | null>(null);
  const [showUnsendModal, setShowUnsendModal] = useState<string | null>(null);
  const [selectedLightboxMedia, setSelectedLightboxMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio note playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Long press gesture refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef<boolean>(false);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const captureRect = (el: HTMLElement) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setActiveMsgRect({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  const toggleAudio = (msgId: string, url: string) => {
    const currentAudio = audioRefs.current[msgId];
    if (!currentAudio) return;

    if (playingAudioId === msgId) {
      currentAudio.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId]?.pause();
      }
      currentAudio.play();
      setPlayingAudioId(msgId);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    playReactionPopSound();
    setActiveMenuMsgId(null);
    setShowMoreEmojiPicker(null);
    try {
      await reactMessage(msgId, emoji);
    } catch (e) {
      console.error('Failed to react to message:', e);
    }
  };

  const handleCopyText = (content: string) => {
    playTouchSound();
    setActiveMenuMsgId(null);
    if (!content) return;
    navigator.clipboard.writeText(content);
    showToast('Message copied to clipboard');
  };

  const handlePin = async (msgId: string) => {
    playTouchSound();
    setActiveMenuMsgId(null);
    try {
      await pinMessage(msgId);
    } catch (e) {
      console.error('Failed to pin message:', e);
    }
  };

  const handleUnsend = async (msgId: string, type: 'everyone' | 'me') => {
    playTouchSound();
    setActiveMenuMsgId(null);
    setShowUnsendModal(null);
    try {
      await unsendMessage(msgId, type);
    } catch (e) {
      console.error('Failed to unsend message:', e);
    }
  };

  // Long press gesture event handlers
  const handlePointerStart = (e: React.TouchEvent | React.MouseEvent, msgId: string) => {
    longPressFiredRef.current = false;
    const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartPosRef.current = { x: clientX, y: clientY };

    const targetEl = e.currentTarget as HTMLElement;

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      playTouchSound();
      if (navigator.vibrate) navigator.vibrate(50);
      if (targetEl) captureRect(targetEl);
      setActiveMenuMsgId(msgId);
    }, 280);
  };

  const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches[0] ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const dx = clientX - touchStartPosRef.current.x;
    const dy = clientY - touchStartPosRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only cancel long press if finger moved more than 12px
    if (dist > 12) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handlePointerEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (longPressFiredRef.current) {
      try {
        if (e.cancelable) e.preventDefault();
      } catch {}
      e.stopPropagation();
    }
  };

  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, msgId: string) => {
    try {
      if (e.cancelable) e.preventDefault();
    } catch {}
    e.stopPropagation();
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (e.currentTarget) {
      captureRect(e.currentTarget as HTMLElement);
    }
    if (!activeMenuMsgId) {
      playLongPressSound();
      if (navigator.vibrate) navigator.vibrate(40);
      setActiveMenuMsgId(msgId);
    }
    longPressFiredRef.current = true;
  };

  const handleBubbleClick = (e: React.MouseEvent, msgId: string, isUnsent?: boolean) => {
    e.stopPropagation();
    if (longPressFiredRef.current) {
      // Consume click triggered on long press release
      longPressFiredRef.current = false;
      return;
    }
    if (isUnsent) return;

    if (e.currentTarget) {
      captureRect(e.currentTarget as HTMLElement);
    }

    if (activeMenuMsgId) {
      setActiveMenuMsgId(activeMenuMsgId === msgId ? null : msgId);
      if (activeMenuMsgId === msgId) setActiveMsgRect(null);
    }
  };

  // Filter messages hidden for current user ("Unsend for me")
  const visibleMessages = messages.filter(
    (msg) => !(Array.isArray(msg.hiddenFor) && currentUser?.id && msg.hiddenFor.includes(currentUser.id))
  );

  const activeMsg = messages.find((m) => m.id === activeMenuMsgId);

  const getCalculatedEmojiPosition = () => {
    if (!activeMsg || !activeMsgRect) {
      return { top: 100, left: 16 };
    }
    const isMe = activeMsg.senderId === currentUser.id;

    // Ideal top position: 62px above message bubble
    let top = activeMsgRect.top - 62;

    // If top < 70 (too close to top screen/header), position BELOW message bubble
    if (top < 70) {
      top = activeMsgRect.bottom + 12;
    }

    // Clamp top so it never goes into bottom action bar
    const maxTop = (window.innerHeight || 700) - 150;
    if (top > maxTop) {
      top = maxTop;
    }
    if (top < 70) {
      top = 70;
    }

    if (isMe) {
      const right = Math.max(16, Math.min(window.innerWidth - 300, window.innerWidth - activeMsgRect.right));
      return { top, right };
    } else {
      const left = Math.max(16, Math.min(window.innerWidth - 300, activeMsgRect.left));
      return { top, left };
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full p-3 sm:p-4 space-y-5 min-h-0 relative touch-pan-y">
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-pink-500/30 text-white text-xs px-4 py-2 rounded-full shadow-2xl flex items-center space-x-2 backdrop-blur-md"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Lightbox Modal */}
      {selectedLightboxMedia && (
        <div
          onClick={() => setSelectedLightboxMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          {selectedLightboxMedia.type === 'image' ? (
            <img
              src={selectedLightboxMedia.url}
              alt="Media"
              className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
            />
          ) : (
            <video
              src={selectedLightboxMedia.url}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
            />
          )}
        </div>
      )}

      {/* Expanded Emoji Picker Modal */}
      {showMoreEmojiPicker && (
        <div
          onClick={() => setShowMoreEmojiPicker(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#242526] border border-zinc-700 p-4 rounded-3xl shadow-2xl max-w-xs w-full"
          >
            <div className="flex items-center justify-between mb-3 border-b border-zinc-700/80 pb-2">
              <h4 className="text-xs font-bold text-zinc-200">Choose Reaction</h4>
              <button
                onClick={() => setShowMoreEmojiPicker(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-2xl">
              {EXPANDED_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(showMoreEmojiPicker, emoji)}
                  className="hover:scale-130 active:scale-95 transition-transform p-1.5 rounded-xl hover:bg-zinc-800 flex items-center justify-center cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Unsend Dialog Modal */}
      {showUnsendModal && (
        <div
          onClick={() => setShowUnsendModal(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#242526] border border-zinc-700 p-5 rounded-3xl shadow-2xl max-w-sm w-full space-y-4"
          >
            <h4 className="font-bold text-sm text-slate-100">Unsend Message</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Who would you like to unsend this message for?
            </p>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleUnsend(showUnsendModal, 'everyone')}
                className="w-full text-left p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>Unsend for Everyone</span>
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleUnsend(showUnsendModal, 'me')}
                className="w-full text-left p-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-slate-300 text-xs font-semibold flex items-center justify-between cursor-pointer"
              >
                <span>Unsend for Me</span>
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Dark Overlay when Long Press Menu is Active */}
      <AnimatePresence>
        {activeMenuMsgId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveMenuMsgId(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30"
          />
        )}
      </AnimatePresence>

      {visibleMessages.length === 0 ? (
        <div className="text-center py-20 text-slate-500 text-xs">
          No messages yet. Send a wave to start chatting!
        </div>
      ) : (
        visibleMessages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const isMenuActive = activeMenuMsgId === msg.id;

          const isNicknameSystemMsg = typeof msg.content === 'string' && (
            (msg.content.startsWith('code') && (msg.content.includes('change') || msg.content.includes('reset') || msg.content.includes('set')))
          );

          if (isNicknameSystemMsg) {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center my-2"
              >
                <div className="bg-[#242526] border border-[#3A3B3C] text-[#B0B3B8] text-xs px-3.5 py-1.5 rounded-full shadow-sm flex items-center space-x-1.5 select-none">
                  <Tag className="w-3.5 h-3.5 text-[#B0B3B8] shrink-0" />
                  <span className="font-medium">{msg.content}</span>
                </div>
              </motion.div>
            );
          }

          // Compute reactions summary
          const reactionEntries = msg.reactions
            ? Object.entries(msg.reactions).filter(([_, ids]) => Array.isArray(ids) && (ids as string[]).length > 0)
            : [];
          const totalReactionsCount = reactionEntries.reduce((sum, [_, ids]) => sum + (ids as string[]).length, 0);

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex items-end space-x-2 group relative ${isMe ? 'justify-end' : 'justify-start'} ${
                isMenuActive ? 'z-40' : 'z-10'
              }`}
            >
              {/* Partner Avatar if not me */}
              {!isMe && (
                <div className="shrink-0 mb-1">
                  <UserAvatar
                    userId={msg.senderId}
                    borderId={msg.senderBorderId}
                    src={msg.senderAvatarUrl}
                    username={msg.senderUsername}
                    nickname={msg.senderNickname}
                    size="sm"
                  />
                </div>
              )}

              {/* Message Content Bubble Container */}
              {(() => {
                const mediaUrl = msg.mediaUrl || '';
                const isImageMedia = !msg.isUnsent && ((msg.mediaType === 'image') || (mediaUrl.startsWith('data:image/') || /\.(jpg|jpeg|png|gif|webp|heic|bmp)(\?.*)?$/i.test(mediaUrl)));

                return (
                  <div className={`relative max-w-[85%] sm:max-w-[70%] ${reactionEntries.length > 0 ? 'mb-2.5' : ''}`}>
                    {/* Pinned Tag */}
                    {msg.isPinned && !msg.isUnsent && (
                      <div className={`text-[10px] font-semibold text-white mb-1 flex items-center space-x-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <Pin className="w-3 h-3 fill-white" />
                        <span>Pinned Message</span>
                      </div>
                    )}

                    {/* Quoted Reply Box */}
                    {msg.replyToMessage && !msg.isUnsent && (
                      <div className="text-xs p-2 rounded-xl mb-1 border-l-2 border-white bg-[#18191a] text-[#B0B3B8]">
                        <span className="font-bold text-[10px] text-white block">{msg.replyToMessage.senderNickname}</span>
                        <span className="truncate block opacity-80">{msg.replyToMessage.content || 'Media message'}</span>
                      </div>
                    )}

                    {/* Main Message Bubble */}
                    <div
                      data-message-bubble="true"
                      onTouchStart={(e) => handlePointerStart(e, msg.id)}
                      onTouchMove={handlePointerMove}
                      onTouchEnd={handlePointerEnd}
                      onMouseDown={(e) => handlePointerStart(e, msg.id)}
                      onMouseMove={handlePointerMove}
                      onMouseUp={handlePointerEnd}
                      onMouseLeave={handlePointerEnd}
                      onContextMenu={(e) => handleContextMenu(e, msg.id)}
                      onClick={(e) => handleBubbleClick(e, msg.id, msg.isUnsent)}
                      className={`relative shadow-md transition-all select-none cursor-pointer rounded-2xl ${
                        isImageMedia ? 'p-1' : 'p-3.5'
                      } ${
                        msg.isUnsent
                          ? 'bg-[#18191a] border border-[#3A3B3C] text-[#8A8D91] rounded-br-none'
                          : isImageMedia
                          ? isMe
                            ? 'bg-[#3A3B3C] text-white rounded-br-none'
                            : 'bg-[#242526] border border-[#3A3B3C] text-white rounded-bl-none'
                          : isMe
                          ? 'bg-[#3A3B3C] text-white rounded-br-none'
                          : 'bg-[#242526] border border-[#3A3B3C] text-[#E4E6EB] rounded-bl-none'
                      } ${isMenuActive ? 'ring-2 ring-[#4E4F50] shadow-xl' : ''}`}
                    >
                      {/* Sender Name if not me */}
                      {!isMe && !msg.isUnsent && (
                        <div className={`text-[10px] font-bold text-[#B0B3B8] uppercase tracking-wider ${isImageMedia ? 'px-2 pt-1 pb-1' : 'mb-1'}`}>
                          {msg.senderNickname || msg.senderUsername}
                        </div>
                      )}

                      {/* UNSENT MESSAGE STATE */}
                      {msg.isUnsent ? (
                        <div className="flex items-center space-x-2 text-xs italic text-slate-400 py-0.5">
                          <Ban className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>This message was unsent.</span>
                        </div>
                      ) : (
                        <>
                          {/* MEDIA ATTACHMENTS */}
                          {(() => {
                            const isVideoMedia = !isImageMedia && ((msg.mediaType === 'video') || (mediaUrl.startsWith('data:video/') || /\.(mp4|webm|mov|mkv|avi)(\?.*)?$/i.test(mediaUrl)));
                            const isAudioMedia = !isImageMedia && !isVideoMedia && ((msg.mediaType === 'audio') || (mediaUrl.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a|webm)(\?.*)?$/i.test(mediaUrl)));
                            const isGenericFileMedia = !isImageMedia && !isVideoMedia && !isAudioMedia && (msg.mediaType === 'file' || Boolean(mediaUrl));

                            if (isImageMedia && mediaUrl) {
                              return (
                                <div className="overflow-hidden rounded-xl cursor-pointer bg-slate-950">
                                  <img
                                    src={mediaUrl}
                                    alt="Shared Photo"
                                    loading="lazy"
                                    decoding="async"
                                    draggable={false}
                                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (longPressFiredRef.current) {
                                        longPressFiredRef.current = false;
                                        return;
                                      }
                                      if (onImageClick) {
                                        onImageClick(mediaUrl);
                                      } else {
                                        setSelectedLightboxMedia({ url: mediaUrl, type: 'image' });
                                      }
                                    }}
                                    className="w-full max-h-80 object-cover hover:scale-102 transition duration-300 pointer-events-auto select-none rounded-xl"
                                  />
                                </div>
                              );
                            }

                            if (isVideoMedia && mediaUrl) {
                              return (
                                <div className="mb-2 rounded-2xl overflow-hidden cursor-pointer bg-slate-950 shadow-md">
                                  <video
                                    src={mediaUrl}
                                    controls
                                    draggable={false}
                                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (longPressFiredRef.current) {
                                        longPressFiredRef.current = false;
                                        return;
                                      }
                                      setSelectedLightboxMedia({ url: mediaUrl, type: 'video' });
                                    }}
                                    className="w-full max-h-80 object-cover pointer-events-auto select-none"
                                  />
                                </div>
                              );
                            }

                            if (isAudioMedia && mediaUrl) {
                              return (
                                <div className="mb-2 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                                  <audio
                                    ref={(el) => (audioRefs.current[msg.id] = el)}
                                    src={mediaUrl}
                                    onEnded={() => setPlayingAudioId(null)}
                                  />
                                  <button
                                    onClick={() => toggleAudio(msg.id, mediaUrl)}
                                    className="p-2.5 rounded-full bg-pink-500 text-white hover:bg-pink-600 transition shadow shrink-0"
                                  >
                                    {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                  </button>

                                  <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center space-x-1 mb-1">
                                      <Volume2 className="w-3.5 h-3.5 text-pink-400" />
                                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-300">
                                        Voice Note ({msg.audioDuration || 0}s)
                                      </span>
                                    </div>
                                    {/* Audio Waveform Effect */}
                                    <div className="flex items-center space-x-0.5 h-3">
                                      {[40, 70, 30, 90, 60, 100, 50, 80, 40, 70, 30, 80].map((h, idx) => (
                                        <div
                                          key={idx}
                                          style={{ height: `${h}%` }}
                                          className={`w-1 rounded-full ${playingAudioId === msg.id ? 'bg-pink-400 animate-pulse' : 'bg-slate-700'}`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            if (isGenericFileMedia && mediaUrl) {
                              return (
                                <a
                                  href={mediaUrl}
                                  download={msg.mediaName || 'file'}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="mb-2 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs hover:border-pink-500/50 transition"
                                >
                                  <div className="flex items-center space-x-2 truncate">
                                    <FileText className="w-4 h-4 text-pink-400 shrink-0" />
                                    <span className="truncate font-medium">{msg.mediaName || 'Attachment File'}</span>
                                  </div>
                                  <Download className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                                </a>
                              );
                            }

                            return null;
                          })()}

                          {/* Text Content */}
                          {msg.content && (
                            <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${isImageMedia ? 'px-2 pt-2 pb-1' : ''}`}>
                              {msg.content}
                            </p>
                          )}

                          {/* Footer Info: Time, Edited status, Seen status */}
                          <div className={`flex items-center space-x-1 text-[10px] ${
                            isImageMedia ? 'px-2 pt-1 pb-1 text-slate-400 justify-end' : isMe ? 'mt-1.5 text-pink-200/80 justify-end' : 'mt-1.5 text-slate-400 justify-end'
                          }`}>
                            {msg.isEdited && <span className="italic mr-1">(edited)</span>}
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              msg.seenBy.length > 1 ? (
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                              ) : (
                                <Check className={`w-3.5 h-3.5 ${isImageMedia ? 'text-pink-400' : 'text-pink-200/80'}`} />
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* MESSENGER ATTACHED REACTION BADGE (Attached at corner of Chat Bubble - Matches Screenshot 2) */}
                    {!msg.isUnsent && reactionEntries.length > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          playTouchSound();
                          setActiveMenuMsgId(isMenuActive ? null : msg.id);
                        }}
                        className={`absolute -bottom-3 ${
                          isMe ? 'right-2' : 'right-2'
                        } bg-[#242526] border border-zinc-700/90 rounded-full px-2 py-0.5 text-xs shadow-lg flex items-center space-x-1 cursor-pointer hover:scale-115 active:scale-90 transition-all z-20`}
                        title="View / Change Reactions"
                      >
                        <div className="flex items-center space-x-0.5">
                          {reactionEntries.slice(0, 3).map(([emoji]) => (
                            <span key={emoji} className="text-xs leading-none">
                              <LiveEmoji emoji={emoji} />
                            </span>
                          ))}
                        </div>
                        {totalReactionsCount > 1 && (
                          <span className="text-[10px] font-bold text-zinc-300 leading-none">
                            {totalReactionsCount}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Desktop Hover Quick Trigger Button */}
                    {!msg.isUnsent && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 ${
                          isMe ? '-left-14' : '-right-14'
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            playTouchSound();
                            setActiveMenuMsgId(isMenuActive ? null : msg.id);
                          }}
                          className="p-1.5 rounded-full bg-[#242526] border border-zinc-700 text-zinc-400 hover:text-pink-400 hover:border-pink-500/50 transition shadow cursor-pointer"
                          title="React / Options"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          );
        })
      )}

      {/* MESSENGER FULL-SCREEN LONG-PRESS OVERLAY */}
      <AnimatePresence>
        {activeMsg && !activeMsg.isUnsent && (
          <div className="fixed inset-0 z-50 pointer-events-auto select-none">
            {/* Dark Blur Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setActiveMenuMsgId(null);
                setActiveMsgRect(null);
              }}
              className="absolute inset-0 bg-black/75 backdrop-blur-md z-10 cursor-pointer"
            />

            {/* Highlighted Focused Message Copy */}
            {activeMsgRect && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed',
                  top: `${Math.max(65, Math.min((window.innerHeight || 700) - 180, activeMsgRect.top))}px`,
                  left: `${activeMsgRect.left}px`,
                  width: `${activeMsgRect.width}px`,
                  zIndex: 20
                }}
                className="pointer-events-none select-none"
              >
                <div
                  className={`p-3.5 rounded-2xl shadow-2xl ${
                    activeMsg.senderId === currentUser.id
                      ? 'bg-[#3A3B3C] text-white rounded-br-none'
                      : 'bg-[#242526] border border-[#3A3B3C] text-slate-100 rounded-bl-none'
                  } ring-2 ring-[#4E4F50] shadow-xl`}
                >
                  {activeMsg.senderId !== currentUser.id && (
                    <div className="text-[10px] font-bold text-pink-400 mb-1 uppercase tracking-wider">
                      {activeMsg.senderNickname || activeMsg.senderUsername}
                    </div>
                  )}
                  {activeMsg.mediaType === 'image' && activeMsg.mediaUrl && (
                    <img src={activeMsg.mediaUrl} alt="Preview" className="mb-2 max-h-40 rounded-xl object-cover w-full" />
                  )}
                  {activeMsg.content && (
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {activeMsg.content}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Floating Reaction Bar (Guaranteed 100% visible inside viewport) */}
            <motion.div
              initial={{ scale: 0.6, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.6, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              style={{
                position: 'fixed',
                top: `${getCalculatedEmojiPosition().top}px`,
                left: getCalculatedEmojiPosition().left !== undefined ? `${getCalculatedEmojiPosition().left}px` : 'auto',
                right: getCalculatedEmojiPosition().right !== undefined ? `${getCalculatedEmojiPosition().right}px` : 'auto',
                zIndex: 30
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#242526] border border-zinc-700/90 rounded-full px-3.5 py-2 shadow-2xl flex items-center space-x-3 backdrop-blur-2xl">
                {MESSENGER_PRIMARY_EMOJIS.map((emoji) => {
                  const reactionList = activeMsg?.reactions?.[emoji];
                  const userReacted = Array.isArray(reactionList) && currentUser?.id ? reactionList.includes(currentUser.id) : false;
                  return (
                    <button
                      key={emoji}
                      onClick={() => {
                        handleReact(activeMsg.id, emoji);
                        setActiveMenuMsgId(null);
                        setActiveMsgRect(null);
                      }}
                      className={`text-2xl hover:scale-135 active:scale-95 transition-transform duration-150 cursor-pointer p-0.5 relative ${
                        userReacted ? 'scale-110' : ''
                      }`}
                      title={`React ${emoji}`}
                    >
                      <span><LiveEmoji emoji={emoji} /></span>
                      {userReacted && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-pink-500 rounded-full" />
                      )}
                    </button>
                  );
                })}

                {/* Plus (+) Button for Custom Emoji Picker */}
                <button
                  onClick={() => {
                    const msgId = activeMsg.id;
                    setActiveMenuMsgId(null);
                    setActiveMsgRect(null);
                    setShowMoreEmojiPicker(msgId);
                  }}
                  className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-600/80 text-zinc-300 flex items-center justify-center text-xs transition hover:scale-110 active:scale-95 cursor-pointer ml-1"
                  title="More Emojis"
                >
                  <Plus className="w-4 h-4 text-zinc-300" />
                </button>
              </div>
            </motion.div>

            {/* Messenger Bottom Action Bar */}
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 inset-x-0 bg-[#1c1d1f]/95 backdrop-blur-2xl border-t border-zinc-800/90 py-3.5 px-4 sm:px-10 z-30 shadow-2xl flex items-center justify-around text-slate-200"
            >
              {/* Reply */}
              <button
                onClick={() => {
                  setActiveMenuMsgId(null);
                  setActiveMsgRect(null);
                  onReplyMessage(activeMsg);
                }}
                className="flex flex-col items-center space-y-1 group hover:text-pink-400 active:scale-95 transition cursor-pointer"
              >
                <div className="p-2.5 rounded-full bg-zinc-800/80 group-hover:bg-pink-500/20 text-pink-400 transition">
                  <Reply className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-medium text-slate-300">Reply</span>
              </button>

              {/* Copy */}
              {activeMsg.content && (
                <button
                  onClick={() => {
                    handleCopyText(activeMsg.content);
                    setActiveMsgRect(null);
                  }}
                  className="flex flex-col items-center space-y-1 group hover:text-indigo-400 active:scale-95 transition cursor-pointer"
                >
                  <div className="p-2.5 rounded-full bg-zinc-800/80 group-hover:bg-indigo-500/20 text-indigo-400 transition">
                    <Copy className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300">Copy</span>
                </button>
              )}

              {/* Pin / Unpin */}
              <button
                onClick={() => {
                  handlePin(activeMsg.id);
                  setActiveMsgRect(null);
                }}
                className="flex flex-col items-center space-y-1 group hover:text-amber-400 active:scale-95 transition cursor-pointer"
              >
                <div className="p-2.5 rounded-full bg-zinc-800/80 group-hover:bg-amber-500/20 text-amber-400 transition">
                  <Pin className="w-5 h-5 fill-amber-400" />
                </div>
                <span className="text-[11px] font-medium text-slate-300">
                  {activeMsg.isPinned ? 'Unpin' : 'Pin'}
                </span>
              </button>

              {/* Edit (if sender) */}
              {activeMsg.senderId === currentUser.id && activeMsg.content && (
                <button
                  onClick={() => {
                    setActiveMenuMsgId(null);
                    setActiveMsgRect(null);
                    onEditMessage(activeMsg);
                  }}
                  className="flex flex-col items-center space-y-1 group hover:text-emerald-400 active:scale-95 transition cursor-pointer"
                >
                  <div className="p-2.5 rounded-full bg-zinc-800/80 group-hover:bg-emerald-500/20 text-emerald-400 transition">
                    <Edit2 className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300">Edit</span>
                </button>
              )}

              {/* Unsend Options */}
              {activeMsg.senderId === currentUser.id ? (
                <button
                  onClick={() => {
                    const msgId = activeMsg.id;
                    setActiveMenuMsgId(null);
                    setActiveMsgRect(null);
                    setShowUnsendModal(msgId);
                  }}
                  className="flex flex-col items-center space-y-1 group hover:text-rose-400 active:scale-95 transition cursor-pointer"
                >
                  <div className="p-2.5 rounded-full bg-zinc-800/80 group-hover:bg-rose-500/20 text-rose-400 transition">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300">Unsend</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleUnsend(activeMsg.id, 'me');
                    setActiveMsgRect(null);
                  }}
                  className="flex flex-col items-center space-y-1 group hover:text-slate-400 active:scale-95 transition cursor-pointer"
                >
                  <div className="p-2.5 rounded-full bg-zinc-800/80 group-hover:bg-slate-700 text-slate-400 transition">
                    <EyeOff className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-300">Hide</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef} />
    </div>
  );
});

MessageList.displayName = 'MessageList';

