import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MarshmallowLogo } from './MarshmallowLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setShowText(true);
    }, 400);

    const timer2 = setTimeout(() => {
      onComplete();
    }, 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#18191A] text-white overflow-hidden select-none"
    >
      {/* Facebook Blue Circle Logo */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex items-center justify-center mb-6"
      >
        <MarshmallowLogo size={100} animated />
      </motion.div>

      {/* Clean White "marshmallow" text logo */}
      {showText && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center"
        >
          <h1 className="text-3xl font-black text-white tracking-tight font-sans">
            marshmallow
          </h1>
          <p className="text-xs text-[#B0B3B8] font-bold tracking-widest mt-2 uppercase">
            by EchoPH
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};
