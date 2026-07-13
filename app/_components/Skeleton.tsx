export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.07] ${className}`} />;
}

export function SkeletonAgendamentoCard() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-4 h-4 w-2/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <div className="shrink-0 space-y-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonInfoBox() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-5 w-3/4" />
    </div>
  );
}
