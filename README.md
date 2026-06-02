# ViewTube

ViewTube is a full-stack, production-ready video-sharing platform built from scratch with:

- Next.js 15 (App Router) + TypeScript
- TailwindCSS
- Supabase (Auth, Postgres, Storage, Realtime)
- Vercel deployment target

## Features

- Email/password auth + optional Google OAuth
- Protected routes and persistent sessions
- User profiles linked to Supabase `auth.users`
- Avatar uploads (Supabase Storage)
- Video upload pipeline with thumbnail + tags
- `/watch/[id]` playback page with:
  - HTML5 video player
  - Session-based view increments
  - Like toggle
  - Nested comments with realtime updates
  - Subscribe toggle
- YouTube-like homepage with sticky navbar + left sidebar + responsive grid
- Full-text search over title/description/tags
- Channel pages with subscriber count and uploads
- Subscriptions feed
- Trending page (last 24h by views)
- Tag-based video recommendations
- Notifications table (new subscriber events)
- Admin controls for `jesuslearningclub@gmail.com` to set channel `subscribers_count` and `verified` status
- Skeleton loading states and dark mode

## Project structure

```txt
app/
  api/
    profile/
    subscriptions/[creatorId]/
    videos/upload/
    videos/[id]/view/
    videos/[id]/like/
    videos/[id]/comments/
  auth/callback/
  channel/[username]/
  library/
  profile/
  search/
  sign-in/
  sign-up/
  subscriptions/
  trending/
  upload/
  watch/[id]/
components/
lib/
  supabase/
supabase/
  schema.sql
```

## 1) Supabase setup

1. Create a new Supabase project.
2. In Supabase SQL Editor, run [`supabase/schema.sql`](/Users/jamesbrittain/Downloads/VsCodeFiles/Viewtube/supabase/schema.sql).
   - If your project already has the base schema, run [`supabase/admin_feature_patch.sql`](/Users/jamesbrittain/Downloads/VsCodeFiles/Viewtube/supabase/admin_feature_patch.sql) instead for admin/verified updates.
3. In **Authentication > Providers**:
   - Enable Email provider.
   - Optional: Enable Google provider and set redirect URL:
     - `https://YOUR_DOMAIN/auth/callback`
4. In **Authentication > URL Configuration**:
   - Site URL: your local/dev URL and production URL.
   - Additional redirect URLs include:
     - `http://localhost:3000/auth/callback`
     - `https://YOUR_DOMAIN/auth/callback`
5. Realtime:
   - Ensure `comments` and `profiles` tables are included in replication (Database > Replication).

## 2) Environment variables

Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional ads variables:

- AdSense:
  - `NEXT_PUBLIC_ADSENSE_CLIENT_ID`
  - `NEXT_PUBLIC_ADSENSE_HOME_SLOT`
  - `NEXT_PUBLIC_ADSENSE_REWARD_SLOT`

## 3) Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4) Deploy to Vercel

1. Push repository to GitHub/GitLab/Bitbucket.
2. Import the repo in Vercel.
3. Set environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. Add production URL to Supabase Auth redirect settings.

## Security and RLS

RLS is enabled for all primary tables with policies enforcing:

- Users can edit/delete only their own content.
- Auth required for uploads and mutations.
- Public read access for videos/profiles/comments/likes/subscriptions.
- Storage object permissions scoped by owner folder (`auth.uid()`).

## Performance notes

- Cached homepage feed with `unstable_cache` and revalidation.
- `next/image` for thumbnails/avatars.
- Paginated homepage feed.
- Edge runtime on read-heavy pages and most API handlers.
- Upload route uses Node runtime for safer file upload handling.

## Production checklist

- Configure Supabase Auth (Email + optional Google)
- Run schema SQL
- Configure environment variables in Vercel
- Validate storage buckets and policies
- Verify OAuth callback URLs in Supabase
