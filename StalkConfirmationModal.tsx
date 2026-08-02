import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, X } from 'lucide-react';
import { User as UserType } from '../types';
import { UserAvatar } from './UserAvatar';
import { fetchTargetUserProfile } from '../services/api';
import { playTouchSound } from '../utils/audioSound';
import { VerifiedBadge, isDeveloperUser, shouldHideHandle } from './VerifiedBadge';

interface StalkConfirmationModalProps {
  isOpen: boolean;
  targetUserId: string | null;
  initialUserObj?: Partial<UserType> | null;
  onClose: () => void;
  onConfirmStalk: (userId: string) => void;
}

export const StalkConfirmationModal: React.FC<StalkConfirmationModalProps> = ({
  isOpen,
  targetUserId,
  initialUserObj,
  onClose,
  onConfirmStalk
}) => {
  const [userInfo, setUserInfo] = useState<Partial<UserType> | null>(initialUserObj || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !targetUserId) {
      setUserInfo(null);
      return;
    }

    if (initialUserObj && initialUserObj.username) {
      setUserInfo(initialUserObj);
    } else {
      setLoading(true);
      fetchTargetUserProfile(targetUserId)
        .then((res) => {
          setUserInfo(res.user);
        })
        .catch((err) => {
          console.error('Failed to load stalk user info:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, targetUserId, initialUserObj]);

  if (!isOpen || !targetUserId) return null;

  const displayHandle = userInfo?.username || targetUserId;
  const isDev = isDeveloperUser(userInfo || targetUserId);
  let displayName = userInfo?.nickname;
  if (!displayName || displayName === displayHandle || displayName === '143456') {
    if (isDev || displayHandle.includes('143456')) {
      displayName = 'Official Admin';
    } else {
      displayName = userInfo?.nickname || displayHandle;
    }
  }
  const hideHandle = shouldHideHandle(userInfo || { username: displayHandle, id: targetUserId });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-5"
        >
          {/* Close X Button */}
          <button
            onClick={() => {
              playTouchSound();
              onClose();
            }}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* User Avatar */}
          <div className="flex flex-col items-center space-y-2 pt-2">
            <UserAvatar
              userId={targetUserId}
              borderId={userInfo?.borderId}
              src={userInfo?.avatarUrl}
              username={displayHandle}
              nickname={displayName}
              size="2xl"
            />
            <h3 className="font-extrabold text-lg text-slate-100 flex items-center justify-center space-x-1">
              <span>{displayName}</span>
              {isDev && <VerifiedBadge className="w-4 h-4 ml-1 shrink-0" />}
            </h3>
            {!hideHandle && (
              <span className="text-xs font-mono text-slate-400">
                @{displayHandle}
              </span>
            )}
          </div>

          {/* Question Headline & Body */}
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white tracking-wide">Stalk {displayName}?</h2>
            <p className="text-xs text-slate-400">
              View {displayName}'s profile, photos, and activity details.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={() => {
                playTouchSound();
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-300 hover:text-white font-bold text-xs transition active:scale-95"
            >
              Cancel
            </button>

            <button
              onClick={() => {
                playTouchSound();
                onConfirmStalk(targetUserId);
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-black text-xs shadow-lg flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-slate-950" />
              <span>Stalk</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
