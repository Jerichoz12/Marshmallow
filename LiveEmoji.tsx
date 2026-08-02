import React from 'react';
import { ThumbsUp } from 'lucide-react';

interface LiveEmojiProps {
  emoji: string;
  className?: string;
}

export const LiveEmoji: React.FC<LiveEmojiProps> = ({ emoji, className = '' }) => {
  let animClass = 'animate-live-emoji';

  if (['❤️', '💖', '🥰', '💕', '💗', '💓', '😍'].includes(emoji)) {
    animClass = 'animate-heartbeat-emoji';
  } else if (['😂', '😆', '😮', '😲', '😢', '😭', '😡', '🔥', '✨'].includes(emoji)) {
    animClass = 'animate-wiggle-emoji';
  }

  if (emoji === '👍') {
    return (
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0866FF] text-white p-0.5 align-middle shadow-sm ${animClass} ${className}`}>
        <ThumbsUp className="w-3 h-3 fill-white text-white" />
      </span>
    );
  }

  return (
    <span className={`inline-block transform-gpu transition-transform ${animClass} ${className}`}>
      {emoji}
    </span>
  );
};
