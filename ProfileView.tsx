import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Edit3,
  Camera,
  MapPin,
  GraduationCap,
  Briefcase,
  Phone,
  Lock,
  Globe,
  Users,
  Calendar,
  Grid,
  Film,
  FileText,
  UserPlus,
  MessageSquare,
  Video,
  ArrowLeft,
  UserCheck,
  Clock,
  Shield,
  MoreVertical,
  Sparkles,
  QrCode,
  Copy,
  Check,
  Sliders,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { User, Post } from '../types';
import { fetchPosts, fetchTargetUserProfile, sendFriendRequest, cancelFriendRequest, createDirectChat, updateUserProfile, getUserFollowers, getUserFollowing, wsManager } from '../services/api';
import { PostCard } from './PostCard';
import { EditProfileModal } from './EditProfileModal';
import { UserAvatar } from './UserAvatar';
import { BorderSelectorModal } from './BorderSelectorModal';
import { UserListModal } from './UserListModal';
import { getBorderIdFromSeed, BORDER_DESIGNS } from '../utils/avatarBorders';
import { formatLastSeen } from '../utils/formatLastSeen';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';

interface ProfileViewProps {
  currentUser: User;
  onProfileUpdated: (updatedUser: User) => void;
  viewedUserId?: string | null;
  onBackToSelf?: () => void;
  onOpenChat?: (chatId: string) => void;
  onStartCall?: (friend: User) => void;
  onOpenUserProfile?: (userId: string) => void;
  onImageClick?: (imageUrl: string) => void;
  onOpenSettings?: () => void;
  onOpenPrivacy?: () => void;
  onLogout?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  onProfileUpdated,
  viewedUserId,
  onBackToSelf,
  onOpenChat,
  onStartCall,
  onOpenUserProfile,
  onImageClick,
  onOpenSettings,
  onOpenPrivacy,
  onLogout
}) => {
  const isViewingSelf = !viewedUserId || viewedUserId === currentUser.id;

  const [activeTab, setActiveTab] = useState<'posts' | 'photos' | 'videos'>('posts');
  const [profileUser, setProfileUser] = useState<User>(currentUser);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [friendStatus, setFriendStatus] = useState<'friend' | 'pending_sent' | 'pending_received' | 'none' | 'self'>('self');
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBorderModalOpen, setIsBorderModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [customBorderId, setCustomBorderId] = useState<number>(() =>
    getBorderIdFromSeed(viewedUserId || currentUser.id)
  );
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const [listModal, setListModal] = useState<{
    title: string;
    users: User[];
    loading: boolean;
    error: string | null;
  } | null>(null);

  const handleOpenFollowers = async () => {
    setListModal({ title: 'Followers', users: [], loading: true, error: null });
    try {
      const followers = await getUserFollowers(profileUser.id);
      setListModal({ title: 'Followers', users: followers, loading: false, error: null });
    } catch (err: any) {
      setListModal({ title: 'Followers', users: [], loading: false, error: err.message || 'Unable to view followers' });
    }
  };

  const handleOpenFollowing = async () => {
    setListModal({ title: 'Following', users: [], loading: true, error: null });
    try {
      const following = await getUserFollowing(profileUser.id);
      setListModal({ title: 'Following', users: following, loading: false, error: null });
    } catch (err: any) {
      setListModal({ title: 'Following', users: [], loading: false, error: err.message || 'Unable to view following' });
    }
  };

  useEffect(() => {
    const unbindStats = wsManager.on('profile_stats_update', (payload: any) => {
      if (payload && payload.userId === profileUser.id) {
        setProfileUser(prev => ({
          ...prev,
          followersCount: payload.followersCount,
          followingCount: payload.followingCount
        }));
      }
    });

    const unbindReqNew = wsManager.on('friend_request_new', () => {
      loadProfileData();
    });

    const unbindReqUpdate = wsManager.on('friend_request_update', () => {
      loadProfileData();
    });

    const unbindUnfriend = wsManager.on('friend_unfriend', () => {
      loadProfileData();
    });

    return () => {
      unbindStats();
      unbindReqNew();
      unbindReqUpdate();
      unbindUnfriend();
    };
  }, [profileUser.id]);

  const coverImageSrc = profileUser.coverUrl;

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const targetId = isViewingSelf ? currentUser.id : viewedUserId;
      if (targetId) {
        const data = await fetchTargetUserProfile(targetId);
        if (isViewingSelf) {
          setProfileUser(data.user ? { ...currentUser, ...data.user } : currentUser);
          setIsPrivate(false);
          setFriendStatus('self');
        } else {
          setProfileUser(data.user);
          setIsPrivate(data.isPrivate);
          setFriendStatus(data.friendStatus);
        }
        setUserPosts(data.posts || []);
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [currentUser.id, viewedUserId]);

  const photoPosts = userPosts.filter(p => p.mediaType === 'image' && p.mediaUrl);
  const videoPosts = userPosts.filter(p => p.mediaType === 'video' && p.mediaUrl);

  const handleAddFriend = async () => {
    if (!viewedUserId) return;
    try {
      setFriendActionLoading(true);
      await sendFriendRequest(viewedUserId);
      setFriendStatus('pending_sent');
      setProfileUser(prev => ({
        ...prev,
        followersCount: (prev.followersCount ?? 0) + 1
      }));
      setActionNotice('Friend request sent!');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      setActionNotice(err.message || 'Failed to send request');
      setTimeout(() => setActionNotice(null), 3000);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleCancelFriendRequestAction = async () => {
    if (!viewedUserId) return;
    try {
      setFriendActionLoading(true);
      await cancelFriendRequest(viewedUserId);
      setFriendStatus('none');
      setProfileUser(prev => ({
        ...prev,
        followersCount: Math.max(0, (prev.followersCount ?? 1) - 1)
      }));
      setActionNotice('Friend request cancelled.');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      setActionNotice(err.message || 'Failed to cancel request');
      setTimeout(() => setActionNotice(null), 3000);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleMessageUser = async () => {
    if (!viewedUserId || !onOpenChat) return;
    try {
      setFriendActionLoading(true);
      const chat = await createDirectChat(viewedUserId);
      onOpenChat(chat.id);
    } catch (err: any) {
      setActionNotice(err.message || 'Failed to start conversation');
      setTimeout(() => setActionNotice(null), 3000);
    } finally {
      setFriendActionLoading(false);
    }
  };

  const getPhonePrivacyIcon = () => {
    switch (profileUser.phonePrivacy) {
      case 'public':
        return <Globe className="w-3.5 h-3.5 text-emerald-400" title="Public" />;
      case 'friends':
        return <Users className="w-3.5 h-3.5 text-blue-400" title="Friends Only" />;
      case 'only_me':
      default:
        return <Lock className="w-3.5 h-3.5 text-rose-400" title="Only Me" />;
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-medium">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4 py-3 sm:py-5 space-y-4">
      {/* Top Navigation Back Button if Viewing Another User */}
      {!isViewingSelf && (
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToSelf}
            className="px-3.5 py-2 rounded-xl bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition"
          >
            <span>Back to My Profile</span>
          </button>

          {actionNotice && (
            <span className="text-xs font-bold text-pink-400 bg-pink-500/10 px-3 py-1 rounded-full animate-fade-in">
              {actionNotice}
            </span>
          )}
        </div>
      )}

      {/* Cover Photo & Header Section (Directly attached to background) */}
      <div className="overflow-hidden relative">
        {/* THREE-DOT (⋮) MENU BUTTON IN TOP-RIGHT CORNER OF PROFILE CARD */}
        <div className="absolute top-3 right-3 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-2.5 rounded-2xl bg-slate-950/70 hover:bg-slate-900 border border-slate-700/80 text-slate-200 hover:text-white shadow-xl backdrop-blur-md transition-all active:scale-95 cursor-pointer flex items-center justify-center font-bold text-xs"
            title="Profile Options"
            aria-label="Profile options menu"
          >
            <span>Menu</span>
          </button>

          {/* Three-dot Dropdown Menu */}
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Invisible backdrop to dismiss menu on click outside */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-64 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl z-50 p-1.5 space-y-1 text-slate-200 overflow-hidden"
                >
                  {isViewingSelf ? (
                    <>
                      {/* 1. Edit Profile */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setIsEditModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 text-left text-xs font-bold transition text-slate-200 hover:text-pink-400 cursor-pointer block"
                      >
                        Edit Profile
                      </button>

                      {/* 2. Frame Collection */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          setIsBorderModalOpen(true);
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 text-left text-xs font-bold transition text-slate-200 hover:text-pink-400 cursor-pointer block"
                      >
                        Frame Collection
                      </button>

                      {/* 3. Privacy Settings */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          if (onOpenPrivacy) onOpenPrivacy();
                          else if (onOpenSettings) onOpenSettings();
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl hover:bg-[#3A3B3C] text-left text-xs font-bold transition text-[#E4E6EB] hover:text-white cursor-pointer block"
                      >
                        Privacy Settings
                      </button>

                      {/* 5. Account Settings */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenSettings?.();
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 text-left text-xs font-bold transition text-slate-200 hover:text-pink-400 cursor-pointer block"
                      >
                        Account Settings
                      </button>

                      <div className="h-px bg-slate-800/80 my-1" />

                      {/* 6. Logout */}
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onLogout?.();
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl hover:bg-rose-500/10 text-left text-xs font-bold transition text-rose-400 hover:text-rose-300 cursor-pointer block"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          const userCode = profileUser?.codeNumber || (typeof profileUser?.id === 'string' && profileUser.id.includes('code_') ? profileUser.id.split('code_')[1] : profileUser?.username || '');
                          navigator.clipboard.writeText('#' + userCode);
                          setCopiedCode(true);
                          setTimeout(() => setCopiedCode(false), 2000);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-slate-800/80 text-left text-xs font-bold transition text-slate-200 hover:text-pink-400 cursor-pointer"
                      >
                        <span>Copy Profile Code</span>
                        {copiedCode && <span className="text-emerald-400 text-[10px]">Copied</span>}
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Cover Photo Background */}
        <div
          onClick={() => {
            if (coverImageSrc) onImageClick?.(coverImageSrc);
          }}
          className="relative h-48 md:h-64 bg-gradient-to-r from-[#111827] via-[#1a2333] to-[#1f2937] overflow-hidden group cursor-pointer border-b border-slate-800/80"
          title={coverImageSrc ? "Click to view cover photo" : "Cover Banner"}
        >
          {coverImageSrc ? (
            <img
              src={coverImageSrc}
              alt="Cover"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#111827] via-[#1c2638] to-[#1f2937] flex items-center justify-center relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-700/20 via-transparent to-transparent" />
            </div>
          )}

          {/* Subtle Dark Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/25 to-slate-950/40 pointer-events-none" />

          {/* Camera Button on Cover Photo when viewing own profile */}
          {isViewingSelf && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditModalOpen(true);
              }}
              className="absolute bottom-3 right-3 z-20 p-2.5 bg-[#18191a]/80 hover:bg-[#242526] text-white rounded-full shadow-xl border border-[#3A3B3C] transition hover:scale-105 cursor-pointer flex items-center justify-center"
              title="Change cover photo"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          )}
        </div>

        {/* Profile Info Overlay Row */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
          <div className="flex flex-col sm:flex-row items-center sm:items-end space-y-3 sm:space-y-0 sm:space-x-5 text-center sm:text-left">
            {/* DYNAMIC AVATAR WITH BORDER */}
            <div className="relative flex flex-col items-center">
              <div className="relative group">
                <UserAvatar
                  userId={profileUser.id}
                  borderId={profileUser.borderId !== undefined && profileUser.borderId !== null ? profileUser.borderId : getBorderIdFromSeed(profileUser.username || profileUser.id)}
                  src={profileUser.avatarUrl}
                  username={profileUser.username}
                  nickname={profileUser.nickname}
                  size="3xl"
                  showStatus
                  status={profileUser.status}
                  onClick={() => {
                    const avatar = profileUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${profileUser.username}`;
                    onImageClick?.(avatar);
                  }}
                  title="Click to view full photo"
                />
                {isViewingSelf && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditModalOpen(true);
                    }}
                    className="absolute bottom-2 right-2 z-20 p-2 bg-[#18191a] hover:bg-[#242526] text-white rounded-full shadow-xl border border-[#3A3B3C] transition hover:scale-105 cursor-pointer flex items-center justify-center"
                    title="Change profile picture"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 sm:pt-0">
              <h1 className="font-bold text-2xl text-white flex items-center justify-center sm:justify-start space-x-2">
                <span>{profileUser.nickname}</span>
                {isDeveloperUser(profileUser) && (
                  <VerifiedBadge className="w-5 h-5 text-[#2E89FF] shrink-0" title="Verified" />
                )}
              </h1>
              
              <div className="flex items-center justify-center sm:justify-start space-x-2 mt-1">
                {!shouldHideHandle(profileUser) && (
                  <span className="text-xs text-[#B0B3B8] font-semibold font-mono">@{profileUser.username}</span>
                )}
                {profileUser.status === 'online' ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" title="Online" />
                ) : (
                  <span className="text-[11px] font-medium text-[#B0B3B8] flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                    <span>{formatLastSeen(profileUser.status, profileUser.lastSeenAt)}</span>
                  </span>
                )}
              </div>

              {/* Followers & Following Stats */}
              {!isPrivate && (
                <div className="flex items-center justify-center sm:justify-start space-x-3 mt-3">
                  <button
                    onClick={handleOpenFollowers}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#242526] hover:bg-[#3A3B3C] transition cursor-pointer group"
                  >
                    <span className="font-extrabold text-xs text-white group-hover:text-[#2E89FF] transition">{profileUser.followersCount ?? 0}</span>
                    <span className="text-xs text-[#B0B3B8] font-medium">Followers</span>
                  </button>

                  <button
                    onClick={handleOpenFollowing}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#242526] hover:bg-[#3A3B3C] transition cursor-pointer group"
                  >
                    <span className="font-extrabold text-xs text-white group-hover:text-[#2E89FF] transition">{profileUser.followingCount ?? 0}</span>
                    <span className="text-xs text-[#B0B3B8] font-medium">Following</span>
                  </button>

                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#242526] text-xs">
                    <span className="font-extrabold text-white">{userPosts.length}</span>
                    <span className="text-[#B0B3B8] font-medium">Posts</span>
                  </div>
                </div>
              )}

              {profileUser.bio && !isPrivate && (
                <p className="text-xs text-[#E4E6EB] mt-2 max-w-md italic">"{profileUser.bio}"</p>
              )}
            </div>
          </div>

          {/* Action Buttons for non-self profile */}
          {!isViewingSelf && (
            <div className="flex items-center space-x-2 justify-center sm:justify-end">
              {friendStatus === 'none' && (
                <button
                  onClick={handleAddFriend}
                  disabled={friendActionLoading}
                  className="px-4 py-2 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  <span>Add Friend</span>
                </button>
              )}

              {friendStatus === 'pending_sent' && (
                <div className="flex items-center space-x-2">
                  <div className="px-3 py-2 bg-[#242526] text-[#B0B3B8] font-bold text-xs rounded-xl">
                    <span>Request Sent</span>
                  </div>
                  <button
                    onClick={handleCancelFriendRequestAction}
                    disabled={friendActionLoading}
                    className="px-3 py-2 bg-[#242526] hover:bg-[#3A3B3C] text-rose-400 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <span>Cancel</span>
                  </button>
                </div>
              )}

              {friendStatus === 'friend' && (
                <>
                  <button
                    onClick={handleMessageUser}
                    disabled={friendActionLoading}
                    className="px-4 py-2 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95 disabled:opacity-50"
                  >
                    <span>Message</span>
                  </button>

                  {onStartCall && (
                    <button
                      onClick={() => onStartCall(profileUser)}
                      className="px-3 py-2 bg-[#242526] hover:bg-[#3A3B3C] text-white rounded-xl text-xs font-bold transition"
                      title="Start Video Call"
                    >
                      <span>Video Call</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PRIVATE PROFILE WARNING CARD */}
      {isPrivate ? (
        <div className="bg-[#242526] rounded-3xl p-8 text-center space-y-3">
          <h3 className="font-bold text-base text-white">This Profile is Private</h3>
          <p className="text-xs text-[#B0B3B8] max-w-sm mx-auto leading-relaxed">
            {shouldHideHandle(profileUser) ? profileUser.nickname : `@${profileUser.username}`} has set their profile visibility to <strong>Only Me</strong>. Details and posts are hidden.
          </p>
        </div>
      ) : (
        <>
          {/* Profile Details & Bio Section - Clean & Directly Attached to Background */}
          <div className="py-2 space-y-3">
            <h3 className="font-extrabold text-sm text-white px-1">
              <span>About Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#E4E6EB]">
              {/* Gender */}
              <div className="p-3 rounded-xl bg-[#242526] transition">
                <span className="text-[10px] text-[#B0B3B8] font-bold uppercase tracking-wide block">Gender</span>
                <span className="font-bold text-white text-sm capitalize">{profileUser.gender || 'Not set'}</span>
              </div>

              {/* Age / Birthday */}
              <div className="p-3 rounded-xl bg-[#242526] transition">
                <span className="text-[10px] text-[#B0B3B8] font-bold uppercase tracking-wide block">Age / Birthday</span>
                <span className="font-bold text-white text-sm">
                  {profileUser.birthday ? `${profileUser.birthday}${profileUser.age ? ` (${profileUser.age} yrs)` : ''}` : profileUser.age || 'Not added'}
                </span>
              </div>

              {/* Hometown */}
              <div className="p-3 rounded-xl bg-[#242526] transition">
                <span className="text-[10px] text-[#B0B3B8] font-bold uppercase tracking-wide block">Hometown</span>
                <span className="font-bold text-white text-sm">{profileUser.hometown || 'Not added'}</span>
              </div>

              {/* School */}
              <div className="p-3 rounded-xl bg-[#242526] transition">
                <span className="text-[10px] text-[#B0B3B8] font-bold uppercase tracking-wide block">School</span>
                <span className="font-bold text-white text-sm">{profileUser.school || 'Not added'}</span>
              </div>

              {/* Work */}
              <div className="p-3 rounded-xl bg-[#242526] transition">
                <span className="text-[10px] text-[#B0B3B8] font-bold uppercase tracking-wide block">Work / Job</span>
                <span className="font-bold text-white text-sm">{profileUser.work || 'Not added'}</span>
              </div>

              {/* Phone Number with Privacy Indicator */}
              {profileUser.phone && (
                <div className="sm:col-span-2 p-3 rounded-xl bg-[#242526] transition flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#B0B3B8] font-bold uppercase tracking-wide block">Phone Number</span>
                    <span className="font-bold text-white text-sm">{profileUser.phone}</span>
                  </div>

                  <div className="px-2.5 py-1 rounded-full bg-[#3A3B3C] text-[10px] text-[#E4E6EB] font-bold">
                    <span className="capitalize">{profileUser.phonePrivacy === 'only_me' ? 'Only Me' : profileUser.phonePrivacy}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Profile Details Action Button */}
            {isViewingSelf && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="w-full py-2.5 px-4 bg-[#242526] hover:bg-[#3A3B3C] border border-[#3A3B3C] text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
              >
                <span>Edit Public Details</span>
              </button>
            )}
          </div>

          {/* Tabs Bar */}
          <div className="flex items-center space-x-2 border-b border-[#3A3B3C] pb-2">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                activeTab === 'posts'
                  ? 'bg-[#3A3B3C] text-white font-bold'
                  : 'text-[#B0B3B8] hover:text-white'
              }`}
            >
              <span>Posts ({userPosts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('photos')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                activeTab === 'photos'
                  ? 'bg-[#3A3B3C] text-white font-bold'
                  : 'text-[#B0B3B8] hover:text-white'
              }`}
            >
              <span>Photos ({photoPosts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('videos')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                activeTab === 'videos'
                  ? 'bg-[#3A3B3C] text-white font-bold'
                  : 'text-[#B0B3B8] hover:text-white'
              }`}
            >
              <span>Videos ({videoPosts.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'posts' && (
            <div className="divide-y divide-slate-900/80">
              {userPosts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-semibold">No posts available on this profile.</p>
                </div>
              ) : (
                userPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onPostUpdated={loadProfileData}
                    onUserClick={onOpenUserProfile}
                    onImageClick={onImageClick}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="divide-y divide-slate-900/80">
              {photoPosts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-semibold">No photos uploaded yet.</p>
                </div>
              ) : (
                photoPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onPostUpdated={loadProfileData}
                    onUserClick={onOpenUserProfile}
                    onImageClick={onImageClick}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'videos' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videoPosts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-slate-500">
                  No videos uploaded yet.
                </div>
              ) : (
                videoPosts.map(post => (
                  <div key={post.id} className="rounded-xl overflow-hidden bg-slate-950 p-1">
                    <video src={post.mediaUrl} controls className="w-full max-h-48 bg-black rounded-lg" />
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Edit Profile Modal (Only for self) */}
      {isViewingSelf && (
        <>
          <EditProfileModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            currentUser={currentUser}
            onProfileUpdated={(updated) => {
              onProfileUpdated(updated);
              loadProfileData();
            }}
          />

          <BorderSelectorModal
            isOpen={isBorderModalOpen}
            onClose={() => setIsBorderModalOpen(false)}
            userId={currentUser.id}
            username={currentUser.username}
            nickname={currentUser.nickname}
            avatarUrl={currentUser.avatarUrl}
            currentBorderId={profileUser.borderId !== undefined && profileUser.borderId !== null ? profileUser.borderId : getBorderIdFromSeed(profileUser.username || profileUser.id)}
            onSelectBorder={async (borderId) => {
              try {
                const updated = await updateUserProfile({ borderId });
                setProfileUser(updated);
                onProfileUpdated(updated);
                setActionNotice('Equipped AAA Frame permanently!');
                setTimeout(() => setActionNotice(null), 3000);
              } catch (err) {
                console.error('Failed to update border:', err);
              }
            }}
          />
        </>
      )}

      {listModal && (
        <UserListModal
          title={listModal.title}
          users={listModal.users}
          loading={listModal.loading}
          error={listModal.error}
          onClose={() => setListModal(null)}
          onSelectUser={(userId) => {
            if (onOpenUserProfile) onOpenUserProfile(userId);
          }}
        />
      )}
    </div>
  );
};
