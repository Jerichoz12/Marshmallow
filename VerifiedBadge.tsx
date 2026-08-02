import React from 'react';

export const DEVELOPER_CODES = ['143456', '547257', '537212'];

export function isDeveloperUser(
  user?: { id?: string; username?: string; codeNumber?: string } | string | null
): boolean {
  if (!user) return false;
  if (typeof user === 'string') {
    const clean = user.trim().replace(/^#/, '').toLowerCase();
    return DEVELOPER_CODES.some(
      (code) => clean === code || clean === `dev_${code}` || clean === `user_${code}`
    );
  }
  const cleanUsername = (user.username || '').trim().replace(/^#/, '').toLowerCase();
  const cleanId = (user.id || '').trim().replace(/^#/, '').toLowerCase();
  const cleanCode = (user.codeNumber || '').trim().replace(/^#/, '').toLowerCase();

  return DEVELOPER_CODES.some(
    (code) =>
      cleanUsername === code ||
      cleanId === code ||
      cleanCode === code ||
      cleanUsername === `dev_${code}` ||
      cleanId === `dev_${code}` ||
      cleanId.endsWith(`code_${code}`)
  );
}

export function shouldHideHandle(
  user?: { id?: string; username?: string; codeNumber?: string } | string | null
): boolean {
  if (!user) return false;
  const usernameStr = typeof user === 'string' ? user : (user.username || user.id || '');
  const clean = usernameStr.trim().replace(/^#/, '').toLowerCase();
  if (
    clean === '143456' ||
    clean === '547257' ||
    clean === '537212' ||
    clean.includes('143456') ||
    clean.includes('547257') ||
    clean.includes('537212') ||
    clean === 'official_dev' ||
    clean === 'official admin'
  ) {
    return true;
  }
  return isDeveloperUser(user);
}

interface VerifiedBadgeProps {
  className?: string;
  title?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  className = 'w-4 h-4 text-sky-500',
  title = 'Developer Verified'
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 align-middle text-sky-500 select-none ${className}`}
      title={title}
    >
      <svg className="w-full h-full fill-current drop-shadow-sm" viewBox="0 0 24 24">
        <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.6 9.55.725 10.92.725 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238 1.05 1.273 2.42 2.148 4 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-1.05 2.148-2.42 2.148-4zM10.09 16.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
      </svg>
    </span>
  );
};
