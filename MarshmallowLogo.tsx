import React from 'react';

interface MarshmallowLogoProps {
  size?: number | string;
  className?: string;
  animated?: boolean;
}

export const MarshmallowLogo: React.FC<MarshmallowLogoProps> = ({
  size = 40,
  className = '',
  animated = false
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 ${animated ? 'hover:scale-105 transition-transform duration-300' : ''} ${className}`}
    >
      {/* Facebook Blue Circle */}
      <circle cx="50" cy="50" r="50" fill="#0866FF" />

      {/* Crisp White 'M' (Capital M) logo inside blue circle */}
      <path
        d="M28 72 V28 H38 L50 54 L62 28 H72 V72 H62 V44 L52 66 H48 L38 44 V72 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
};
