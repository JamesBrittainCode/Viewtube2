import { redirect } from 'next/navigation';
import { UploadForm } from '@/components/upload-form';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Upload',
  description: 'Upload a video or short to ViewTube.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return <UploadForm />;
}
