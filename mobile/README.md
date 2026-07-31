# ViewTube Mobile (iOS first)

This is the Expo React Native app for ViewTube. It uses the same Supabase project as the web app, so accounts, feeds, notifications, messages, and settings stay synced.

## 1. Local setup

```bash
cd mobile
cp .env.example .env
npm install
npm run start
```

Fill in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://fqcrxfplxtanefldejtr.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_VIEWTUBE_WEB_URL=https://viewtube.tv
```

## 2. Supabase setup

Run this SQL patch in Supabase before testing mobile push/settings:

```sql
-- from the repo root:
-- supabase/mobile_push_notifications_patch.sql
```

The patch creates:

- `mobile_push_tokens` for Expo push tokens.
- `notification_preferences` for user-managed push settings.
- RLS policies so users only manage their own settings/tokens.

## 3. Push notifications

The app registers an Expo push token from Settings. The web backend sends Expo pushes from `lib/notifications.ts` whenever ViewTube creates notifications.

Supported push types:

- New subscriber: title `You got a new subscriber`
- New comment: title `New Comment from @[username]`, body is the comment text
- Admin messages
- Direct messages
- Message requests

For production iOS push:

1. Create or log in to an Expo account.
2. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```
3. In `mobile/`, run:
   ```bash
   eas login
   eas init
   ```
4. Copy the generated EAS project id into `mobile/app.json` under `expo.extra.eas.projectId`.
5. Let EAS manage Apple push credentials during your first iOS build.

## 4. Test on iPhone

Development build:

```bash
cd mobile
eas build --profile development --platform ios
```

Install the build on your iPhone from the EAS link, then run:

```bash
npm run start
```

## 5. Prepare App Store assets

In Apple Developer / App Store Connect, prepare:

- App name: `ViewTube`
- Bundle ID: `tv.viewtube.app`
- Privacy policy URL: `https://viewtube.tv/privacy`
- Support URL: `https://viewtube.tv/support`
- Category: Entertainment or Photo & Video
- Age rating: answer honestly based on user-generated videos/messages
- Screenshots: iPhone 6.7", 6.5", and 5.5" sizes
- App icon: 1024x1024 PNG, no transparency

## 6. Build for App Store

```bash
cd mobile
eas build --profile production --platform ios
```

When the build completes, submit:

```bash
eas submit --platform ios
```

EAS will ask for App Store Connect credentials or an API key.

## 7. App Store review checklist

Before submitting:

- Confirm sign-in/sign-up works on the production Supabase project.
- Confirm Settings can enable push notifications.
- Confirm each push toggle updates `notification_preferences`.
- Confirm new subscribers/comments/messages generate push notifications.
- Confirm user-generated content reporting/moderation is available on web.
- Confirm privacy policy mentions mobile push tokens, messaging, user-generated content, parental controls, and moderation.

## 8. Current app scope

Implemented now:

- Supabase auth
- Home video feed
- Shorts shell
- Video detail screen
- Notifications feed
- Messages inbox/replies
- Push notification registration
- User-managed notification settings

Good next iOS milestones:

- Native video playback controls
- Upload flow from iPhone camera roll
- Comments/likes on the watch screen
- Better Shorts playback UI
- Deep links from notifications into videos/messages
