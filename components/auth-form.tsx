'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function sanitizeRedirect(input?: string | null) {
  if (!input) return '/';
  if (!input.startsWith('/') || input.startsWith('//')) return '/';
  return input;
}

export function AuthForm({
  mode,
  redirectTo,
  referral,
}: {
  mode: 'sign-in' | 'sign-up';
  redirectTo?: string;
  referral?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const router = useRouter();
  const nextPath = sanitizeRedirect(redirectTo);
  const redirectQuery = nextPath && nextPath !== '/' ? `?redirect=${encodeURIComponent(nextPath)}` : '';
  const referralCode = (referral || '').trim();

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
              ...(referralCode ? { referral: referralCode } : {}),
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

      window.dispatchEvent(new Event('viewtube-play-intro'));
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendMagicLink() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email first.');
      return;
    }
    if (mode === 'sign-up' && !acceptedLegal) {
      setError('You must agree to the Terms and Privacy Policy to continue.');
      return;
    }

    setMagicLoading(true);
    try {
      const supabase = createClient();
      const siteOrigin = window.location.origin;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (otpError) throw otpError;
      router.push(`/check-email?email=${encodeURIComponent(trimmed)}&type=magic`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMagicLoading(false);
    }
  }

  async function sendPasswordRecovery() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email first.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const supabase = createClient();
      const siteOrigin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${siteOrigin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      router.push(`/check-email?email=${encodeURIComponent(trimmed)}&type=recovery`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-10 dark:bg-zinc-950">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid md:grid-cols-[1fr_560px]">
          <div className="p-8 md:p-12">
            <Link href="/" className="inline-flex items-center">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">ViewTube</span>
            </Link>

            <h1 className="mt-10 text-4xl font-extrabold leading-tight tracking-tight text-zinc-900 dark:text-white">
              {mode === 'sign-in' ? (
                <>
                  Welcome Back
                </>
              ) : (
                <>
                  Create your
                  <br />
                  account
                </>
              )}
            </h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              {mode === 'sign-in'
                ? 'Sign in to continue watching, uploading, and sharing videos.'
                : 'Join ViewTube to subscribe, upload, and build your channel.'}
            </p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              {mode === 'sign-up' && (
                <div className="space-y-1">
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    required
                    minLength={3}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none ring-red-600/20 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus:border-zinc-700"
                  />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    A unique handle is auto-generated from your username (you can edit it later).
                  </p>
                </div>
              )}

              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Email address"
                required
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none ring-red-600/20 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Password"
                required
                minLength={6}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm outline-none ring-red-600/20 placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-700"
              />

              {mode === 'sign-in' ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                  <label className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-600/20 dark:border-zinc-700"
                    />
                    <span>Remember me</span>
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void sendPasswordRecovery()}
                      disabled={recoveryLoading}
                      className="font-medium text-zinc-700 hover:underline disabled:opacity-60 dark:text-zinc-300"
                    >
                      {recoveryLoading ? 'Sending...' : 'Forgot password?'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendMagicLink()}
                      disabled={magicLoading}
                      className="font-medium text-zinc-700 hover:underline disabled:opacity-60 dark:text-zinc-300"
                    >
                      {magicLoading ? 'Sending...' : 'Magic link'}
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(event) => setAcceptedLegal(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-600/20 dark:border-zinc-700"
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

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-70"
              >
                {loading ? 'Please wait...' : mode === 'sign-in' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
              {mode === 'sign-in' ? 'Don’t have an account?' : 'Already have an account?'}{' '}
              <Link
                href={mode === 'sign-in' ? `/sign-up${redirectQuery}` : `/sign-in${redirectQuery}`}
                className="font-semibold text-zinc-900 hover:underline dark:text-white"
              >
                {mode === 'sign-in' ? 'Sign Up' : 'Sign In'}
              </Link>
            </p>

            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
              By continuing you agree to our{' '}
              <Link href="/terms" className="underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="relative hidden bg-zinc-100 md:block dark:bg-zinc-950">
            <Image
              src="/auth-phone.jpg"
              alt="ViewTube on a phone"
              fill
              priority
              className="object-contain object-right"
              sizes="(min-width: 768px) 50vw, 0px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
