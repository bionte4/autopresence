export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-6 h-20 animate-pulse rounded-xl bg-surface-2" />
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="h-48 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-48 animate-pulse rounded-xl bg-surface-2" />
      </div>
    </main>
  );
}
