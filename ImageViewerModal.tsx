import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { playTouchSound } from '../utils/audioSound';

interface ImageViewerModalProps {
  isOpen?: boolean;
  imageUrl?: string | null;
  imagesList?: string[];
  initialIndex?: number;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen = true,
  imageUrl,
  imagesList: propImagesList,
  initialIndex: propInitialIndex = 0,
  onClose
}) => {
  // Parse gallery structure if imageUrl contains JSON or fallback to single image
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    if (propImagesList && propImagesList.length > 0) {
      setGalleryImages(propImagesList);
      setCurrentIndex(Math.min(Math.max(0, propInitialIndex), propImagesList.length - 1));
      return;
    }

    if (imageUrl) {
      if (imageUrl.trim().startsWith('{') && imageUrl.includes('images')) {
        try {
          const parsed = JSON.parse(imageUrl);
          if (Array.isArray(parsed.images) && parsed.images.length > 0) {
            setGalleryImages(parsed.images);
            setCurrentIndex(parsed.initialIndex || 0);
            return;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      setGalleryImages([imageUrl]);
      setCurrentIndex(0);
    }
  }, [imageUrl, propImagesList, propInitialIndex]);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);

  // Reset zoom on photo change
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const currentPhotoUrl = galleryImages[currentIndex] || imageUrl || '';

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, galleryImages, currentIndex]);

  if (!isOpen || !currentPhotoUrl) return null;

  const handleNextPhoto = () => {
    if (galleryImages.length <= 1) return;
    playTouchSound();
    setCurrentIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const handlePrevPhoto = () => {
    if (galleryImages.length <= 1) return;
    playTouchSound();
    setCurrentIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleZoomIn = () => {
    playTouchSound();
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    playTouchSound();
    setScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    playTouchSound();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = async () => {
    playTouchSound();
    try {
      if (currentPhotoUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = currentPhotoUrl;
        link.download = `marshmallow-photo-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(currentPhotoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `marshmallow-photo-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download error:', err);
      const link = document.createElement('a');
      link.href = currentPhotoUrl;
      link.target = '_blank';
      link.download = `marshmallow-photo-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Mouse Drag to Pan when Zoomed
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || scale <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: posStartRef.current.x + dx,
      y: posStartRef.current.y + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile pan, pinch-to-zoom & swipe gallery
  const getPinchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      initialPinchDistanceRef.current = getPinchDistance(e.touches);
    } else if (e.touches.length === 1) {
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now()
      };
      if (scale > 1) {
        setIsDragging(true);
        dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        posStartRef.current = { ...position };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      const newDist = getPinchDistance(e.touches);
      const factor = newDist / initialPinchDistanceRef.current;
      setScale(prev => {
        const next = Math.min(Math.max(prev * (factor > 1 ? 1.05 : 0.95), 1), 4);
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
      initialPinchDistanceRef.current = newDist;
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: posStartRef.current.x + dx,
        y: posStartRef.current.y + dy
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false);
    initialPinchDistanceRef.current = null;

    // Detect horizontal swipe if scale === 1
    if (scale <= 1 && touchStartPosRef.current && galleryImages.length > 1) {
      const touchEnd = e.changedTouches[0];
      if (touchEnd) {
        const dx = touchEnd.clientX - touchStartPosRef.current.x;
        const dy = touchEnd.clientY - touchStartPosRef.current.y;
        const dt = Date.now() - touchStartPosRef.current.time;

        if (dt < 400 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) {
            handleNextPhoto();
          } else {
            handlePrevPhoto();
          }
        }
      }
    }
    touchStartPosRef.current = null;
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 backdrop-blur-2xl select-none"
        onMouseUp={handleMouseUp}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Bar Controls */}
        <div className="p-4 flex items-center justify-between z-10 bg-gradient-to-b from-slate-950/80 to-transparent">
          <div className="flex items-center space-x-2 text-slate-300 text-xs font-bold">
            <Maximize2 className="w-4 h-4 text-pink-400" />
            <span>Marshmallow Photo Viewer</span>
            {galleryImages.length > 1 && (
              <span className="text-[11px] font-mono text-pink-300 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                {currentIndex + 1} / {galleryImages.length}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white transition shadow-lg flex items-center space-x-1.5 text-xs font-bold px-3"
              title="Save/Download Image"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Save Photo</span>
            </button>

            <button
              onClick={() => {
                playTouchSound();
                onClose();
              }}
              className="p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition shadow-lg"
              title="Close Viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Main Image Canvas */}
        <div
          className="flex-1 flex items-center justify-center overflow-hidden relative cursor-grab active:cursor-grabbing p-2"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
        >
          {/* Gallery Prev Button */}
          {galleryImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevPhoto();
              }}
              className="absolute left-3 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white shadow-2xl transition hover:scale-110 active:scale-95"
              title="Previous Photo"
            >
              <ChevronLeft className="w-6 h-6 text-pink-400" />
            </button>
          )}

          <motion.img
            key={currentPhotoUrl}
            initial={{ opacity: 0.8, scale: 0.98 }}
            animate={{ opacity: 1, scale }}
            transition={{ duration: 0.15 }}
            src={currentPhotoUrl}
            alt="Full view"
            draggable={false}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out'
            }}
            className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl shadow-2xl pointer-events-auto"
          />

          {/* Gallery Next Button */}
          {galleryImages.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNextPhoto();
              }}
              className="absolute right-3 z-20 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-white shadow-2xl transition hover:scale-110 active:scale-95"
              title="Next Photo"
            >
              <ChevronRight className="w-6 h-6 text-pink-400" />
            </button>
          )}
        </div>

        {/* Bottom Floating Control Toolbar */}
        <div className="p-4 flex justify-center z-10 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent">
          <div className="flex items-center space-x-3 bg-slate-900/90 border border-slate-800 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-800 rounded-xl transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>

            <span className="text-xs font-mono font-bold text-pink-400 min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 4}
              className="p-2 text-slate-300 hover:text-white disabled:opacity-40 hover:bg-slate-800 rounded-xl transition"
              title="Zoom In"
            >
              <ZoomIn className="w-5 h-5" />
            </button>

            <div className="w-[1px] h-5 bg-slate-800 mx-1" />

            <button
              onClick={handleResetZoom}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition flex items-center space-x-1 text-xs font-semibold"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
};
