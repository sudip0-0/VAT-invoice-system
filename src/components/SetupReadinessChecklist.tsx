import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSetupReadiness } from '@/hooks/useSetupReadiness';

export default function SetupReadinessChecklist({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useSetupReadiness();

  if (isLoading || !data || (data.ready && compact)) return null;

  const visibleItems = compact ? data.checklist.filter((item) => !item.complete).slice(0, 4) : data.checklist;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Setup readiness</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.completed} of {data.total} checks complete before VAT-safe daily use.
          </p>
        </div>
        {compact && (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link to="/settings">Review</Link>
          </Button>
        )}
      </div>

      <div className="mt-3 grid gap-2">
        {visibleItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              {item.complete ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={item.complete ? 'text-muted-foreground line-through' : 'text-foreground'}>{item.label}</span>
            </div>
            {!item.complete && item.actionPath && !compact && (
              <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
                <Link to={item.actionPath}>Open</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
