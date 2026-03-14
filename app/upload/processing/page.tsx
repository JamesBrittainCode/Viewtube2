import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadProcessing } from '@/components/upload-processing';

export default async function UploadProcessingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="mx-auto max-w-3xl py-8">
      <UploadProcessing />
    </div>
  );
}

