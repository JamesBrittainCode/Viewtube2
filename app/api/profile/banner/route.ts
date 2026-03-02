import { NextResponse } from 'next/server';
import { BANNER_BUCKET } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const banner = formData.get('banner');

  if (!(banner instanceof File) || !banner.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
  }

  const ext = banner.name.split('.').pop() || 'jpg';
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, banner, {
      contentType: banner.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicUrlData } = supabase.storage
    .from(BANNER_BUCKET)
    .getPublicUrl(path);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ banner_url: publicUrlData.publicUrl })
    .eq('id', user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ banner_url: publicUrlData.publicUrl });
}
