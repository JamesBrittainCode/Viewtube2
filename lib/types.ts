export type Profile = {
  id: string;
  username: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  verified: boolean;
  suspended?: boolean;
  suspension_reason?: string | null;
  suspended_at?: string | null;
  moderation_strikes?: number;
  subscribers_count: number;
  created_at: string;
};

export type Video = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  comments_enabled?: boolean;
  thumbnail_url: string | null;
  video_url: string;
  tags: string[];
  views: number;
  created_at: string;
  profile?: Profile;
};

export type Comment = {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  pinned?: boolean;
  likes_count?: number;
  liked_by_me?: boolean;
  created_at: string;
  profile?: Pick<Profile, 'username' | 'handle' | 'avatar_url' | 'verified'>;
  replies?: Comment[];
};
