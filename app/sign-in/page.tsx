import { AuthForm } from '@/components/auth-form';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <AuthForm mode="sign-in" redirectTo={redirect} />;
}
