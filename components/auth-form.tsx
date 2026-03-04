'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const siteOrigin =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || '';

    try {
      if (mode === 'sign-up') {
        if (!acceptedLegal) {
          throw new Error('You must agree to the Terms and Privacy Policy to create an account.');
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim(),
              terms_accepted: true,
              terms_accepted_at: new Date().toISOString(),
            },
            emailRedirectTo: `${siteOrigin}/email-confirmed`,
          },
        });

        if (signUpError) throw signUpError;

        // If email confirmation is enabled, session is null until user verifies.
        if (!data.session) {
          router.push(`/check-email?email=${encodeURIComponent(email)}`);
          router.refresh();
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          const message = signInError.message.toLowerCase();
          if (message.includes('email not confirmed') || message.includes('email not verified')) {
            throw new Error('Please verify your email first. Check your inbox for the confirmation link.');
          }
          throw signInError;
        }
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (mode === 'sign-up' && !acceptedLegal) {
      setError('You must agree to the Terms and Privacy Policy to continue with Google.');
      return;
    }

    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-bold">
        {mode === 'sign-in' ? 'Sign in to ViewTube' : 'Create your ViewTube account'}
      </h1>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === 'sign-up' && (
          <div className="space-y-1">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              required
              minLength={3}
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="text-xs text-zinc-500">
              A unique handle is auto-generated from your username (you can edit it later).
            </p>
          </div>
        )}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email"
          required
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
        />

        {mode === 'sign-up' && (
          <label className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="font-medium underline">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="font-medium underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-70 dark:bg-white dark:text-zinc-900"
        >
          {loading ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
        </button>
      </form>

      <button
        type="button"
        onClick={signInWithGoogle}
        className="mt-3 h-11 w-full rounded-xl border border-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Continue with Google
      </button>

      <p className="mt-4 text-sm text-zinc-500">
        {mode === 'sign-in' ? 'No account yet?' : 'Already have an account?'}{' '}
        <Link
          href={mode === 'sign-in' ? '/sign-up' : '/sign-in'}
          className="font-medium text-zinc-900 dark:text-zinc-100"
        >
          {mode === 'sign-in' ? 'Sign up' : 'Sign in'}
        </Link>
      </p>

      <p className="mt-2 text-xs text-zinc-500">
        ViewTube legal:{' '}
        <Link href="/terms" className="underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline">
          Privacy
        </Link>
        .
      </p>
    </div>
  );
}
