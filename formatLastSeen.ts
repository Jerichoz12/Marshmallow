export function formatLastSeen(status?: string, lastSeenAt?: string | Date | null): string {
  if (status === 'online') {
    return 'Online now';
  }

  if (!lastSeenAt) {
    return 'Offline';
  }

  const date = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt;
  if (isNaN(date.getTime())) {
    return 'Offline';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) {
    return 'Last online just now';
  }

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `Last online ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `Last online ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `Last online ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return `Last online ${dateStr}`;
}
