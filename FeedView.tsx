import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  Users,
  RefreshCw,
  ImageIcon,
  Video,
  Send,
  X,
  Plus,
  Upload,
  MessageSquare,
  AlertCircle,
  FileImage,
  Film
} from 'lucide-react';
import { User, Post } from '../types';
import { fetchPosts, createPost, uploadMediaFile } from '../services/api';
import { compressImageFile } from '../utils/imageCompressor';
import { UserAvatar } from './UserAvatar';
import { PostCard } from './PostCard';
import { PullToRefresh } from './PullToRefresh';
import { playTouchSound } from '../utils/audioSound';

interface FeedViewProps {
  currentUser: User;
  onOpenUserProfile?: (userId: string) => void;
  onImageClick?: (imageUrl: string) => void;
}

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

export const FeedView: React.FC<FeedViewProps> = memo(({
  currentUser,
  onOpenUserProfile,
  onImageClick
}) => {
  const [posts, setPosts] = useState<Post[]>(() => {
    try {
      // Clear legacy cache keys
      localStorage.removeItem('marshmallow_cached_home_posts');
      localStorage.removeItem('marshmallow_cached_home_posts_v2');
      localStorage.removeItem('marshmallow_cached_home_posts_v3');
      const cached = localStorage.getItem('marshmallow_cached_home_posts_v4');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter(isCleanPost);
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => posts.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedCacheRef = React.useRef(posts.length > 0);

  // Status Modal State (Text Only)
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Media Post Modal State (Photo or Video + Caption)
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [captionText, setCaptionText] = useState('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submittingMedia, setSubmittingMedia] = useState(false);

  const loadFeedPosts = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else if (!hasLoadedCacheRef.current) setLoading(true);
      setError(null);

      const res = await fetchPosts();
      const cleanRes = (res || []).filter(isCleanPost);
      setPosts(cleanRes);
      hasLoadedCacheRef.current = true;
      try {
        localStorage.setItem('marshmallow_cached_home_posts_v4', JSON.stringify(cleanRes));
      } catch (e) {
        console.warn('Failed to cache posts in localStorage:', e);
      }
    } catch (err: any) {
      console.error('Failed to fetch home feed posts:', err);
      if (posts.length === 0) {
        setError('Hindi maikonekta sa server. Pakisubukan ulit.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [posts.length]);

  useEffect(() => {
    loadFeedPosts();
  }, [loadFeedPosts]);

  const handleRefresh = () => {
    playTouchSound();
    loadFeedPosts(true);
  };

  // Submit Status Post
  const handleCreateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusText.trim()) return;
    playTouchSound();

    try {
      setSubmittingStatus(true);
      await createPost({
        content: statusText.trim(),
        mediaType: 'none'
      });
      setStatusText('');
      setShowStatusModal(false);
      await loadFeedPosts();
    } catch (err: any) {
      alert(err.message || 'Failed to create status post');
    } finally {
      setSubmittingStatus(false);
    }
  };

  // Handle File Upload for Photos or Videos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingMedia(true);
      let base64Data: string;
      if (file.type.startsWith('image/')) {
        base64Data = await compressImageFile(file, 1200, 1200, 0.85);
        setMediaType('image');
      } else {
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setMediaType('video');
      }

      const uploaded = await uploadMediaFile(base64Data, file.name);
      setMediaUrl(uploaded.url);
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingMedia(false);
    }
  };

  // Submit Media Post (Photos / Videos with Caption)
  const handleCreateMediaPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaUrl.trim() && !captionText.trim()) return;
    playTouchSound();

    try {
      setSubmittingMedia(true);
      await createPost({
        content: captionText.trim(),
        mediaType: mediaUrl.trim() ? mediaType : 'none',
        mediaUrl: mediaUrl.trim() || undefined
      });
      setCaptionText('');
      setMediaUrl('');
      setShowMediaModal(false);
      await loadFeedPosts();
    } catch (err: any) {
      alert(err.message || 'Failed to create media post');
    } finally {
      setSubmittingMedia(false);
    }
  };

  return (
    <PullToRefresh onRefresh={() => loadFeedPosts(true)} isRefreshing={refreshing}>
      <div className="max-w-2xl mx-auto px-2 sm:px-4 py-3 sm:py-5 space-y-3 select-none">
      {/* What's on your mind Composer Strip */}
      <div className="bg-[#242526] border border-[#3A3B3C] rounded-xl p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <UserAvatar
            userId={currentUser.id}
            borderId={currentUser.borderId}
            src={currentUser.avatarUrl}
            username={currentUser.username}
            nickname={currentUser.nickname}
            size="md"
            onClick={() => onOpenUserProfile?.(currentUser.id)}
          />

          {/* Trigger for Status-only Post */}
          <button
            onClick={() => {
              playTouchSound();
              setShowStatusModal(true);
            }}
            className="flex-1 bg-[#3A3B3C]/50 hover:bg-[#3A3B3C] rounded-full py-2.5 px-4 text-left text-xs sm:text-sm text-[#B0B3B8] hover:text-[#E4E6EB] font-medium transition cursor-pointer flex items-center justify-between"
          >
            <span className="truncate">
              What's on your mind?
            </span>
          </button>

          {/* Trigger for Photos / Videos Upload */}
          <button
            onClick={() => {
              playTouchSound();
              setShowMediaModal(true);
            }}
            className="p-2.5 text-[#45BD62] hover:bg-[#3A3B3C] rounded-full transition flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
            title="Share Photos or Videos with Caption"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Buttons Below Bar */}
        <div className="pt-2 border-t border-[#3E4042] flex items-center justify-around text-xs font-bold text-[#B0B3B8]">
          <button
            onClick={() => {
              playTouchSound();
              setShowStatusModal(true);
            }}
            className="flex items-center space-x-2 py-2 px-3 rounded-lg hover:bg-[#3A3B3C]/60 hover:text-white transition cursor-pointer flex-1 justify-center"
          >
            <MessageSquare className="w-4 h-4 text-[#E4E6EB]" />
            <span>Text Status</span>
          </button>

          <button
            onClick={() => {
              playTouchSound();
              setMediaType('image');
              setShowMediaModal(true);
            }}
            className="flex items-center space-x-2 py-2 px-3 rounded-lg hover:bg-[#3A3B3C]/60 hover:text-white transition cursor-pointer flex-1 justify-center"
          >
            <ImageIcon className="w-4 h-4 text-[#45BD62]" />
            <span>Photos / Videos</span>
          </button>

          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 py-2 px-3 rounded-lg hover:bg-[#3A3B3C]/60 hover:text-white transition cursor-pointer flex-1 justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-[#B0B3B8] ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadFeedPosts()}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Posts Feed Display */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-300">Loading Home Feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-400 mx-auto opacity-70" />
          <h3 className="text-base font-extrabold text-slate-200">No posts yet.</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Share your very first status update or photo!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-900/80">
          {[...posts].sort((a, b) => {
            const isVideoA = a.mediaType === 'video' || (!!a.mediaUrl && (a.mediaUrl.endsWith('.mp4') || a.mediaUrl.endsWith('.webm') || a.mediaUrl.includes('/video/')));
            const isVideoB = b.mediaType === 'video' || (!!b.mediaUrl && (b.mediaUrl.endsWith('.mp4') || b.mediaUrl.endsWith('.webm') || b.mediaUrl.includes('/video/')));
            if (isVideoA !== isVideoB) {
              return isVideoA ? 1 : -1;
            }
            const timeA = new Date(a.createdAt || 0).getTime();
            const timeB = new Date(b.createdAt || 0).getTime();
            return timeB - timeA;
          }).map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onPostUpdated={(deletedPostId) => {
                if (deletedPostId) {
                  setPosts(prev => prev.filter(p => p.id !== deletedPostId));
                }
              }}
              onUserClick={onOpenUserProfile}
              onImageClick={onImageClick}
            />
          ))}
        </div>
      )}

      {/* MODAL 1: STATUS ONLY POST */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <h3 className="text-lg font-black text-slate-100 flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-white" />
                <span>What's on your mind? (Status Only)</span>
              </h3>
              <button
                onClick={() => setShowStatusModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStatus} className="space-y-4">
              <div className="flex items-center space-x-3">
                <UserAvatar
                  userId={currentUser.id}
                  borderId={currentUser.borderId}
                  src={currentUser.avatarUrl}
                  username={currentUser.username}
                  nickname={currentUser.nickname}
                  size="md"
                />
                <div>
                  <h4 className="font-bold text-sm text-slate-100">{currentUser.nickname}</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Status Update</span>
                </div>
              </div>

              <textarea
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                placeholder="Type what's on your mind..."
                rows={4}
                className="w-full bg-slate-950 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition resize-none"
                autoFocus
              />

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!statusText.trim() || submittingStatus}
                  className="px-6 py-2.5 bg-white hover:bg-slate-200 text-slate-950 font-extrabold text-xs rounded-xl shadow-md flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {submittingStatus ? (
                    <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Post Status</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PHOTOS / VIDEOS POST WITH CAPTION */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <h3 className="text-lg font-black text-slate-100 flex items-center space-x-2">
                <ImageIcon className="w-5 h-5 text-emerald-400" />
                <span>Share Photo or Video</span>
              </h3>
              <button
                onClick={() => setShowMediaModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMediaPost} className="space-y-4">
              {/* Media Type Selector */}
              <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setMediaType('image')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 ${
                    mediaType === 'image'
                      ? 'bg-emerald-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileImage className="w-4 h-4" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaType('video')}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-2 ${
                    mediaType === 'video'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  <span>Video</span>
                </button>
              </div>

              {/* Upload File Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Select {mediaType === 'image' ? 'Photo' : 'Video'} File
                </label>

                <div>
                  <label className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 cursor-pointer border border-slate-700 transition active:scale-[0.98]">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    <span>Upload {mediaType === 'image' ? 'Photo' : 'Video'} File</span>
                    <input
                      type="file"
                      accept={mediaType === 'image' ? 'image/*' : 'video/*'}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {uploadingMedia && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-2xl flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Uploading media...</span>
                  </div>
                )}

                {/* Media Preview */}
                {mediaUrl && (
                  <div className="relative rounded-2xl overflow-hidden max-h-56 bg-slate-950 flex items-center justify-center shadow-lg">
                    {mediaType === 'image' ? (
                      <img src={mediaUrl} alt="Preview" className="max-h-56 object-contain" />
                    ) : (
                      <video src={mediaUrl} controls className="max-h-56 w-full object-contain" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaUrl('')}
                      className="absolute top-2 right-2 p-1 bg-slate-950/80 text-white rounded-lg hover:bg-rose-600 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Caption Text Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 block">Caption</label>
                <textarea
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Add a caption for your photo or video..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMediaModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={(!mediaUrl.trim() && !captionText.trim()) || submittingMedia || uploadingMedia}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center space-x-2 transition disabled:opacity-50"
                >
                  {submittingMedia ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Share Post</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PullToRefresh>
  );
});

FeedView.displayName = 'FeedView';
