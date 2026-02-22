interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  PAID: 'bg-success/10 text-success',
  ISSUED: 'bg-primary/10 text-primary',
  DRAFT: 'bg-muted text-muted-foreground',
  PARTIALLY_PAID: 'bg-warning/10 text-warning',
  OVERDUE: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
};

const statusLabels: Record<string, string> = {
  PAID: 'Paid',
  ISSUED: 'Issued',
  DRAFT: 'Draft',
  PARTIALLY_PAID: 'Partial',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] || 'bg-muted text-muted-foreground'} ${className}`}>
      {statusLabels[status] || status}
    </span>
  );
}
