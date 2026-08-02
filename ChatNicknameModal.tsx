import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Edit3, Tag, Check, RefreshCw, ShieldCheck, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import { UserAvatar } from './UserAvatar';
import { getChatNickname, setChatNickname } from '../utils/chatNicknames';
import { sendMessage, createDirectChat, updateUserProfile } from '../services/api';

interface ChatNicknameModalProps {
  currentUser: User;
  partner: User;
  chatId?: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export const ChatNicknameModal: React.FC<ChatNicknameModalProps> = ({
  currentUser,
  partner,
  chatId,
  onClose,
  onUpdated
}) => {
  const initialPartnerNickname = getChatNickname(currentUser.id, partner.id) || '';
  const initialMyNickname = currentUser.nickname || '';

  const [myNicknameInput, setMyNicknameInput] = useState(initialMyNickname);
  const [partnerNicknameInput, setPartnerNicknameInput] = useState(initialPartnerNickname);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const getTargetChatId = async (): Promise<string | null> => {
    if (chatId) return chatId;
    try {
      const directChat = await createDirectChat(partner.id);
      return directChat.id;
    } catch (e) {
      console.error('Failed to resolve direct chat ID', e);
      return null;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    const targetChatId = await getTargetChatId();
    const cleanMyNickname = myNicknameInput.trim();
    const cleanPartnerNickname = partnerNicknameInput.trim();

    try {
      // 1. Update My Nickname if changed
      if (cleanMyNickname !== initialMyNickname) {
        await updateUserProfile({ nickname: cleanMyNickname });
        
        // Dispatch event for local user state refresh
        window.dispatchEvent(new CustomEvent('user_profile_updated', {
          detail: { nickname: cleanMyNickname }
        }));

        if (targetChatId) {
          const myCode = currentUser.username;
          let msgText = '';
          if (cleanMyNickname) {
            msgText = myCode === '547257'
              ? `code547257 change her nickname to ${cleanMyNickname}`
              : `code${myCode} change your nickname to ${cleanMyNickname}`;
          } else {
            msgText = myCode === '547257'
              ? `code547257 reset her nickname`
              : `code${myCode} reset your nickname`;
          }

          await sendMessage({
            chatId: targetChatId,
            content: msgText,
            mediaType: 'text'
          });
        }
      }

      // 2. Update Partner Nickname if changed
      if (cleanPartnerNickname !== initialPartnerNickname) {
        setChatNickname(currentUser.id, partner.id, cleanPartnerNickname);

        if (targetChatId) {
          const myCode = currentUser.username;
          const partnerCode = partner.username;
          let msgText = '';

          // Pronoun rule: 547257 is her, 143456 is his
          const partnerPronoun = partnerCode === '547257' ? 'her' : (partnerCode === '143456' ? 'his' : 'nickname');

          if (cleanPartnerNickname) {
            msgText = partnerPronoun === 'nickname'
              ? `code${myCode} change nickname to ${cleanPartnerNickname}`
              : `code${myCode} change ${partnerPronoun} nickname to ${cleanPartnerNickname}`;
          } else {
            msgText = partnerPronoun === 'nickname'
              ? `code${myCode} reset nickname`
              : `code${myCode} reset ${partnerPronoun} nickname`;
          }

          await sendMessage({
            chatId: targetChatId,
            content: msgText,
            mediaType: 'text'
          });
        }
      }

      setSavedSuccess(true);
      onUpdated?.();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving nicknames:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetBoth = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const targetChatId = await getTargetChatId();

      // Reset My Nickname
      if (initialMyNickname) {
        await updateUserProfile({ nickname: '' });
        setMyNicknameInput('');
        window.dispatchEvent(new CustomEvent('user_profile_updated', { detail: { nickname: '' } }));
      }

      // Reset Partner Nickname
      if (initialPartnerNickname) {
        setChatNickname(currentUser.id, partner.id, '');
        setPartnerNicknameInput('');
      }

      if (targetChatId && (initialMyNickname || initialPartnerNickname)) {
        const myCode = currentUser.username;
        await sendMessage({
          chatId: targetChatId,
          content: `code${myCode} reset nicknames`,
          mediaType: 'text'
        });
      }

      setSavedSuccess(true);
      onUpdated?.();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error resetting nicknames:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Top Header Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="p-3 bg-pink-500/10 text-pink-400 rounded-2xl border border-pink-500/20">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Edit Chat Nicknames</h2>
            <p className="text-xs text-slate-400">Change your nickname and your chat partner's nickname</p>
          </div>
        </div>

        {/* Info Card Banner */}
        <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 mb-5 flex items-center space-x-3">
          <UserAvatar
            userId={partner.id}
            borderId={partner.borderId}
            src={partner.avatarUrl}
            username={partner.username}
            nickname={partner.nickname}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-slate-200 truncate">
                Code: <span className="font-mono text-pink-400">#{partner.username}</span>
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              A notification message will appear in the chat box whenever a nickname is changed.
            </p>
          </div>
        </div>

        {/* Edit Form with 2 fields */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Field 1: My Nickname */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <UserIcon className="w-3.5 h-3.5 text-pink-400" />
                <span>My Nickname (#{currentUser.username})</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Visible to partner</span>
            </label>
            <input
              type="text"
              value={myNicknameInput}
              onChange={(e) => setMyNicknameInput(e.target.value)}
              placeholder={`Default: ${currentUser.username}`}
              maxLength={30}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm font-medium text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition"
            />
          </div>

          {/* Field 2: Partner's Nickname */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 ml-1 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                <span>#{partner.username}'s Nickname (Partner)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Visible to you in chat</span>
            </label>
            <input
              type="text"
              value={partnerNicknameInput}
              onChange={(e) => setPartnerNicknameInput(e.target.value)}
              placeholder={`Default: ${partner.nickname || partner.username}`}
              maxLength={30}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm font-medium text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 transition"
            />
          </div>

          {/* Success Toast */}
          {savedSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center space-x-2"
            >
              <Check className="w-4 h-4 shrink-0" />
              <span>Saved and sent as chat notification!</span>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 pt-2">
            {(initialMyNickname || initialPartnerNickname) && (
              <button
                type="button"
                onClick={handleResetBoth}
                disabled={saving}
                className="py-3 px-3.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-medium text-xs flex items-center space-x-1.5 transition disabled:opacity-50"
                title="Reset both nicknames"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset All</span>
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center space-x-2 transition active:scale-[0.98] disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Nicknames'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
