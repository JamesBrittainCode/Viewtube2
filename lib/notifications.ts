import { createClient as createAdminClient } from '@supabase/supabase-js';

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => unknown;
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
  },
) {
  const payloadWithUrl = {
    target_user_id: input.userId,
    target_type: input.type,
    target_message: input.message,
    target_actor_id: input.actorId ?? null,
    target_url: input.targetUrl ?? null,
  };

  const withUrlRes = await supabase.rpc('push_notification', payloadWithUrl);
  if (hasError(withUrlRes) && !withUrlRes.error) return;

  const legacyPayload = {
    target_user_id: input.userId,
    target_type: input.type,
    target_message: input.message,
    target_actor_id: input.actorId ?? null,
  };

  const legacyRes = await supabase.rpc('push_notification', legacyPayload);
  if (hasError(legacyRes) && !legacyRes.error) return;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !projectUrl) {
    return;
  }

  const admin = createAdminClient(projectUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const insertWithUrl = await admin.from('notifications').insert({
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    type: input.type,
    message: input.message,
    target_url: input.targetUrl ?? null,
  });

  if (!insertWithUrl.error) return;

  await admin.from('notifications').insert({
    user_id: input.userId,
    actor_id: input.actorId ?? null,
    type: input.type,
    message: input.message,
  });
}
