import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageCircle,
  Share2,
  Trash2,
  Send,
  MoreHorizontal,
  Clock,
  Heart,
  Smile,
  ThumbsUp,
  Flame,
  Eye
} from 'lucide-react';
import { Post, PostReactionType, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { LiveEmoji } from './LiveEmoji';
import { reactToPost, commentPost, deleteComment, sharePost, deletePost, incrementPostView } from '../services/api';
import { playTouchSound, playLongPressSound, playReactionPopSound } from '../utils/audioSound';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';

interface PostCardProps {
  post: Post;
  currentUser: User;
  onPostUpdated: (deletedPostId?: string) => void;
  onUserClick?: (userId: string) => void;
  onImageClick?: (imageUrl: string) => void;
}

const REACTION_CONFIG: Record<PostReactionType, { emoji: string; label: string; color: string }> = {
  like: { emoji: '👍', label: 'Like', color: 'text-blue-400' },
  heart: { emoji: '❤️', label: 'Heart', color: 'text-rose-500' },
  care: { emoji: '🥰', label: 'Care', color: 'text-amber-400' },
  haha: { emoji: '😂', label: 'Haha', color: 'text-amber-400' },
  wow: { emoji: '😮', label: 'Wow', color: 'text-amber-400' },
  sad: { emoji: '😢', label: 'Sad', color: 'text-amber-400' },
  angry: { emoji: '😡', label: 'Angry', color: 'text-rose-600' }
};

export const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onPostUpdated, onUserClick, onImageClick }) => {
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<PostReactionType | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Optimistic local state for instant 0-delay reactions & comments
  const [localReactions, setLocalReactions] = useState<Record<string, PostReactionType>>(post.reactions || {});
  const [localComments, setLocalComments] = useState(post.comments || []);
  const [viewsCount, setViewsCount] = useState<number>(post.viewsCount || 0);
  const hasViewedRef = useRef(false);

  useEffect(() => {
    setLocalReactions(post.reactions || {});
    setLocalComments(post.comments || []);
    setViewsCount(post.viewsCount || 0);
  }, [post.reactions, post.comments, post.viewsCount]);

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video && video.currentTime >= 1.0 && !hasViewedRef.current) {
      const storageKey = `watched_video_${post.id}`;
      if (!localStorage.getItem(storageKey)) {
        hasViewedRef.current = true;
        localStorage.setItem(storageKey, 'true');
        setViewsCount((prev) => prev + 1);
        incrementPostView(post.id).then((res) => {
          if (res && res.viewsCount) setViewsCount(res.viewsCount);
        }).catch(() => {});
      } else {
        hasViewedRef.current = true;
      }
    }
  };

  const myReaction = localReactions[currentUser.id] as PostReactionType | undefined;
  const reactionsList = Object.entries(localReactions);
  const totalReactions = reactionsList.length;

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);

  const handlePressStart = () => {
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setShowReactionsMenu(true);
      playLongPressSound();
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!showReactionsMenu) return;
    const touch = e.touches[0];
    if (touch) {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const reactBtn = el?.closest('[data-reaction-type]') as HTMLElement | null;
      const rType = reactBtn?.dataset.reactionType as PostReactionType | undefined;
      setHoveredReaction(rType || null);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (showReactionsMenu) {
      if (hoveredReaction) {
        handleReact(hoveredReaction);
      } else {
        setShowReactionsMenu(false);
      }
      setHoveredReaction(null);
    }
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    // Single tap click: toggle like
    if (myReaction) {
      handleReact(myReaction);
    } else {
      handleReact('like');
    }
  };

  const handleReact = async (type: PostReactionType) => {
    playReactionPopSound();
    setShowReactionsMenu(false);

    // Optimistic instant reaction update
    setLocalReactions((prev) => {
      const next = { ...prev };
      if (next[currentUser.id] === type) {
        delete next[currentUser.id];
      } else {
        next[currentUser.id] = type;
      }
      return next;
    });

    try {
      await reactToPost(post.id, type);
    } catch (err) {
      console.error('React error:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    playTouchSound();
    setCommentText('');

    // Optimistic instant comment addition
    const tempComment = {
      id: 'temp_' + Date.now(),
      authorId: currentUser.id,
      authorUsername: currentUser.username,
      authorName: currentUser.nickname,
      authorAvatarUrl: currentUser.avatarUrl,
      content: text,
      createdAt: new Date().toISOString()
    };
    setLocalComments((prev) => [...prev, tempComment]);

    try {
      setSubmittingComment(true);
      await commentPost(post.id, text);
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    playTouchSound();
    setLocalComments((prev) => prev.filter(c => c.id !== commentId));
    try {
      await deleteComment(post.id, commentId);
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      await sharePost(post.id);
      alert('Post shared successfully to your feed!');
    } catch (err: any) {
      alert(err.message || 'Failed to share post');
    } finally {
      setSharing(false);
    }
  };

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      setDeleting(true);
      await deletePost(post.id);
      onPostUpdated(post.id);
    } catch (err) {
      console.error('Delete post error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const dateObj = new Date(post.createdAt);
  const formattedDate = dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTimeStr = dateObj.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  const fullDateTime = `${formattedDate} • ${formattedTimeStr}`;

  const isProfileUpdate = Boolean(post.content) && /\bupdated\b.*\bprofile picture\b/i.test(post.content || '');
  const isHer = post.content?.toLowerCase().includes('her profile picture') || post.authorUsername?.includes('547257');
  const actionPhrase = isHer ? 'updated her profile picture.' : 'updated his profile picture.';
  const hideHandle = shouldHideHandle({ username: post.authorUsername, id: post.userId });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4 border-b border-[#3A3B3C]/40 text-[#E4E6EB] transition"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          {/* Author Avatar with Dynamic Border */}
          <UserAvatar
            userId={post.userId}
            borderId={post.authorBorderId}
            src={post.authorAvatarUrl}
            username={post.authorUsername}
            nickname={post.authorName}
            size="md"
            onClick={() => onUserClick?.(post.userId)}
          />

          <div>
            <div
              onClick={() => onUserClick?.(post.userId)}
              className="flex items-center flex-wrap gap-x-1 cursor-pointer hover:underline decoration-white"
            >
              <h4 className="font-bold text-sm text-white flex items-center">
                <span>{post.authorName}</span>
                {isDeveloperUser({ username: post.authorUsername, id: post.userId }) && (
                  <VerifiedBadge className="w-4 h-4 ml-1 shrink-0" />
                )}
              </h4>
              {isProfileUpdate ? (
                <span className="text-xs text-[#B0B3B8] font-normal ml-0.5">
                  {actionPhrase}
                </span>
              ) : (
                !hideHandle && (
                  <span className="text-[11px] text-[#B0B3B8] font-mono ml-1">@{post.authorUsername}</span>
                )
              )}
            </div>
            <p className="text-[10px] text-[#B0B3B8] flex items-center space-x-1 mt-0.5">
              <Clock className="w-3 h-3 text-[#B0B3B8]" />
              <span>{fullDateTime}</span>
              {post.originalAuthorName && (
                <span className="text-white font-semibold pl-1">
                  &bull; Shared from {post.originalAuthorName}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Header Badges (Viral Badge & Delete button) */}
        <div className="flex items-center space-x-2">
          {post.isViral && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black tracking-wider uppercase flex items-center space-x-1 shadow-sm">
              <Flame className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />
              <span>Viral</span>
            </span>
          )}

          {viewsCount > 0 && (
            <span className="text-[10px] text-[#B0B3B8] flex items-center space-x-1 bg-[#18191A] px-2 py-0.5 rounded-md border border-[#3A3B3C]">
              <Eye className="w-3 h-3 text-[#B0B3B8]" />
              <span>{viewsCount} {viewsCount === 1 ? 'view' : 'views'}</span>
            </span>
          )}

          {post.userId === currentUser.id && (
            <button
              onClick={handleDeletePost}
              disabled={deleting}
              className="p-1.5 text-[#B0B3B8] hover:text-rose-400 rounded-lg hover:bg-[#3A3B3C] transition"
              title="Delete Post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Post Content Text */}
      {post.content && !isProfileUpdate && (
        <p className="text-sm text-[#E4E6EB] leading-relaxed mb-3 whitespace-pre-line font-normal">
          {post.content}
        </p>
      )}

      {/* Post Media (Image or Video) - Clean without borders */}
      {post.mediaType === 'image' && post.mediaUrl && (
        <div
          onClick={() => {
            playTouchSound();
            onImageClick?.(post.mediaUrl!);
          }}
          className="mb-3 rounded-xl overflow-hidden bg-black/40 max-h-[520px] cursor-pointer group relative"
          title="Click to view full screen"
        >
          <img
            src={post.mediaUrl}
            alt=""
            className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            <span className="text-xs font-bold text-white bg-[#242526]/90 border border-[#3A3B3C] px-3 py-1.5 rounded-full shadow-lg">
              Click to view full photo
            </span>
          </div>
        </div>
      )}

      {post.mediaType === 'video' && post.mediaUrl && (
        <div className="mb-3 rounded-xl overflow-hidden bg-black/40 max-h-[520px]">
          <video
            src={post.mediaUrl}
            controls
            preload="auto"
            playsInline
            onTimeUpdate={handleVideoTimeUpdate}
            className="w-full max-h-[520px] bg-black"
          />
        </div>
      )}

      {/* Stats Summary Bar */}
      <div className="flex items-center justify-between text-xs text-[#B0B3B8] border-b border-[#3E4042] pb-2 mb-1">
        <div className="flex items-center space-x-1.5">
          {totalReactions > 0 ? (
            <div className="flex items-center space-x-1">
              <span className="flex -space-x-1">
                {(Array.from(new Set(Object.values(localReactions))) as PostReactionType[]).slice(0, 3).map((r, idx) => (
                  <span key={idx} className="text-xs">
                    {r === 'like' ? (
                      <span className="w-4 h-4 rounded-full bg-[#0866FF] inline-flex items-center justify-center p-0.5 shadow">
                        <ThumbsUp className="w-2.5 h-2.5 fill-white text-white" />
                      </span>
                    ) : (
                      <LiveEmoji emoji={REACTION_CONFIG[r]?.emoji || '👍'} />
                    )}
                  </span>
                ))}
              </span>
              <span className="font-semibold text-[#E4E6EB]">{totalReactions}</span>
            </div>
          ) : (
            <span className="text-[11px] text-[#B0B3B8]">Be the first to react</span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <button
            onClick={() => {
              playTouchSound();
              setShowComments(!showComments);
            }}
            className="hover:text-white transition"
          >
            {localComments.length} Comments
          </button>
          <span>&bull;</span>
          <span>{post.shareCount || 0} Shares</span>
        </div>
      </div>

      {/* Facebook Action Buttons Bar (Like, Comment, Share) */}
      <div className="relative flex items-center justify-between pt-1 gap-1">
        {/* Reaction Popover Menu */}
        <AnimatePresence>
          {showReactionsMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onMouseLeave={() => {
                setShowReactionsMenu(false);
                setHoveredReaction(null);
              }}
              className="absolute -top-14 left-0 z-30 bg-[#242526] border border-[#3E4042] rounded-full px-3 py-1.5 shadow-2xl flex items-center space-x-2"
            >
              {(Object.keys(REACTION_CONFIG) as PostReactionType[]).map((type) => {
                const isHovered = hoveredReaction === type;
                return (
                  <button
                    key={type}
                    data-reaction-type={type}
                    onClick={() => handleReact(type)}
                    onMouseEnter={() => setHoveredReaction(type)}
                    className={`transition-all duration-150 p-1 rounded-full cursor-pointer ${
                      isHovered ? 'scale-150 -translate-y-2' : 'hover:scale-135 active:scale-125'
                    }`}
                    title={REACTION_CONFIG[type].label}
                  >
                    {type === 'like' ? (
                      <span className="w-7 h-7 rounded-full bg-[#0866FF] flex items-center justify-center p-1 shadow-md">
                        <ThumbsUp className="w-4 h-4 fill-white text-white" />
                      </span>
                    ) : (
                      <span className="text-2xl block">
                        <LiveEmoji emoji={REACTION_CONFIG[type].emoji} />
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Like / React Trigger Button - Facebook Style */}
        <div className="relative flex-1">
          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onClick={handleLikeClick}
            className="w-full flex items-center justify-center space-x-2 px-2 py-2 rounded-lg text-xs font-bold bg-transparent hover:bg-[#3A3B3C]/60 transition-colors duration-150 cursor-pointer active:scale-95"
          >
            {!myReaction ? (
              <>
                <ThumbsUp className="w-5 h-5 text-[#B0B3B8]" />
                <span className="text-[#B0B3B8] font-bold text-xs">Like</span>
              </>
            ) : myReaction === 'like' ? (
              <>
                <ThumbsUp className="w-5 h-5 fill-[#2E89FF] text-[#2E89FF]" />
                <span className="text-[#2E89FF] font-bold text-xs">Like</span>
              </>
            ) : (
              <>
                <span className="text-base">
                  <LiveEmoji emoji={REACTION_CONFIG[myReaction].emoji} />
                </span>
                <span className={`text-xs font-bold ${REACTION_CONFIG[myReaction].color}`}>
                  {REACTION_CONFIG[myReaction].label}
                </span>
              </>
            )}
          </button>
        </div>

        {/* Comment Trigger Button - Facebook Style */}
        <button
          onClick={() => {
            playTouchSound();
            setShowComments(!showComments);
          }}
          className="flex-1 flex items-center justify-center space-x-2 px-2 py-2 rounded-lg text-xs font-bold bg-transparent hover:bg-[#3A3B3C]/60 text-[#B0B3B8] hover:text-white transition-colors duration-150 cursor-pointer active:scale-95"
        >
          <MessageCircle className="w-5 h-5 text-[#B0B3B8]" />
          <span className="text-[#B0B3B8] font-bold text-xs">Comment</span>
        </button>

        {/* Share Button - Facebook Style */}
        <button
          onClick={() => {
            playTouchSound();
            handleShare();
          }}
          disabled={sharing}
          className="flex-1 flex items-center justify-center space-x-2 px-2 py-2 rounded-lg text-xs font-bold bg-transparent hover:bg-[#3A3B3C]/60 text-[#B0B3B8] hover:text-white transition-colors duration-150 cursor-pointer disabled:opacity-50 active:scale-95"
        >
          <Share2 className="w-5 h-5 text-[#B0B3B8]" />
          <span className="text-[#B0B3B8] font-bold text-xs">{sharing ? 'Sharing...' : 'Share'}</span>
        </button>
      </div>

      {/* Comments Section Drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-slate-900/80 space-y-3 overflow-hidden"
          >
            {/* New Comment Input */}
            <form onSubmit={handleAddComment} className="flex items-center space-x-2">
              <UserAvatar
                userId={currentUser.id}
                borderId={currentUser.borderId}
                src={currentUser.avatarUrl}
                username={currentUser.username}
                nickname={currentUser.nickname}
                size="sm"
              />
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-slate-900 hover:bg-slate-800/80 focus:bg-slate-800/90 rounded-full px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="p-2 bg-pink-500 hover:bg-pink-600 text-white rounded-full transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Comments List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {localComments.length === 0 ? (
                <p className="text-[11px] text-slate-500 text-center py-2">No comments yet.</p>
              ) : (
                localComments.map((comment) => (
                  <div key={comment.id} className="flex items-start space-x-2.5">
                    <UserAvatar
                      userId={comment.authorId || (comment as any).userId}
                      borderId={comment.authorBorderId}
                      src={comment.authorAvatarUrl}
                      username={comment.authorUsername}
                      nickname={comment.authorName}
                      size="xs"
                      onClick={() => onUserClick?.(comment.authorId || (comment as any).userId)}
                    />
                    <div className="flex-1 bg-slate-900/80 rounded-2xl px-3.5 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-200 flex items-center">
                          <span>{comment.authorName}</span>
                          {isDeveloperUser({ username: comment.authorUsername, id: comment.authorId || (comment as any).userId }) && (
                            <VerifiedBadge className="w-3.5 h-3.5 ml-1 shrink-0" />
                          )}
                        </span>
                        {(comment.authorId === currentUser.id || post.userId === currentUser.id) && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-slate-500 hover:text-rose-400 p-0.5"
                            title="Delete Comment"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-line">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
