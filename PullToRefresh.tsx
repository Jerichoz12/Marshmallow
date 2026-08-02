import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { playTouchSound } from '../utils/audioSound';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  children: React.ReactNode;
  pullThreshold?: number;
  maxPull?: number;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  isRefreshing,
  children,
  pullThreshold = 65,
  maxPull = 90,
  className = ''
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isRefreshing) {
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const handleStart = (clientY: number) => {
    const container = containerRef.current;
    if (!container) return;

    // Find closest scrollable parent or check container scrollTop
    const parentScrollTop = container.parentElement?.scrollTop ?? 0;
    const selfScrollTop = container.scrollTop ?? 0;

    if (parentScrollTop <= 2 && selfScrollTop <= 2) {
      startYRef.current = clientY;
      isDraggingRef.current = true;
    }
  };

  const handleMove = (clientY: number) => {
    if (!isDraggingRef.current || isRefreshing) return;
    const container = containerRef.current;
    if (!container) return;

    const parentScrollTop = container.parentElement?.scrollTop ?? 0;
    const selfScrollTop = container.scrollTop ?? 0;

    if (parentScrollTop > 5 || selfScrollTop > 5) {
      isDraggingRef.current = false;
      setPullDistance(0);
      return;
    }

    const deltaY = clientY - startYRef.current;
    if (deltaY > 0) {
      const distance = Math.min(maxPull, deltaY * 0.45);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleEnd = async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      playTouchSound();
      try {
        await onRefresh();
      } catch (err) {
        console.error('Pull to refresh error:', err);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Mouse handlers for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      handleStart(e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientY);
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      handleEnd();
    }
  };

  const currentHeight = isRefreshing ? 48 : pullDistance;
  const progress = Math.min(1, pullDistance / pullThreshold);
  const rotation = progress * 180;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full ${className}`}
    >
      {/* Pull To Refresh Visual Indicator Banner */}
      {(currentHeight > 0 || isRefreshing) && (
        <div
          className="w-full flex items-center justify-center overflow-hidden transition-all duration-100 ease-out select-none bg-[#242526] border-b border-[#3A3B3C] rounded-2xl mb-2"
          style={{ height: `${currentHeight}px` }}
        >
          <div className="flex items-center space-x-2 text-xs font-bold text-[#B0B3B8]">
            {isRefreshing ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span className="text-white">Fetching fresh posts...</span>
              </>
            ) : (
              <>
                <div
                  className="transition-transform duration-100"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <ArrowDown className={`w-4 h-4 ${pullDistance >= pullThreshold ? 'text-emerald-400' : 'text-[#B0B3B8]'}`} />
                </div>
                <span className={pullDistance >= pullThreshold ? 'text-emerald-400 font-extrabold' : 'text-[#B0B3B8]'}>
                  {pullDistance >= pullThreshold ? 'Release to refresh' : 'Pull down to refresh'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
