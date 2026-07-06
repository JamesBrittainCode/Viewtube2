import { AuthForm } from '@/components/auth-form';

export const metadata = {
  title: 'Sign up',
  description: 'Create a ViewTube account.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; ref?: string }>;
}) {
  const { redirect, ref } = await searchParams;
  return <AuthForm mode="sign-up" redirectTo={redirect} referral={ref} />;
}
