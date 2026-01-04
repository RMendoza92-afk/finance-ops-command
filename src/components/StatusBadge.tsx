import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'Open' | 'Closed' | 'Pending' | 'In Trial';
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const statusStyles = {
    'Open': 'badge-open',
    'Closed': 'badge-closed',
    'Pending': 'badge-pending',
    'In Trial': 'badge-critical pulse-critical'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs'
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      statusStyles[status],
      sizeStyles[size]
    )}>
      {status}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const severityStyles = {
    'Low': 'bg-success/10 text-success border border-success/20',
    'Medium': 'bg-info/10 text-info border border-info/20',
    'High': 'bg-warning/10 text-warning border border-warning/20',
    'Critical': 'bg-destructive/10 text-destructive border border-destructive/20 pulse-critical'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs'
  };

  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-medium",
      severityStyles[severity],
      sizeStyles[size]
    )}>
      {severity}
    </span>
  );
}
