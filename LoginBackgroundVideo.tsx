import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Heart, Video, Users, Smile, ShieldCheck } from 'lucide-react';

// Commercial promo video clips representing children, elderly, families, & friends enjoying Marshmallow
const COMMERCIAL_CLIPS = [
  {
    id: 'family-call',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-happy-family-having-a-video-call-on-a-smartphone-41484-large.mp4',
    poster: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1080&q=80',
    tagline: 'Connecting Families Across Generations',
    label: 'Grandma & Kids Video Call'
  },
  {
    id: 'kids-enjoy',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-children-looking-at-a-smartphone-smiling-41228-large.mp4',
    poster: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1080&q=80',
    tagline: 'Fun & Safe for Kids',
    label: 'Marshmallow Kids Chat'
  },
  {
    id: 'senior-smile',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-senior-woman-holding-a-smartphone-and-smiling-41131-large.mp4',
    poster: 'https://images.unsplash.com/photo-1581579438747-1dc8d1e2729f?auto=format&fit=crop&w=1080&q=80',
    tagline: 'Easy & Accessible for Everyone',
    label: 'Grandmother connected'
  },
  {
    id: 'friends-laughing',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-friends-taking-a-selfie-with-a-smartphone-41470-large.mp4',
    poster: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1080&q=80',
    tagline: 'Share Every Special Moment',
    label: 'Group Photo & Stories'
  }
];

export const LoginBackgroundVideo: React.FC = () => {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Auto rotate commercial scenes every 8 seconds when tab is visible
  useEffect(() => {
    let timer: any;

    const startRotation = () => {
      timer = setInterval(() => {
        if (!document.hidden) {
          setCurrentClipIndex((prev) => (prev + 1) % COMMERCIAL_CLIPS.length);
        }
      }, 8000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInterval(timer);
        if (videoRef.current) {
          videoRef.current.pause();
        }
      } else {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
        startRotation();
      }
    };

    startRotation();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const activeClip = COMMERCIAL_CLIPS[currentClipIndex];

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0 bg-slate-950">
      {/* 1. Commercial Portrait Background Video - Increased clarity */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeClip.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 0.75, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 w-full h-full"
        >
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            poster={activeClip.poster}
            className="w-full h-full object-cover object-center"
          >
            <source src={activeClip.videoUrl} type="video/mp4" />
          </video>
        </motion.div>
      </AnimatePresence>

      {/* 2. Minimal Gradient Overlays to keep video clearly visible */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 z-0 pointer-events-none" />

      {/* Marshmallow Brand Subtle Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* 3. Very Minimal Commercial Floating Promo Badges */}
      <div className="absolute inset-0 w-full h-full max-w-md mx-auto flex items-center justify-center pointer-events-none">
        {/* Top Floating Badge: Minimal Tagline Banner */}
        <motion.div
          key={`tagline-${activeClip.id}`}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute top-[4%] sm:top-[6%] bg-slate-950/60 backdrop-blur-sm border border-pink-500/20 px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1.5 text-slate-100"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-[10px] font-semibold tracking-wide text-pink-200/90">
            {activeClip.tagline}
          </span>
        </motion.div>

        {/* Floating Minimal Heart Reaction */}
        <motion.div
          animate={{
            y: [-8, 8, -8],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-[14%] left-[4%] bg-pink-500/15 backdrop-blur-sm border border-pink-500/25 p-1.5 rounded-full shadow-sm text-pink-400 flex items-center justify-center"
        >
          <Heart className="w-3.5 h-3.5 fill-pink-500/80 text-pink-400" />
        </motion.div>

        {/* Commercial Minimal Callout: HD Video Call Badge */}
        <motion.div
          animate={{
            y: [6, -6, 6],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.4,
          }}
          className="absolute top-[16%] right-[4%] bg-slate-950/60 backdrop-blur-sm border border-purple-500/20 px-2 py-1 rounded-xl shadow-md flex items-center space-x-1.5"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
            <Video className="w-2.5 h-2.5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold text-slate-200 leading-tight">Marshmallow Video</p>
            <p className="text-[8px] text-pink-400/90 leading-tight">HD Quality</p>
          </div>
        </motion.div>

        {/* Minimal Community Badge */}
        <motion.div
          animate={{
            y: [-6, 6, -6],
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.8,
          }}
          className="absolute bottom-[14%] left-[4%] bg-slate-950/60 backdrop-blur-sm border border-slate-800/80 px-2 py-1 rounded-xl shadow-md flex items-center space-x-1.5"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-white shrink-0">
            <Users className="w-2.5 h-2.5" />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-bold text-slate-200 leading-tight">For Everyone</p>
            <p className="text-[8px] text-slate-400 leading-tight">Kids & Seniors</p>
          </div>
        </motion.div>

        {/* Minimal Smile Reaction */}
        <motion.div
          animate={{
            y: [6, -8, 6],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1.2,
          }}
          className="absolute bottom-[12%] right-[4%] bg-purple-500/15 backdrop-blur-sm border border-purple-500/25 px-2 py-1 rounded-xl shadow-sm text-purple-300 flex items-center space-x-1"
        >
          <Smile className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
          <span className="text-[8px] font-semibold text-slate-200">Easy & Fun</span>
        </motion.div>

        {/* Commercial Scene Indicator Dots */}
        <div className="absolute bottom-[2%] flex items-center space-x-1 bg-slate-950/50 backdrop-blur-sm px-2 py-1 rounded-full border border-slate-800/60">
          <ShieldCheck className="w-3 h-3 text-pink-400 mr-0.5" />
          {COMMERCIAL_CLIPS.map((clip, idx) => (
            <div
              key={clip.id}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentClipIndex ? 'w-3.5 bg-pink-500' : 'w-1 bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 4. Subtle Dark Overlay for 100% Login Form Readability */}
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px] pointer-events-none z-0" />
    </div>
  );
};

