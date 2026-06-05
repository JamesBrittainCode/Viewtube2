import { NextResponse } from 'next/server';
import { isAdminEmail } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

const BUCKET = 'playables';

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function fileExt(file: File, fallback: string) {
  const name = file.name || '';
  const ext = name.includes('.') ? name.split('.').pop() : null;
  return (ext || fallback).toLowerCase().replace(/[^a-z0-9]/g, '') || fallback;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('playable_games')
    .select('id,title,slug,category,thumbnail_url,game_url,is_active,plays_count,created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ games: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const title = String(form.get('title') || '').trim();
  const description = String(form.get('description') || '').trim();
  const category = String(form.get('category') || 'Arcade').trim() || 'Arcade';
  const instructions = String(form.get('instructions') || '').trim();
  const htmlFile = form.get('html') as File | null;
  const thumbnail = form.get('thumbnail') as File | null;
  const customSlug = slugify(String(form.get('slug') || title));
  const slug = customSlug || slugify(title);

  if (!title || !slug) return NextResponse.json({ error: 'Title is required.' }, { status: 400 });
  if (!htmlFile || !/html?$/i.test(htmlFile.name)) {
    return NextResponse.json({ error: 'Upload a single HTML file for the game.' }, { status: 400 });
  }
  if (thumbnail && thumbnail.size > 0 && !thumbnail.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Thumbnail must be an image.' }, { status: 400 });
  }

  const folder = `${slug}-${Date.now()}`;
  const htmlPath = `${folder}/index.html`;
  const { error: htmlError } = await supabase.storage.from(BUCKET).upload(htmlPath, htmlFile, {
    contentType: 'text/html',
    cacheControl: '3600',
    upsert: false,
  });
  if (htmlError) return NextResponse.json({ error: htmlError.message }, { status: 400 });

  const gameUrl = supabase.storage.from(BUCKET).getPublicUrl(htmlPath).data.publicUrl;
  let thumbnailUrl: string | null = null;

  if (thumbnail && thumbnail.size > 0) {
    const thumbPath = `${folder}/thumbnail.${fileExt(thumbnail, 'png')}`;
    const { error: thumbError } = await supabase.storage.from(BUCKET).upload(thumbPath, thumbnail, {
      contentType: thumbnail.type || 'image/png',
      cacheControl: '3600',
      upsert: false,
    });
    if (thumbError) return NextResponse.json({ error: thumbError.message }, { status: 400 });
    thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl;
  }

  const { data, error } = await supabase
    .from('playable_games')
    .insert({
      title,
      slug,
      description,
      category,
      instructions,
      thumbnail_url: thumbnailUrl,
      game_url: gameUrl,
      created_by: user.id,
      is_active: true,
    })
    .select('id,title,slug,category,thumbnail_url,game_url,is_active,plays_count,created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ game: data });
}
