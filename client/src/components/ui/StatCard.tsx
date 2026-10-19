import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  badge?: {
    label: string;
    variant?: 'success' | 'warning' | 'gold' | 'neutral' | 'danger' | 'indigo';
  };
  iconColorClass?: string;
  iconBgClass?: string;
  loading?: boolean;
  staggerIndex?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  badge,
  iconColorClass = 'text-[#807365]',
  iconBgClass = 'bg-[#A69B8D]/15',
  loading = false,
  staggerIndex,
}) => {
  const getBadgeClass = (variant = 'neutral') => {
    switch (variant) {
      case 'success':
        return 'bg-[#168060]/10 text-[#168060] border-[#168060]/20';
      case 'warning':
        return 'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/20';
      case 'danger':
        return 'bg-[#C2413A]/10 text-[#C2413A] border-[#C2413A]/20';
      case 'gold':
      case 'indigo':
        return 'bg-[#A69B8D]/15 text-[#807365] border-[#A69B8D]/30';
      default:
        return 'bg-[#E8E6E2]/60 text-[#6B6863] border-[#E6E3DE]';
    }
  };

  const getStaggerClass = () => {
    if (staggerIndex === undefined) return '';
    const idx = (staggerIndex % 4) + 1;
    return `stagger-${idx}`;
  };

  if (loading) {
    return (
      <div className="enterprise-card p-5 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 bg-[#E8E6E2] rounded"></div>
          <div className="w-8 h-8 bg-[#E8E6E2] rounded-lg"></div>
        </div>
        <div className="mt-3 h-8 w-20 bg-[#E8E6E2] rounded"></div>
        <div className="mt-2 h-3.5 w-32 bg-[#E8E6E2] rounded"></div>
      </div>
    );
  }

  return (
    <div
      className={`enterprise-card p-5 group animate-fade-in-up ${getStaggerClass()} hover:border-[#A69B8D]/40 hover:-translate-y-[1px] hover:shadow-xs transition-all duration-180 ease-smooth`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#6B6863] tracking-tight">{title}</span>
        <div
          className={`w-8 h-8 rounded-lg ${iconBgClass} flex items-center justify-center ${iconColorClass} transition-colors duration-180 ease-smooth`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between">
        <div className="metric-number text-[#171717]">{value}</div>
        {badge && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getBadgeClass(badge.variant)}`}>
            {badge.label}
          </span>
        )}
      </div>
      {subtitle && <p className="helper-text mt-1 text-[#6B6863] truncate">{subtitle}</p>}
    </div>
  );
};
