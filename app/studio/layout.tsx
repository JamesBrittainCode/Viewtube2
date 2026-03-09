import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CircleHelp,
  Clapperboard,
  Compass,
  DollarSign,
  MessageSquareMore,
  Search,
  Settings,
  Shield,
  Sparkles,
  Video,
  Radio,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin';

const baseNavLinks = [
  { href: '/studio', label: 'Dashboard', icon: Compass },
  { href: '/studio/content', label: 'Content', icon: Video },
  { href: '/studio/live', label: 'Live', icon: Radio },
  { href: '/studio/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/studio/spotlight', label: 'Creator Spotlight', icon: Sparkles },
  { href: '/studio/earn', label: 'Earn', icon: DollarSign },
  { href: '/studio/settings', label: 'Settings', icon: Settings },
  { href: '/studio/feedback', label: 'Feedback', icon: MessageSquareMore },
] as const;

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username,handle,avatar_url')
    .eq('id', user.id)
    .single();
  const isAdmin = isAdminEmail(user.email);
  const navLinks = isAdmin
    ? [...baseNavLinks, { href: '/studio/admin', label: 'Admin', icon: Shield }]
    : [...baseNavLinks];

  return (
    <div className="min-h-screen bg-[#202124] text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-[#202124]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1700px] items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <span className="rounded-md bg-red-600 px-2 py-1 text-white">View</span>
            <span>Tube</span>
            <span className="text-zinc-400">Studio</span>
          </Link>

          <Link
            href="/studio/content"
            className="mx-auto hidden w-full max-w-2xl items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-4 py-2 text-zinc-500 md:flex"
          >
            <Search className="h-4 w-4" />
            <span className="text-sm">Search across your channel</span>
          </Link>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link href="/studio/feedback" className="hidden rounded-full p-2 hover:bg-zinc-800 md:inline-flex"><MessageSquareMore className="h-5 w-5" /></Link>
            <Link href="/studio/help" className="hidden rounded-full p-2 hover:bg-zinc-800 md:inline-flex"><CircleHelp className="h-5 w-5" /></Link>
            <Link href="/studio/notifications" className="rounded-full p-2 hover:bg-zinc-800"><Bell className="h-5 w-5" /></Link>
            <Link href="/upload" className="rounded-full border border-zinc-700 px-3 py-2 text-sm font-semibold hover:bg-zinc-800 sm:px-4">Create</Link>
          </div>
        </div>
      </header>

      <div className="border-b border-zinc-800 bg-[#1f2021] px-3 py-2 lg:hidden">
        <nav className="flex gap-2 overflow-x-auto pb-1 text-xs">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-full border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-zinc-800 bg-[#1b1c1d] p-4 lg:block">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
            <Image
              src={profile?.avatar_url || '/avatar-placeholder.svg'}
              alt={profile?.username || 'Channel'}
              width={96}
              height={96}
              className="mx-auto h-24 w-24 rounded-full object-cover"
            />
            <p className="mt-3 text-sm text-zinc-400">Your channel</p>
            <p className="font-semibold">{profile?.username || 'Creator'}</p>
            <p className="text-sm text-zinc-500">{profile?.handle || '@user'}</p>
          </div>

          <nav className="mt-4 space-y-1 text-sm">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link href="/" className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800">
              <Clapperboard className="h-4 w-4" />
              Back to ViewTube
            </Link>
          </nav>
        </aside>

        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
