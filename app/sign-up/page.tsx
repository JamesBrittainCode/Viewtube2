import { AuthForm } from '@/components/auth-form';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <AuthForm mode="sign-up" redirectTo={redirect} />;
}
