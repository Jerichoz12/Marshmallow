import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Film,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Plus,
  RefreshCw,
  X,
  Send,
  Eye,
  Trash2,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { User, Post, PostReactionType } from '../types';
import { fetchVideoPosts, createPost, uploadMediaFile, reactToPost, commentPost, deleteComment, sharePost, deletePost, incrementPostView } from '../services/api';
import { UserAvatar } from './UserAvatar';
import { LiveEmoji } from './LiveEmoji';
import { PullToRefresh } from './PullToRefresh';
import { playTouchSound, playLongPressSound, playReactionPopSound } from '../utils/audioSound';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';

interface VideoFeedViewProps {
  currentUser: User;
  initialTab?: 'all' | 'saved';
  onOpenUserProfile?: (userId: string) => void;
  onOpenLightbox?: (mediaUrl: string, type: 'video') => void;
  isActive?: boolean;
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

const BLOCKED_ACCOUNT_CODES = ['536811'];
function isCleanPost(p: Post): boolean {
  if (!p) return false;
  const uId = (p.userId || '').toLowerCase();
  const uName = (p.authorUsername || '').toLowerCase();

  for (const code of BLOCKED_ACCOUNT_CODES) {
    if (uId.includes(code) || uName.includes(code)) {
      return false;
    }
  }
  return true;
}

export const VideoFeedView: React.FC<VideoFeedViewProps> = ({
  currentUser,
  initialTab = 'all',
  onOpenUserProfile,
  onOpenLightbox,
  isActive = true
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'saved'>(initialTab);
  const [videoPosts, setVideoPosts] = useState<Post[]>(() => {
    try {
      localStorage.removeItem('marshmallow_cached_video_posts');
      localStorage.removeItem('marshmallow_cached_video_posts_v2');
      localStorage.removeItem('marshmallow_cached_video_posts_v3');
      const cached = localStorage.getItem('marshmallow_cached_video_posts_v4');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(isCleanPost);
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => videoPosts.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedVideoCacheRef = React.useRef(videoPosts.length > 0);

  // Pause videos when switching away from Video tab
  useEffect(() => {
    if (!isActive) {
      const vids = document.querySelectorAll('video');
      vids.forEach(v => {
        try {
          if (!v.paused) v.pause();
        } catch {}
      });
    }
  }, [isActive]);

  // Sync initialTab when prop changes
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Upload Video Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Saved Videos (LocalStorage)
  const [savedVideoIds, setSavedVideoIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('marshmallow_saved_videos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const loadVideos = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (!hasLoadedVideoCacheRef.current) setLoading(true);
      setError(null);

      const res = await fetchVideoPosts();
      const cleanRes = (res || []).filter(isCleanPost);
      setVideoPosts(cleanRes);
      hasLoadedVideoCacheRef.current = true;
      try {
        localStorage.setItem('marshmallow_cached_video_posts_v4', JSON.stringify(cleanRes));
      } catch (e) {
        console.warn('Failed to cache video posts in localStorage:', e);
      }
    } catch (err: any) {
      console.error('Failed to load video feed:', err);
      if (videoPosts.length === 0) {
        setError('Could not connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [videoPosts.length]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const toggleSaveVideo = (postId: string) => {
    playTouchSound();
    setSavedVideoIds((prev) => {
      const isSaved = prev.includes(postId);
      const updated = isSaved ? prev.filter((id) => id !== postId) : [...prev, postId];
      try {
        localStorage.setItem('marshmallow_saved_videos', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update saved videos:', err);
      }
      return updated;
    });
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file (MP4, WebM, etc.)');
      return;
    }

    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const uploaded = await uploadMediaFile(base64Data, file.name);
          setVideoUrl(uploaded.url);
        } catch (err: any) {
          alert('Upload failed: ' + (err.message || 'Error processing video'));
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploading(false);
    }
  };

  const handleCreateVideoPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;

    playTouchSound();
    try {
      setSubmitting(true);
      await createPost({
        content: captionText.trim(),
        mediaType: 'video',
        mediaUrl: videoUrl.trim()
      });
      setCaptionText('');
      setVideoUrl('');
      setShowUploadModal(false);
      await loadVideos();
    } catch (err: any) {
      alert(err.message || 'Failed to post video');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedVideos = activeTab === 'saved'
    ? videoPosts.filter(p => savedVideoIds.includes(p.id))
    : videoPosts;

  return (
    <PullToRefresh onRefresh={() => loadVideos(true)} isRefreshing={refreshing}>
      <div className="w-full max-w-xl mx-auto select-none pb-24">
        {/* Top Clip Header Bar - Pure Dark & White, no card border, connected directly to dark background */}
        <div className="flex items-center justify-between px-3 py-2 sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md">
          <h2 className="text-base font-extrabold tracking-tight text-white">Clip</h2>
        </div>

        {/* Videos Feed Container */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold tracking-wide text-slate-300">Loading videos...</p>
        </div>
      ) : error ? (
        <div className="p-5 text-center space-y-3">
          <p className="text-xs text-slate-300 font-semibold">{error}</p>
          <button
            onClick={() => loadVideos()}
            className="px-4 py-2 bg-white text-black rounded-xl text-xs font-bold shadow hover:bg-slate-200"
          >
            Try Again
          </button>
        </div>
      ) : displayedVideos.length === 0 ? (
        <div className="py-16 text-center space-y-4 p-6">
          <div className="p-4 rounded-full bg-slate-800 text-white w-16 h-16 mx-auto flex items-center justify-center border border-slate-700">
            {activeTab === 'saved' ? <Bookmark className="w-8 h-8 text-amber-400" /> : <Film className="w-8 h-8 text-white" />}
          </div>
          <h3 className="text-base font-extrabold text-slate-200">
            {activeTab === 'saved' ? 'No saved videos yet.' : 'No video posts found.'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeTab === 'saved'
              ? 'Tap the Save bookmark icon on any video to keep it here for easy viewing!'
              : 'Community video uploads will appear here. Post a video using the button above!'}
          </p>
        </div>
      ) : (
        <div className="w-full space-y-0">
          {displayedVideos.map((post) => (
            <ReelsVideoCardItem
              key={post.id}
              post={post}
              currentUser={currentUser}
              isSaved={savedVideoIds.includes(post.id)}
              onToggleSave={() => toggleSaveVideo(post.id)}
              onOpenUserProfile={onOpenUserProfile}
              onOpenLightbox={onOpenLightbox}
            />
          ))}
        </div>
      )}

      {/* Upload Video Modal Overlay */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Film className="w-5 h-5 text-white" />
                <span>Post a Video</span>
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVideoPost} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                  1. Select Video File
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  disabled={uploading}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-slate-950 hover:file:bg-slate-200 cursor-pointer bg-slate-950 p-2 rounded-2xl border border-slate-800"
                />
                {uploading && (
                  <p className="text-[11px] text-slate-300 font-bold mt-1.5 animate-pulse">
                    Uploading video file...
                  </p>
                )}
              </div>

              <div className="text-center text-[11px] text-slate-500 uppercase font-bold">OR VIA URL</div>

              <div>
                <input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Enter Video URL (e.g. /uploads/... or mp4 link)"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-300 mb-1.5">
                  2. Caption / Description
                </label>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="What's the story behind this video?..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!videoUrl.trim() || submitting || uploading}
                  className="px-5 py-2 bg-white hover:bg-slate-200 text-slate-950 rounded-xl text-xs font-extrabold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Posting...' : 'Post Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PullToRefresh>
  );
};

// Single Reels Video Card Component with Auto-play (Sound ON), Container fitting, and Side controls
interface ReelsVideoCardItemProps {
  post: Post;
  currentUser: User;
  isSaved: boolean;
  onToggleSave: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenLightbox?: (mediaUrl: string, type: 'video') => void;
}

const ReelsVideoCardItem: React.FC<ReelsVideoCardItemProps> = ({
  post,
  currentUser,
  isSaved,
  onToggleSave,
  onOpenUserProfile
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [skipIndicator, setSkipIndicator] = useState<'back' | 'forward' | null>(null);

  const [viewsCount, setViewsCount] = useState<number>(post.viewsCount || 0);
  const hasViewedRef = useRef(false);

  // Local optimistic reaction & comment state (No section refresh needed)
  const [localReactions, setLocalReactions] = useState<Record<string, PostReactionType>>(post.reactions || {});
  const [localComments, setLocalComments] = useState(post.comments || []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      if (videoRef.current.duration) {
        const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
        setProgress(p);
      }
      // Record 1 view if watched >= 1 second and not already recorded on this device
      if (videoRef.current.currentTime >= 1.0 && !hasViewedRef.current) {
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
    }
  };

  const handleSkip = (seconds: number, e: React.MouseEvent) => {
    e.stopPropagation();
    playTouchSound();
    if (videoRef.current) {
      const dur = videoRef.current.duration || 0;
      const nextTime = Math.max(0, Math.min(dur, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = nextTime;
      if (dur > 0) setProgress((nextTime / dur) * 100);
      setHasInteracted(true);
      setSkipIndicator(seconds < 0 ? 'back' : 'forward');
      setTimeout(() => setSkipIndicator(null), 700);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleReact('heart');
    setShowHeartAnim(true);
    setHasInteracted(true);
    setTimeout(() => setShowHeartAnim(false), 900);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current || !videoRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    videoRef.current.currentTime = pct * videoRef.current.duration;
    setProgress(pct * 100);
    setHasInteracted(true);
  };

  useEffect(() => {
    setLocalReactions(post.reactions || {});
    setLocalComments(post.comments || []);
  }, [post.reactions, post.comments]);

  // IntersectionObserver for TikTok/Reels style auto-play with SOUND ON when visible in viewport
  useEffect(() => {
    const videoElem = videoRef.current;
    if (!videoElem) return;

    // Ensure video is NOT muted for full audio playback
    videoElem.muted = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            videoElem
              .play()
              .then(() => setIsPlaying(true))
              .catch(() => {
                // If browser blocks unmuted autoplay, play muted as fallback
                videoElem.muted = true;
                videoElem.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
              });
          } else {
            videoElem.pause();
            setIsPlaying(false);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(videoElem);
    return () => observer.disconnect();
  }, []);

  const togglePlayPause = () => {
    playTouchSound();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.muted = false;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
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
    if (myReaction) {
      handleReact(myReaction);
    } else {
      handleReact('heart');
    }
  };

  // React to post LIVE without section refresh
  const handleReact = async (type: PostReactionType) => {
    playReactionPopSound();
    setShowReactionsMenu(false);

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

  // Add comment LIVE without section refresh
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;

    playTouchSound();
    setCommentText('');

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
    setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await deleteComment(post.id, commentId);
    } catch (err) {
      console.error('Delete comment error:', err);
    }
  };

  const handleShare = async () => {
    playTouchSound();
    try {
      await sharePost(post.id);
      alert('Video post shared successfully to your feed!');
    } catch (err: any) {
      alert(err.message || 'Failed to share post');
    }
  };

  const handleDeletePost = async () => {
    if (!confirm('Are you sure you want to delete this video post?')) return;
    playTouchSound();
    try {
      await deletePost(post.id);
    } catch (err) {
      console.error('Delete post error:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100dvh-130px)] max-h-[720px] min-h-[480px] bg-slate-950 overflow-hidden flex items-center justify-center group"
      onDoubleClick={handleDoubleClick}
    >
      {/* Video Element */}
      {post.mediaUrl ? (
        <video
          ref={videoRef}
          src={post.mediaUrl}
          loop
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onClick={() => {
            setHasInteracted(true);
            togglePlayPause();
          }}
          className="w-full h-full object-cover cursor-pointer"
        />
      ) : (
        <div className="text-slate-500 text-xs p-8 text-center">No video URL available</div>
      )}

      {/* Floating 10s Skip Buttons (Visible ONLY when paused) */}
      {!isPlaying && (
        <>
          <div className="absolute top-1/2 -translate-y-1/2 left-[18%] sm:left-[22%] z-20 flex items-center">
            <button
              onClick={(e) => handleSkip(-10, e)}
              className="p-3 rounded-full bg-slate-950/80 hover:bg-slate-800 backdrop-blur-md text-white border border-slate-700/60 transition active:scale-90 flex flex-col items-center justify-center cursor-pointer shadow-2xl group/btn"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-5 h-5 text-white group-hover/btn:rotate-[-45deg] transition duration-200" />
              <span className="text-[9px] font-black tracking-tighter mt-0.5 text-slate-200">-10s</span>
            </button>
          </div>

          <div className="absolute top-1/2 -translate-y-1/2 right-[18%] sm:right-[22%] z-20 flex items-center">
            <button
              onClick={(e) => handleSkip(10, e)}
              className="p-3 rounded-full bg-slate-950/80 hover:bg-slate-800 backdrop-blur-md text-white border border-slate-700/60 transition active:scale-90 flex flex-col items-center justify-center cursor-pointer shadow-2xl group/btn"
              title="Fast Forward 10 seconds"
            >
              <RotateCw className="w-5 h-5 text-white group-hover/btn:rotate-[45deg] transition duration-200" />
              <span className="text-[9px] font-black tracking-tighter mt-0.5 text-slate-200">+10s</span>
            </button>
          </div>
        </>
      )}

      {/* Skip Feedback Indicator Overlay */}
      <AnimatePresence>
        {skipIndicator && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-slate-900/90 text-white flex flex-col items-center justify-center border border-white/20 shadow-2xl pointer-events-none z-30"
          >
            {skipIndicator === 'back' ? (
              <>
                <RotateCcw className="w-8 h-8 text-white" />
                <span className="text-xs font-black text-slate-200 mt-1">-10 SEC</span>
              </>
            ) : (
              <>
                <RotateCw className="w-8 h-8 text-white" />
                <span className="text-xs font-black text-slate-200 mt-1">+10 SEC</span>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Floating Heart Animation Pop */}
      <AnimatePresence>
        {showHeartAnim && (
          <motion.div
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            className="absolute inset-0 m-auto w-24 h-24 flex items-center justify-center pointer-events-none z-40"
          >
            <Heart className="w-20 h-20 text-white fill-white drop-shadow-[0_0_25px_rgba(255,255,255,0.8)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive, Clickable & Seekable Progress Bar Overlay at Bottom */}
      {hasInteracted && (
        <div
          onClick={handleProgressClick}
          className="absolute bottom-0 left-0 right-0 h-3 hover:h-4 bg-slate-950/80 pointer-events-auto z-30 cursor-pointer group/bar transition-all flex items-end"
          title="Click to Seek Video"
        >
          <div
            className="h-full bg-white transition-all duration-75 ease-linear shadow-md relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover/bar:opacity-100 transition-opacity" />
          </div>
        </div>
      )}

      {/* Play / Pause Toggle Indicator */}
      {!isPlaying && (
        <button
          onClick={() => {
            setHasInteracted(true);
            togglePlayPause();
          }}
          className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-slate-950/80 text-white flex items-center justify-center border border-white/30 shadow-2xl backdrop-blur-md hover:scale-110 transition cursor-pointer z-10"
        >
          <Play className="w-8 h-8 ml-1 fill-white" />
        </button>
      )}

      {/* OVERLAY 1: BOTTOM-LEFT AUTHOR INFO & CAPTION */}
      <div className="absolute bottom-0 left-0 right-16 p-4 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto z-10 space-y-2">
        <div className="flex items-center space-x-2.5">
          <UserAvatar
            userId={post.userId}
            borderId={post.authorBorderId}
            src={post.authorAvatarUrl}
            username={post.authorUsername}
            nickname={post.authorName}
            size="md"
            onClick={() => onOpenUserProfile?.(post.userId)}
          />
          <div>
            <h4
              onClick={() => onOpenUserProfile?.(post.userId)}
              className="text-xs sm:text-sm font-black text-white hover:text-slate-300 cursor-pointer transition leading-tight flex items-center space-x-1 drop-shadow-md"
            >
              <span>{post.authorName || post.authorUsername}</span>
              {isDeveloperUser({ username: post.authorUsername, id: post.userId }) && (
                <VerifiedBadge className="w-4 h-4 text-sky-400 shrink-0" title="Developer Verified" />
              )}
            </h4>
            <div className="flex items-center space-x-1 text-[10px] text-slate-300 font-bold drop-shadow">
              {!shouldHideHandle({ username: post.authorUsername, id: post.userId }) && (
                <>
                  <span>@{post.authorUsername}</span>
                  <span>•</span>
                </>
              )}
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Video Caption Visible over Video */}
        {post.content && (
          <p className="text-xs sm:text-sm font-medium text-white/95 leading-relaxed drop-shadow-md line-clamp-3 pr-2">
            {post.content}
          </p>
        )}

        {/* View Count */}
        <div className="flex items-center space-x-1 text-[10px] text-slate-300 font-bold">
          <Eye className="w-3 h-3 text-slate-400" />
          <span>{viewsCount} {viewsCount === 1 ? 'view' : 'views'}</span>
        </div>
      </div>

      {/* OVERLAY 2: RIGHT-SIDE VERTICAL ACTION BUTTONS COLUMN */}
      <div className="absolute bottom-6 right-3 flex flex-col items-center space-y-4 z-20">
        {/* Floating Reactions Popup */}
        <AnimatePresence>
          {showReactionsMenu && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, x: 10 }}
              animate={{ scale: 1, opacity: 1, x: -60 }}
              exit={{ scale: 0.8, opacity: 0, x: 10 }}
              className="absolute right-0 bottom-36 bg-slate-900/95 border border-slate-700/80 rounded-full px-2 py-1 shadow-2xl flex items-center space-x-1 z-30"
            >
              {(Object.keys(REACTION_CONFIG) as PostReactionType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleReact(type)}
                  className="hover:scale-130 transition duration-150 p-1 text-lg cursor-pointer"
                  title={REACTION_CONFIG[type].label}
                >
                  <LiveEmoji emoji={REACTION_CONFIG[type].emoji} />
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. LIKE / REACT BUTTON */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onMouseDown={handlePressStart}
            onMouseUp={handlePressEnd}
            onMouseLeave={handlePressEnd}
            onTouchStart={handlePressStart}
            onTouchEnd={handlePressEnd}
            onTouchCancel={handlePressEnd}
            onClick={handleLikeClick}
            className={`p-3 rounded-full backdrop-blur-md transition cursor-pointer flex items-center justify-center ${
              myReaction
                ? 'bg-white text-black shadow-lg scale-105'
                : 'bg-slate-950/60 border border-white/20 text-white hover:bg-slate-900/80'
            }`}
            title={myReaction ? REACTION_CONFIG[myReaction].label : 'Like'}
          >
            <Heart className={`w-5 h-5 ${myReaction ? 'fill-current text-black' : 'text-white'}`} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">
            {totalReactions > 0 ? totalReactions : 'Like'}
          </span>
        </div>

        {/* 2. COMMENTS POPUP BUTTON */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onClick={() => {
              playTouchSound();
              setShowCommentsModal(true);
            }}
            className="p-3 rounded-full bg-slate-950/60 border border-white/20 text-white hover:bg-slate-900/80 backdrop-blur-md transition cursor-pointer flex items-center justify-center"
            title="View Comments"
          >
            <MessageCircle className="w-5 h-5 text-white" />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">
            {localComments.length}
          </span>
        </div>

        {/* 3. SHARE BUTTON */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onClick={handleShare}
            className="p-3 rounded-full bg-slate-950/60 border border-white/20 text-white hover:bg-slate-900/80 backdrop-blur-md transition cursor-pointer flex items-center justify-center"
            title="Share Video"
          >
            <Share2 className="w-5 h-5 text-white" />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">
            Share
          </span>
        </div>

        {/* 4. SAVE / BOOKMARK BUTTON */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onClick={onToggleSave}
            className={`p-3 rounded-full backdrop-blur-md transition cursor-pointer flex items-center justify-center ${
              isSaved
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/40 scale-105 font-black'
                : 'bg-slate-950/60 border border-white/20 text-white hover:bg-slate-900/80'
            }`}
            title={isSaved ? 'Saved Video' : 'Save Video'}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-slate-950 text-slate-950' : 'text-white'}`} />
          </button>
          <span className="text-[10px] font-black text-white drop-shadow-md">
            {isSaved ? 'Saved' : 'Save'}
          </span>
        </div>

        {/* 5. DELETE BUTTON (If Owner) */}
        {post.userId === currentUser.id && (
          <button
            onClick={handleDeletePost}
            className="p-3 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/40 backdrop-blur-md transition cursor-pointer flex items-center justify-center"
            title="Delete Video"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* OVERLAY 3: COMMENTS POPUP MODAL (View & add comments without pausing/reloading video) */}
      <AnimatePresence>
        {showCommentsModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col relative"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                  <MessageCircle className="w-4 h-4 text-purple-400" />
                  <span>Comments ({localComments.length})</span>
                </h3>
                <button
                  onClick={() => setShowCommentsModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px]">
                {localComments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs font-medium space-y-1">
                    <p>No comments on this video yet.</p>
                    <p className="text-[11px] text-slate-400 font-bold">Be the first to leave a comment!</p>
                  </div>
                ) : (
                  localComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-start justify-between text-xs"
                    >
                      <div>
                        <span className="font-extrabold text-slate-100 mr-2 inline-flex items-center space-x-1">
                          <span>{comment.authorName || comment.authorUsername}</span>
                          {isDeveloperUser({ username: comment.authorUsername, id: comment.authorId }) && (
                            <VerifiedBadge className="w-3.5 h-3.5 text-sky-400 shrink-0 inline-block" title="Developer Verified" />
                          )}
                        </span>
                        <span className="text-slate-200">{comment.content}</span>
                      </div>

                      {(comment.authorId === currentUser.id || post.userId === currentUser.id) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input Form */}
              <form onSubmit={handleAddComment} className="flex items-center space-x-2 pt-2 border-t border-slate-800 shrink-0">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Leave a comment..."
                  className="flex-1 bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-2xl px-3.5 py-2.5 text-xs text-slate-100 outline-none"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim() || submittingComment}
                  className="px-4 py-2.5 bg-white text-slate-950 hover:bg-slate-200 rounded-2xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4 text-slate-950" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
