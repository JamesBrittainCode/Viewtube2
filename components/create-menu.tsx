'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current) return;
      const target = event.target as Node;
      if (!rootRef.current.contains(target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((state) => !state)}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-sm font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Create</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <Link
            href="/upload"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Upload video
          </Link>
          <Link
            href="/studio/live"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Go live
          </Link>
        </div>
      )}
    </div>
  );
}
