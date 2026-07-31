import { createClient as createAdminClient } from '@supabase/supabase-js';

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => unknown;
};

type PushClient = {
  from: (table: string) => unknown;
};

type PushQuery = {
  select: (columns?: string) => PushQuery;
  eq: (column: string, value: unknown) => PushQuery;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
  then: PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>['then'];
};

function hasError(value: unknown): value is { error: unknown } {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export async function sendNotification(
  supabase: SupabaseLike,
  input: {
    userId: string;
    type: string;
    message: string;
    actorId?: string | null;
    targetUrl?: string | null;
    pushTitle?: string;
    pushBody?: string;
  },
) {
  let notificationSaved = false;
  const payloadWithUrl = {
    target_user_id: input.userId,
    target_type: input.type,
    target_message: input.message,
    target_actor_id: input.actorId ?? null,
    target_url: input.targetUrl ?? null,
  };

  const withUrlRes = await supabase.rpc('push_notification', payloadWithUrl);
  if (hasError(withUrlRes) && !withUrlRes.error) {
    notificationSaved = true;
  } else {
    const legacyPayload = {
      target_user_id: input.userId,
      target_type: input.type,
      target_message: input.message,
      target_actor_id: input.actorId ?? null,
    };

    const legacyRes = await supabase.rpc('push_notification', legacyPayload);
    if (hasError(legacyRes) && !legacyRes.error) {
      notificationSaved = true;
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !projectUrl) {
    return;
  }

  const admin = createAdminClient(projectUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (notificationSaved) {
    await sendMobilePushNotification(admin, input);
    return;
  }

  const insertWithUrl = await admin.from('notifications').insert({
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    type: input.type,
    message: input.message,
    target_url: input.targetUrl ?? null,
  });

  if (!insertWithUrl.error) {
    await sendMobilePushNotification(admin, input);
    return;
  }

  const legacyInsert = await admin.from('notifications').insert({
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    type: input.type,
    message: input.message,
  });
  if (!legacyInsert.error) {
    await sendMobilePushNotification(admin, input);
  }
}

function preferenceColumnForType(type: string) {
  if (type === 'new_subscriber') return 'new_subscriber_push';
  if (type === 'new_comment') return 'new_comment_push';
  if (type === 'message_request') return 'message_requests_push';
  if (type === 'admin_message') return 'admin_messages_push';
  if (type === 'message') return 'messages_push';
  return null;
}

function defaultPushTitle(input: { type: string; message: string }) {
  if (input.type === 'new_subscriber') return 'You got a new subscriber';
  if (input.type === 'new_comment') return 'New Comment';
  if (input.type === 'message_request') return 'New message request';
  if (input.type === 'admin_message') return 'New message from ViewTube Admin';
  if (input.type === 'message') return 'New message';
  return 'ViewTube';
}

async function sendMobilePushNotification(
  admin: PushClient,
  input: {
    userId: string;
    type: string;
    message: string;
    targetUrl?: string | null;
    pushTitle?: string;
    pushBody?: string;
  },
) {
  const prefColumn = preferenceColumnForType(input.type);
  const prefsQuery = admin.from('notification_preferences') as PushQuery;
  const { data: prefs } = await prefsQuery
    .select('push_enabled,new_subscriber_push,new_comment_push,messages_push,message_requests_push,admin_messages_push')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (prefs?.push_enabled === false) return;
  if (prefColumn && prefs?.[prefColumn] === false) return;

  const tokensQuery = admin.from('mobile_push_tokens') as PushQuery;
  const { data: tokens } = await tokensQuery
    .select('id,expo_push_token')
    .eq('user_id', input.userId)
    .eq('enabled', true);

  const expoTokens = (tokens || [])
    .map((row) => String(row.expo_push_token || '').trim())
    .filter((token) => token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

  if (!expoTokens.length) return;

  const title = input.pushTitle || defaultPushTitle(input);
  const body = input.pushBody || input.message;
  const chunks: string[][] = [];
  for (let i = 0; i < expoTokens.length; i += 100) {
    chunks.push(expoTokens.slice(i, i + 100));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          chunk.map((to) => ({
            to,
            sound: 'default',
            title,
            body,
            data: {
              type: input.type,
              targetUrl: input.targetUrl || null,
            },
          })),
        ),
      });

      if (!response.ok) {
        console.error('Expo push send failed', await response.text().catch(() => response.statusText));
      }
    }),
  );
}
