'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AvatarUpload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const avatar = formData.get('avatar') as File;

    if (!avatar || !avatar.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Avatar upload failed');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="file" name="avatar" accept="image/*" required className="block w-full" />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
      >
        {loading ? 'Uploading...' : 'Upload avatar'}
      </button>
    </form>
  );
}
