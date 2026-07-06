import { AuthForm } from '@/components/auth-form';

export const metadata = {
  title: 'Sign in',
  description: 'Sign in to your ViewTube account.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <AuthForm mode="sign-in" redirectTo={redirect} />;
}
