import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Users, Search, Lock, UserCheck } from 'lucide-react';
import { User } from '../types';
import { UserAvatar } from './UserAvatar';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';

interface UserListModalProps {
  title: string;
  users: User[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSelectUser?: (userId: string) => void;
}

export const UserListModal: React.FC<UserListModalProps> = ({
  title,
  users,
  loading = false,
  error = null,
  onClose,
  onSelectUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u =>
    (u?.nickname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u?.username || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-base text-slate-100">{title} ({users.length})</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-800 bg-slate-900">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or @username..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500 transition"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center space-y-2">
              <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading {title.toLowerCase()}...</span>
            </div>
          ) : error ? (
            <div className="py-12 text-center space-y-2 p-4">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-rose-300">{error}</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              {searchTerm ? 'No users found matching search.' : `No ${title.toLowerCase()} to display.`}
            </div>
          ) : (
            filteredUsers.map((u) => (
              <div
                key={u.id}
                onClick={() => {
                  if (onSelectUser) {
                    onSelectUser(u.id);
                    onClose();
                  }
                }}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/50 hover:bg-slate-800/80 border border-slate-800/60 transition cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <UserAvatar user={u} size="md" />
                  <div>
                    <h4 className="font-bold text-xs text-slate-100 group-hover:text-pink-400 transition flex items-center">
                      <span>{u.nickname}</span>
                      {isDeveloperUser(u) && <VerifiedBadge className="w-3.5 h-3.5 ml-1 shrink-0" />}
                    </h4>
                    {!shouldHideHandle(u) && (
                      <span className="text-[11px] text-slate-400 font-mono">@{u.username}</span>
                    )}
                  </div>
                </div>

                <div className="px-3 py-1 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl text-[11px] font-bold group-hover:bg-pink-500 group-hover:border-pink-400 group-hover:text-white transition">
                  View
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
