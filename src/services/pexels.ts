const PEXELS_API_KEY = 'yTgKKh0TPz5gnmidM8ylaPIsIkY5ZNfxwoewMYXDbyUt5ZnenaIUwy5r';

export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string | null;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

export interface PexelsPhotosResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
}

export interface PexelsVideoFile {
  id: number;
  quality: 'hd' | 'sd' | 'hls' | string;
  file_type: string;
  width: number | null;
  height: number | null;
  fps?: number;
  link: string;
}

export interface PexelsVideoPicture {
  id: number;
  picture: string;
  nr: number;
}

export interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: {
    id: number;
    name: string;
    url: string;
  };
  video_files: PexelsVideoFile[];
  video_pictures: PexelsVideoPicture[];
}

export interface PexelsVideosResponse {
  page: number;
  per_page: number;
  total_results: number;
  url: string;
  videos: PexelsVideo[];
  next_page?: string;
}

// In-memory simple cache
const photosCache = new Map<string, PexelsPhotosResponse>();
const videosCache = new Map<string, PexelsVideosResponse>();

const RANDOM_PHOTO_TOPICS = ['aesthetic', 'portrait', 'vertical nature', 'city life', 'fashion', 'lifestyle', 'street', 'travel', 'mood', 'architecture', 'people'];
const RANDOM_VIDEO_TOPICS = ['vertical video', 'portrait nature', 'city aesthetic', 'travel reel', 'lifestyle portrait', 'ocean waves', 'urban reel', 'aesthetic loop'];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function fetchPexelsPhotos(query?: string, page: number = 1, perPage: number = 20): Promise<PexelsPhotosResponse> {
  let cleanQuery = query?.trim() || '';
  
  // If query is empty or 'All', pick a random topic when page is 1 or user refreshes
  if (!cleanQuery || cleanQuery.toLowerCase() === 'all') {
    cleanQuery = getRandomItem(RANDOM_PHOTO_TOPICS);
  }

  const cacheKey = `photos:${cleanQuery}:${page}:${perPage}`;

  if (photosCache.has(cacheKey)) {
    return photosCache.get(cacheKey)!;
  }

  const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(cleanQuery)}&orientation=portrait&page=${page}&per_page=${perPage}`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: PEXELS_API_KEY
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Pexels API error (${res.status}): ${errorText || 'Failed to fetch photos'}`);
  }

  const data: PexelsPhotosResponse = await res.json();
  
  // Prioritize portrait orientation photos (height > width)
  if (data.photos && data.photos.length > 0) {
    data.photos.sort((a, b) => {
      const aIsPortrait = a.height > a.width ? 1 : 0;
      const bIsPortrait = b.height > b.width ? 1 : 0;
      return bIsPortrait - aIsPortrait;
    });
  }

  photosCache.set(cacheKey, data);
  return data;
}

export async function fetchPexelsVideos(query?: string, page: number = 1, perPage: number = 15): Promise<PexelsVideosResponse> {
  let cleanQuery = query?.trim() || '';
  
  // If query is empty or 'Popular', pick a random topic
  if (!cleanQuery || cleanQuery.toLowerCase() === 'popular') {
    cleanQuery = getRandomItem(RANDOM_VIDEO_TOPICS);
  }

  const cacheKey = `videos:${cleanQuery}:${page}:${perPage}`;

  if (videosCache.has(cacheKey)) {
    return videosCache.get(cacheKey)!;
  }

  const endpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(cleanQuery)}&orientation=portrait&page=${page}&per_page=${perPage}`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: PEXELS_API_KEY
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Pexels API error (${res.status}): ${errorText || 'Failed to fetch videos'}`);
  }

  const data: PexelsVideosResponse = await res.json();
  
  // Prioritize portrait orientation videos (height > width)
  if (data.videos && data.videos.length > 0) {
    data.videos.sort((a, b) => {
      const aIsPortrait = a.height > a.width ? 1 : 0;
      const bIsPortrait = b.height > b.width ? 1 : 0;
      return bIsPortrait - aIsPortrait;
    });
  }

  videosCache.set(cacheKey, data);
  return data;
}

/**
 * Helper to pick the best video file link for mobile streaming
 */
export function getBestVideoFile(video: PexelsVideo): PexelsVideoFile | null {
  if (!video.video_files || video.video_files.length === 0) return null;
  // Prefer sd mp4 for fast mobile loading, fallback to hd mp4, then any
  const sdMp4 = video.video_files.find(f => f.quality === 'sd' && f.file_type === 'video/mp4');
  if (sdMp4) return sdMp4;

  const hdMp4 = video.video_files.find(f => f.quality === 'hd' && f.file_type === 'video/mp4');
  if (hdMp4) return hdMp4;

  const anyMp4 = video.video_files.find(f => f.file_type === 'video/mp4');
  if (anyMp4) return anyMp4;

  return video.video_files[0];
}
