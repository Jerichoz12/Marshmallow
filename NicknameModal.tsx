import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Clock, Check, AlertCircle, Edit3 } from 'lucide-react';
import { updateNickname } from '../services/api';
import { User } from '../types';

interface NicknameModalProps {
  user: User;
  onClose: () => void;
  onUpdated: (user: User) => void;
}

export const NicknameModal: React.FC<NicknameModalProps> = ({ user, onClose, onUpdated }) => {
  const [nicknameInput, setNicknameInput] = useState(user.nickname || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [remainingTimeStr, setRemainingTimeStr] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    const checkLockStatus = () => {
      if (user.nicknameLastChangedAt) {
        const lastChange = new Date(user.nicknameLastChangedAt).getTime();
        const now = Date.now();
        const elapsed = now - lastChange;

        if (elapsed < SEVEN_DAYS_MS) {
          setIsLocked(true);
          const remaining = SEVEN_DAYS_MS - elapsed;
          const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
          const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
          const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
          const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

          setRemainingTimeStr(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else {
          setIsLocked(false);
          setRemainingTimeStr(null);
        }
      }
    };

    checkLockStatus();
    const interval = setInterval(checkLockStatus, 1000);
    return () => clearInterval(interval);
  }, [user.nicknameLastChangedAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (!nicknameInput.trim()) {
      setError('Nickname cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updatedUser = await updateNickname(nicknameInput.trim());
      setSuccess(true);
      onUpdated(updatedUser);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to update nickname');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-3 bg-pink-500/10 text-pink-400 rounded-2xl border border-pink-500/20">
            <Edit3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Change Nickname</h2>
            <p className="text-xs text-slate-400">Can only be updated once every 7 days</p>
          </div>
        </div>

        {isLocked ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-amber-300 text-xs mb-6">
            <div className="flex items-center space-x-2 font-semibold mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Nickname Lock Active</span>
            </div>
            <p className="text-slate-300 mb-3">
              You recently changed your nickname. To prevent spam, you must wait 7 days between changes.
            </p>
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-center text-sm font-bold text-amber-400">
              Next change available in: {remainingTimeStr}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                New Display Nickname
              </label>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Enter nickname"
                maxLength={30}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>Nickname updated! Next change allowed in 7 days.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Save Nickname</span>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};
