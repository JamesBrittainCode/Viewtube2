import { redirect } from 'next/navigation';
import { UploadForm } from '@/components/upload-form';
import { createClient } from '@/lib/supabase/server';

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return <UploadForm />;
}
