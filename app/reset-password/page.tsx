'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function ensureSession() {
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
    }
    void ensureSession();
  }, [supabase]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      router.push('/sign-in');
      router.refresh();
    } catch (err) {
      setError((err as Error).message || 'Could not reset password.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          This reset link is invalid or expired. Request a new password reset email.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-20 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mt-2 text-sm text-zinc-500">Set a new password for your ViewTube account.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="New password"
          required
          minLength={6}
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          type="password"
          placeholder="Confirm new password"
          required
          minLength={6}
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-white dark:text-zinc-900"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

