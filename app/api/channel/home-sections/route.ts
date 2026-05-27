import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

type SectionInput = {
  id?: string;
  section_type: string;
  position: number;
  config?: unknown;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toSafeConfig(config: unknown) {
  if (!config || typeof config !== 'object') return {};
  // Only allow plain JSON-ish objects.
  return config as Record<string, unknown>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId')?.trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const targetId = userId || user?.id || null;
  if (!targetId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('channel_home_sections')
    .select('id,user_id,section_type,config,position,updated_at')
    .eq('user_id', targetId)
    .order('position', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    const msg = error.message || 'Failed to load sections.';
    if (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('channel_home_sections')) {
      return NextResponse.json(
        {
          error:
            'Channel customization database tables are missing. Run the Supabase SQL patch: supabase/channel_home_customization_patch.sql',
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({ sections: data || [] });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sections?: unknown };
  const incoming = Array.isArray(body.sections) ? (body.sections as SectionInput[]) : [];
  if (incoming.length > 12) return NextResponse.json({ error: 'Max 12 sections.' }, { status: 400 });

  const normalized = incoming
    .map((s, idx) => ({
      id: readString(s.id) || undefined,
      user_id: user.id,
      section_type: readString(s.section_type) || 'videos',
      position: Number.isFinite(Number(s.position)) ? Number(s.position) : idx,
      config: toSafeConfig(s.config),
    }))
    .sort((a, b) => a.position - b.position)
    .map((s, idx) => ({ ...s, position: idx }));

  // Replace sections: delete then insert.
  const { error: delError } = await supabase.from('channel_home_sections').delete().eq('user_id', user.id);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 });

  if (normalized.length) {
    const { error: insError } = await supabase.from('channel_home_sections').insert(normalized);
    if (insError) {
      const msg = insError.message || 'Failed to save sections.';
      if (msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('channel_home_sections')) {
        return NextResponse.json(
          {
            error:
              'Channel customization database tables are missing. Run the Supabase SQL patch: supabase/channel_home_customization_patch.sql',
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
