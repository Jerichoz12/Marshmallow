import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserMinus, Check, X, MessageSquare, Video, Clock, Users } from 'lucide-react';
import { User, FriendRequest } from '../types';
import { UserAvatar } from './UserAvatar';
import { formatLastSeen } from '../utils/formatLastSeen';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';
import {
  fetchFriendRequests,
  respondFriendRequest,
  fetchFriends,
  unfriendUser,
  cancelFriendRequest,
  createDirectChat
} from '../services/api';
import { playTouchSound } from '../utils/audioSound';

interface FriendsViewProps {
  currentUser: User;
  onOpenChat: (chatId: string) => void;
  onStartCall: (friend: User) => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenSearchCode?: () => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  currentUser,
  onOpenChat,
  onStartCall,
  onOpenUserProfile,
  onOpenSearchCode
}) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');

  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fList, rList] = await Promise.all([fetchFriends(), fetchFriendRequests()]);
      // Deduplicate friends by ID to fix double display
      const uniqueFriends = Array.from(new Map(fList.map(f => [f.id, f])).values());
      setFriends(uniqueFriends);
      setRequests(rList);
    } catch (e) {
      console.error('Error loading friends data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancelRequest = async (targetUserId?: string, targetName?: string) => {
    if (!targetUserId) return;
    try {
      await cancelFriendRequest(targetUserId);
      setActionMessage(`Cancelled friend request to ${targetName || 'user'}`);
      setTimeout(() => setActionMessage(null), 3000);
      loadData();
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to cancel request');
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await respondFriendRequest(requestId, action);
      setActionMessage(`Request ${action}ed`);
      setTimeout(() => setActionMessage(null), 3000);
      loadData();
    } catch (err: any) {
      setActionMessage(err.message || 'Error responding to request');
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleStartMessageWithFriend = async (friendId: string) => {
    try {
      const chat = await createDirectChat(friendId);
      onOpenChat(chat.id);
    } catch (e) {
      console.error('Failed to open chat', e);
    }
  };

  const handleUnfriend = async (friendId: string, friendNickname: string) => {
    if (!window.confirm(`Are you sure you want to unfriend ${friendNickname}?`)) return;
    try {
      await unfriendUser(friendId);
      setActionMessage(`Unfriended ${friendNickname}`);
      setTimeout(() => setActionMessage(null), 3000);
      loadData();
    } catch (err: any) {
      setActionMessage(err.message || 'Failed to unfriend');
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const pendingIncoming = requests.filter(r => r.receiverId === currentUser.id && r.status === 'pending');
  const pendingOutgoing = requests.filter(r => r.senderId === currentUser.id && r.status === 'pending');
  const onlineFriends = friends.filter(f => f.status === 'online');

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 text-slate-100 select-none">
      {/* Action toast message */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-50 bg-pink-500 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-semibold"
          >
            {actionMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs and Direct Search Code Navigation */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#3A3B3C] pb-4 mb-6">
        <div className="flex items-center space-x-2 bg-[#242526] p-1.5 rounded-xl border border-[#3A3B3C] text-xs font-medium">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-2 ${
              activeTab === 'friends'
                ? 'bg-[#3A3B3C] text-white font-bold'
                : 'text-[#B0B3B8] hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>All Friends</span>
            <span className="ml-1 bg-[#18191A] px-2 py-0.5 rounded-full text-[10px]">
              {friends.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-2 ${
              activeTab === 'requests'
                ? 'bg-[#3A3B3C] text-white font-bold'
                : 'text-[#B0B3B8] hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending Requests</span>
            {pendingIncoming.length > 0 && (
              <span className="bg-[#0866FF] text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {pendingIncoming.length}
              </span>
            )}
          </button>
        </div>

        {/* Search / Add Friend Button */}
        <button
          onClick={() => {
            playTouchSound();
            onOpenSearchCode?.();
          }}
          className="px-4 py-2.5 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition active:scale-95 cursor-pointer"
        >
          <Search className="w-4 h-4 text-[#E4E6EB]" />
          <span>Find Friends in Search</span>
        </button>
      </div>

      {/* TAB 1: ALL FRIENDS */}
      {activeTab === 'friends' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-16 p-8 border-b border-[#3A3B3C]/40">
              <div className="w-16 h-16 rounded-2xl bg-[#242526] flex items-center justify-center mx-auto mb-4 text-[#B0B3B8]">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">No Friends Added Yet</h3>
              <p className="text-xs text-[#B0B3B8] mt-1 max-w-sm mx-auto">
                Use Search to find and connect with your friends on Marshmallow.
              </p>
              <button
                onClick={() => onOpenSearchCode?.()}
                className="mt-4 px-5 py-2.5 rounded-xl bg-[#3A3B3C] hover:bg-[#4E4F50] text-white text-xs font-bold transition cursor-pointer"
              >
                Find Friends in Search
              </button>
            </div>
          ) : (
            <div className="space-y-4">
      {/* Friends Stats Header */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#242526] text-xs font-bold mb-4 border border-[#3A3B3C]">
        <div className="flex items-center space-x-2 text-[#E4E6EB]">
          <Users className="w-4 h-4 text-[#B0B3B8]" />
          <span>Total Friends: <span className="text-white font-extrabold">{friends.length}</span></span>
        </div>
        <div className="flex items-center space-x-2 text-emerald-400">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span>Online Friends: <span className="text-white font-extrabold">{onlineFriends.length}</span></span>
        </div>
      </div>

      {/* Friend Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="bg-[#242526] border border-[#3A3B3C] rounded-xl p-4 flex flex-col justify-between transition"
          >
            <div className="flex items-center space-x-3 mb-3">
              <UserAvatar
                userId={friend.id}
                borderId={friend.borderId}
                src={friend.avatarUrl}
                username={friend.username}
                nickname={friend.nickname}
                size="lg"
                showStatus
                status={friend.status}
                onClick={() => onOpenUserProfile?.(friend.id)}
              />
              <div className="overflow-hidden flex-1">
                <h4 className="font-bold text-sm text-white truncate flex items-center">
                  <span className="truncate">{friend.nickname}</span>
                  {isDeveloperUser(friend) && (
                    <VerifiedBadge className="w-3.5 h-3.5 ml-1 shrink-0" />
                  )}
                </h4>
                {!shouldHideHandle(friend) && (
                  <p className="text-xs text-[#B0B3B8] font-mono">@{friend.username}</p>
                )}
                <p className={`text-[10px] font-semibold mt-0.5 ${friend.status === 'online' ? 'text-emerald-400' : 'text-[#B0B3B8]'}`}>
                  {formatLastSeen(friend.status, friend.lastSeenAt)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => handleStartMessageWithFriend(friend.id)}
                className="py-1.5 px-2 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                title="Chat Message"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => onStartCall(friend)}
                className="py-1.5 px-2 bg-[#3A3B3C] hover:bg-[#4E4F50] text-white rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                title="Video Call"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Call</span>
              </button>
              <button
                onClick={() => handleUnfriend(friend.id, friend.nickname)}
                className="py-1.5 px-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-[11px] font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                title="Unfriend User"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Unfriend</span>
              </button>
            </div>
          </div>
        ))}
      </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-pink-400" />
              <span>Incoming Friend Requests ({pendingIncoming.length})</span>
            </h3>

            {pendingIncoming.length === 0 ? (
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                No incoming friend requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        userId={req.senderUser?.id}
                        borderId={req.senderUser?.borderId}
                        src={req.senderUser?.avatarUrl}
                        username={req.senderUser?.username}
                        nickname={req.senderUser?.nickname}
                        size="md"
                        onClick={() => req.senderUser?.id && onOpenUserProfile?.(req.senderUser.id)}
                      />
                      <div>
                        <h4 className="font-bold text-sm text-slate-100 flex items-center">
                          <span>{req.senderUser?.nickname}</span>
                          {req.senderUser && isDeveloperUser(req.senderUser) && (
                            <VerifiedBadge className="w-3.5 h-3.5 ml-1 shrink-0" />
                          )}
                        </h4>
                        {!shouldHideHandle(req.senderUser) && (
                          <p className="text-xs text-slate-400 font-mono">@{req.senderUser?.username}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRespond(req.id, 'accept')}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 shadow transition"
                      >
                        <Check className="w-4 h-4" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRespond(req.id, 'reject')}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        <X className="w-4 h-4" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Sent Requests ({pendingOutgoing.length})
            </h3>
            {pendingOutgoing.length === 0 ? (
              <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl text-center text-xs text-slate-500">
                No outgoing pending requests.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        userId={req.receiverUser?.id}
                        borderId={req.receiverUser?.borderId}
                        src={req.receiverUser?.avatarUrl}
                        username={req.receiverUser?.username}
                        nickname={req.receiverUser?.nickname}
                        size="sm"
                        onClick={() => req.receiverUser?.id && onOpenUserProfile?.(req.receiverUser.id)}
                      />
                      <div>
                        <h4 className="font-bold text-xs text-slate-200">{req.receiverUser?.nickname}</h4>
                        {!shouldHideHandle(req.receiverUser) && (
                          <p className="text-[10px] text-slate-500 font-mono">@{req.receiverUser?.username}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 font-medium hidden sm:inline">
                        Pending
                      </span>
                      <button
                        onClick={() => handleCancelRequest(req.receiverId || req.receiverUser?.id, req.receiverUser?.nickname)}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel Request</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
