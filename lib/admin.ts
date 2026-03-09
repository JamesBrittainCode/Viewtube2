export const ADMIN_EMAIL = 'jesuslearningclub@gmail.com';

export function isAdminEmail(email?: string | null) {
  return (email || '').toLowerCase() === ADMIN_EMAIL;
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: { can_moderate?: boolean } | null }>;
      };
    };
  };
};

export async function canModerateUser(
  supabase: unknown,
  input: { id: string; email?: string | null },
) {
  if (isAdminEmail(input.email)) return true;
  const db = supabase as SupabaseLike;
  const { data } = await db
    .from('profiles')
    .select('can_moderate')
    .eq('id', input.id)
    .maybeSingle();
  return Boolean(data?.can_moderate);
}
