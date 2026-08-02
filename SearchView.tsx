import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, Hash, UserPlus, UserCheck, Clock } from 'lucide-react';
import { User as UserType } from '../types';
import { UserAvatar } from './UserAvatar';
import { searchUsers, createDirectChat, sendFriendRequest } from '../services/api';
import { playTouchSound } from '../utils/audioSound';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';

interface SearchViewProps {
  currentUser: UserType;
  onOpenChat: (chatId: string) => void;
  onOpenUserProfile?: (userId: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ currentUser, onOpenChat, onOpenUserProfile }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<UserType & { friendStatus?: 'friend' | 'pending_sent' | 'pending_received' | 'none' }>>([]);
  const [loading, setLoading] = useState(false);
  const [chatLoadingId, setChatLoadingId] = useState<string | null>(null);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

  const handleSearch = async (searchTerm: string) => {
    playTouchSound();
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      const res = await searchUsers(trimmed);
      setResults(res);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      const timer = setTimeout(() => handleSearch(query), 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleStartChatWithCode = async (targetUserId: string) => {
    playTouchSound();
    try {
      setChatLoadingId(targetUserId);
      const chat = await createDirectChat(targetUserId);
      onOpenChat(chat.id);
    } catch (err) {
      console.error('Failed to create chat:', err);
    } finally {
      setChatLoadingId(null);
    }
  };

  const handleAddFriend = async (targetUserId: string) => {
    playTouchSound();
    try {
      setAddingFriendId(targetUserId);
      await sendFriendRequest(targetUserId);
      setResults(prev => prev.map(u => u.id === targetUserId ? { ...u, friendStatus: 'pending_sent' } : u));
    } catch (err: any) {
      alert(err.message || 'Failed to send friend request');
    } finally {
      setAddingFriendId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-4 md:py-6 space-y-6 select-none">
      {/* Header & Search Bar (Borderless Edge-to-Edge) */}
      <div className="bg-slate-900/40 rounded-2xl p-4 md:p-6 space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-pink-500/10 rounded-xl text-pink-400">
            <Search className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-lg md:text-xl text-slate-100 flex items-center space-x-2">
              <span>Search Section</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Type a Username or Name to find users and add them as friends or start chatting.
            </p>
          </div>
        </div>

        {/* Input Search Field */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500">
            <Search className="w-5 h-5 text-pink-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type Username or Name..."
            className="w-full bg-slate-950/80 rounded-xl py-3 pl-12 pr-12 text-sm md:text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-pink-500/50 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-xs font-bold text-slate-400 hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-2">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm font-semibold space-y-3">
            <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Searching for users...</p>
          </div>
        ) : query && results.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-base text-slate-300 font-bold">No users found matching "{query}".</p>
            <p className="text-xs text-slate-500">Type a user's Username or Name to display search results.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-900/80">
            {results.map((user) => {
              const isSelf = user.id === currentUser.id;

              return (
                <div
                  key={user.id}
                  className="py-3.5 px-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-slate-900/40 transition"
                >
                <div
                  onClick={() => onOpenUserProfile?.(user.id)}
                  className="flex items-center space-x-4 cursor-pointer hover:opacity-90 transition w-full sm:w-auto"
                  title="View Profile"
                >
                  <UserAvatar
                    userId={user.id}
                    borderId={user.borderId}
                    src={user.avatarUrl}
                    username={user.username}
                    nickname={user.nickname}
                    size="xl"
                  />
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-slate-100 flex items-center hover:underline decoration-pink-500">
                      <span>{user.nickname || user.username}</span>
                      {isDeveloperUser(user) && <VerifiedBadge className="w-4 h-4 ml-1.5 shrink-0" />}
                    </h3>
                    {!shouldHideHandle(user) && (
                      <span className="text-xs text-slate-400 font-mono">@{user.username}</span>
                    )}
                  </div>
                </div>

                {!isSelf ? (
                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
                    {/* Add Friend Button or Status */}
                    {user.friendStatus === 'friend' ? (
                      <span className="px-3.5 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center space-x-1">
                        <UserCheck className="w-4 h-4" />
                        <span>Magkaibigan</span>
                      </span>
                    ) : user.friendStatus === 'pending_sent' ? (
                      <span className="px-3.5 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>Nai-send Na</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddFriend(user.id)}
                        disabled={addingFriendId === user.id}
                        className="px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        {addingFriendId === user.id ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span>Add Friend</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Chat Button */}
                    <button
                      onClick={() => handleStartChatWithCode(user.id)}
                      disabled={chatLoadingId === user.id}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 border border-slate-700 disabled:opacity-50"
                    >
                      {chatLoadingId === user.id ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 text-pink-400" />
                          <span>Mag-Chat</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-extrabold">
                    Ikaw Ito (You)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);
};
