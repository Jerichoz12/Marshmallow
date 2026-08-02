import React from 'react';
import { motion } from 'motion/react';
import { Bell, Heart, MessageCircle, Share2, UserPlus, CheckCheck, Clock, Check } from 'lucide-react';
import { AppNotification, User } from '../types';
import { UserAvatar } from './UserAvatar';
import { playTouchSound } from '../utils/audioSound';
import { VerifiedBadge, isDeveloperUser } from './VerifiedBadge';

interface NotificationsViewProps {
  notifications: AppNotification[];
  currentUser: User;
  onMarkAllRead: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onNotificationClick?: (notif: AppNotification) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  currentUser,
  onMarkAllRead,
  onOpenUserProfile,
  onNotificationClick
}) => {
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotifIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'post_like':
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-400" />;
      case 'post_comment':
        return <MessageCircle className="w-4 h-4 text-blue-400 fill-blue-400" />;
      case 'post_share':
        return <Share2 className="w-4 h-4 text-slate-300" />;
      case 'friend_request':
      case 'friend_accept':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-300" />;
    }
  };

  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-2 sm:px-4 py-3 sm:py-5 text-slate-100 select-none space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 mb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl relative">
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-slate-900 text-[10px] font-black rounded-full flex items-center justify-center shadow">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-100 flex items-center space-x-2">
              <span>Notifications</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium">
              {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={() => {
              playTouchSound();
              onMarkAllRead();
            }}
            className="py-1.5 px-3 bg-white text-slate-950 hover:bg-slate-200 rounded-xl text-xs font-extrabold flex items-center space-x-1.5 transition active:scale-95 shadow cursor-pointer"
          >
            <CheckCheck className="w-4 h-4 text-slate-950" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="p-4 bg-slate-900/40 rounded-full text-slate-500">
            <Bell className="w-8 h-8" />
          </div>
          <p className="text-sm font-bold text-slate-300">No notifications yet</p>
          <p className="text-xs text-slate-500 max-w-xs">
            When friends like, comment, share your posts or send friend requests, they will appear right here in real time.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-900/80">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                playTouchSound();
                onNotificationClick?.(notif);
              }}
              className={`py-3.5 px-3 transition flex items-center justify-between gap-3 cursor-pointer rounded-xl ${
                !notif.isRead
                  ? 'bg-slate-800/70 border-l-2 border-white font-medium'
                  : 'hover:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center space-x-3 overflow-hidden flex-1">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <UserAvatar
                    userId={notif.senderUserId}
                    borderId={notif.senderBorderId}
                    src={notif.senderAvatarUrl}
                    nickname={notif.senderName}
                    size="md"
                    onClick={() => onOpenUserProfile?.(notif.senderUserId)}
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 bg-slate-950 border border-slate-800 rounded-full shadow">
                    {getNotifIcon(notif.type)}
                  </div>
                </div>

                {/* Text Content */}
                <div className="overflow-hidden flex-1">
                  <p className="text-xs text-slate-200 leading-snug">
                    <span
                      onClick={() => onOpenUserProfile?.(notif.senderUserId)}
                      className="font-extrabold text-slate-100 hover:underline cursor-pointer decoration-white inline-flex items-center mr-1"
                    >
                      <span>{notif.senderName}</span>
                      {isDeveloperUser({ id: notif.senderUserId }) && (
                        <VerifiedBadge className="w-3.5 h-3.5 ml-1 shrink-0" />
                      )}
                    </span>
                    <span className="text-slate-300">{notif.text}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center space-x-1 mt-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span>{formatTime(notif.createdAt)}</span>
                  </p>
                </div>
              </div>

              {/* Status Indicator */}
              {!notif.isRead && (
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50 shrink-0" />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
