import React, { useState } from 'react';
import { X, Check, Search, Shield, Crown, Eye } from 'lucide-react';
import { BORDER_DESIGNS, BorderDesign, RARITY_CONFIG, getBorderDesign } from '../utils/avatarBorders';
import { UserAvatar } from './UserAvatar';
import { playTouchSound } from '../utils/audioSound';

interface BorderSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  nickname: string;
  avatarUrl?: string;
  currentBorderId: number;
  onSelectBorder: (borderId: number) => void;
}

export const BorderSelectorModal: React.FC<BorderSelectorModalProps> = ({
  isOpen,
  onClose,
  userId,
  username,
  nickname,
  avatarUrl,
  currentBorderId,
  onSelectBorder
}) => {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredBorders = BORDER_DESIGNS.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeDesign = getBorderDesign(currentBorderId, userId || username);
  const activeRarity = RARITY_CONFIG[activeDesign.rarity] || RARITY_CONFIG.Common;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-lg animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500 via-purple-500 to-slate-700 rounded-2xl shadow-lg text-white">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight flex items-center gap-2">
                <span>Profile Frame Armory</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  2 Exclusive Frames
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Quantum Void Weaver & Slate Gray Bevel
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              playTouchSound();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Preview Box */}
        <div className="p-4 bg-gradient-to-b from-slate-950 to-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <UserAvatar
              userId={userId}
              borderId={currentBorderId}
              src={avatarUrl}
              username={username}
              nickname={nickname}
              size="2xl"
              showRarityBadge
              showStatus
              status="online"
            />
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${activeRarity.badgeBg}`}>
                  {activeDesign.rarity}
                </span>
                <span className="text-[10px] font-mono text-slate-500 font-bold">
                  ID #{activeDesign.id}
                </span>
              </div>
              <h3 className="font-black text-white text-base leading-tight">
                {activeDesign.name}
              </h3>
              <p className="text-xs text-slate-400 font-medium capitalize mt-0.5">
                Theme: <span className="text-cyan-300 font-bold">{activeDesign.theme.replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">60 FPS Render</div>
            <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 justify-end mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Vector SVG Frame</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/90">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search frames..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>

        {/* Frames Grid */}
        <div className="p-4 grid grid-cols-2 gap-4 bg-slate-950/60">
          {filteredBorders.map((design) => {
            const isSelected = activeDesign.id === design.id;
            const rarityConf = RARITY_CONFIG[design.rarity] || RARITY_CONFIG.Common;

            return (
              <div
                key={design.id}
                onClick={() => {
                  playTouchSound();
                  onSelectBorder(design.id);
                }}
                className={`relative p-4 rounded-2xl border transition duration-200 flex flex-col items-center justify-between text-center cursor-pointer group ${
                  isSelected
                    ? 'bg-gradient-to-b from-cyan-500/20 via-purple-500/10 to-slate-900 border-cyan-500 shadow-xl shadow-cyan-500/10 scale-[1.02]'
                    : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900 hover:scale-[1.01]'
                }`}
              >
                {/* Active Checkmark */}
                {isSelected && (
                  <span className="absolute top-2.5 right-2.5 bg-cyan-500 text-slate-950 p-1 rounded-full shadow-md z-30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}

                {/* Avatar Display */}
                <div className="my-2 py-1">
                  <UserAvatar
                    userId={userId}
                    borderId={design.id}
                    src={avatarUrl}
                    username={username}
                    nickname={nickname}
                    size="xl"
                  />
                </div>

                {/* Details */}
                <div className="w-full mt-1">
                  <div className="flex items-center justify-center space-x-1 mb-1">
                    <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider border ${rarityConf.badgeBg}`}>
                      {design.rarity}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white line-clamp-1 group-hover:text-cyan-300 transition">
                    {design.name}
                  </h4>
                  <span className="inline-block mt-1 text-[9px] font-bold text-slate-400 capitalize">
                    {design.theme.replace('_', ' ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Equipped: <span className="text-cyan-300 font-extrabold">{activeDesign.name}</span>
          </div>
          <button
            onClick={() => {
              playTouchSound();
              onClose();
            }}
            className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-95 text-white font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            Equip & Save Frame
          </button>
        </div>
      </div>
    </div>
  );
};
