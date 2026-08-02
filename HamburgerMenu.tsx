import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Settings,
  HelpCircle,
  ChevronRight,
  LogOut,
  Bookmark
} from 'lucide-react';
import { User, UserSettings } from '../types';
import { MarshmallowLogo } from './MarshmallowLogo';
import { playTouchSound } from '../utils/audioSound';
import { shouldHideHandle } from './VerifiedBadge';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  settings: UserSettings;
  onOpenSettingsModal: () => void;
  onOpenHelpSupport: () => void;
  onOpenSavedVideos?: () => void;
  onLogout: () => void;
}

export const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  isOpen,
  onClose,
  currentUser,
  onOpenSettingsModal,
  onOpenHelpSupport,
  onOpenSavedVideos,
  onLogout
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            playTouchSound();
            onClose();
          }}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative w-80 max-w-[85vw] h-full bg-[#18191a] border-r border-[#3A3B3C] shadow-2xl flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-5 border-b border-[#3A3B3C] bg-[#242526] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MarshmallowLogo size={36} animated />
              <div>
                <h2 className="font-extrabold text-lg text-white leading-tight font-sans">Marshmallow</h2>
                <p className="text-[10px] text-[#B0B3B8] font-medium">by EchoPH</p>
              </div>
            </div>

            <button
              onClick={() => {
                playTouchSound();
                onClose();
              }}
              className="p-2 text-[#B0B3B8] hover:text-white rounded-full hover:bg-[#3A3B3C] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Menu Items List */}
          <div className="flex-1 py-6 px-4 space-y-3">
            {/* 1. Saved Videos */}
            {onOpenSavedVideos && (
              <button
                onClick={() => {
                  playTouchSound();
                  onClose();
                  onOpenSavedVideos();
                }}
                className="w-full p-4 rounded-xl bg-[#242526] hover:bg-[#3A3B3C] border border-[#3A3B3C] text-white text-sm font-bold flex items-center justify-between transition cursor-pointer group"
              >
                <span>Saved Videos</span>
              </button>
            )}

            {/* 2. Account Settings */}
            <button
              onClick={() => {
                playTouchSound();
                onClose();
                onOpenSettingsModal();
              }}
              className="w-full p-4 rounded-xl bg-[#242526] hover:bg-[#3A3B3C] border border-[#3A3B3C] text-white text-sm font-bold flex items-center justify-between transition cursor-pointer group"
            >
              <span>Account Settings</span>
            </button>

            {/* 3. Help & Support */}
            <button
              onClick={() => {
                playTouchSound();
                onClose();
                onOpenHelpSupport();
              }}
              className="w-full p-4 rounded-xl bg-[#242526] hover:bg-[#3A3B3C] border border-[#3A3B3C] text-white text-sm font-bold flex items-center justify-between transition cursor-pointer group"
            >
              <span>Help & Support</span>
            </button>

            {/* 4. Log Out */}
            <button
              onClick={() => {
                playTouchSound();
                onClose();
                onLogout();
              }}
              className="w-full p-4 rounded-xl bg-[#242526] hover:bg-[#3A3B3C] border border-[#3A3B3C] text-white text-sm font-bold flex items-center justify-between transition cursor-pointer group"
            >
              <span className="font-bold">Log Out</span>
            </button>
          </div>

          {/* User Account Info Footer */}
          <div className="p-4 bg-[#242526] border-t border-[#3A3B3C] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#3A3B3C] flex items-center justify-center font-bold text-xs text-white border border-[#4E4F50]">
              {currentUser.nickname ? currentUser.nickname[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-white truncate">{currentUser.nickname}</p>
              {!shouldHideHandle(currentUser) && (
                <p className="text-[10px] text-[#B0B3B8] font-mono">@{currentUser.username}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="py-3 px-4 text-center text-[11px] text-[#B0B3B8] font-medium">
            Marshmallow Social &bull; Private & Secure
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
