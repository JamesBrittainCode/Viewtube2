export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  subscribers_count: number;
  created_at: string;
};

export type Video = {
  id: string;
  user_id: string;
  title: string;
  description: string;
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
  created_at: string;
  profile?: Pick<Profile, 'username' | 'avatar_url'>;
  replies?: Comment[];
};
