export default function StudioSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold">Studio Settings</h1>
        <p className="mt-3 text-zinc-400">Manage channel-level studio preferences.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <a
          href="/studio/settings/customization"
          className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 transition hover:-translate-y-0.5 hover:bg-zinc-900/80 hover:shadow-md"
        >
          <div className="text-lg font-semibold">Channel customization</div>
          <div className="mt-2 text-sm text-zinc-400">
            Customize your channel home tab, featured videos, and sections.
          </div>
        </a>

        <a
          href="/studio/settings/linked-accounts"
          className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6 transition hover:-translate-y-0.5 hover:bg-zinc-900/80 hover:shadow-md"
        >
          <div className="text-lg font-semibold">Linked accounts</div>
          <div className="mt-2 text-sm text-zinc-400">
            Link parent and child accounts, manage safety settings, and block channels.
          </div>
        </a>

        <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
          <div className="text-lg font-semibold">More settings</div>
          <div className="mt-2 text-sm text-zinc-400">
            More studio settings are coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}
