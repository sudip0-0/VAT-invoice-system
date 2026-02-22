import { formatNPR } from '@/lib/nepal-format';

interface AmountDisplayProps {
  amount: number;
  compact?: boolean;
  className?: string;
}

export default function AmountDisplay({ amount, compact, className }: AmountDisplayProps) {
  return (
    <span className={className}>
      {formatNPR(amount, { compact })}
    </span>
  );
}
