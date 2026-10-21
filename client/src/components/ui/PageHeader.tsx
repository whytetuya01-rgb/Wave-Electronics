import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ icon: Icon, title, description, badge, actions, className = '' }) => (
  <div className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${className}`}>
    <div className="flex items-start gap-3.5 min-w-0">
      {Icon && (
        <div className="hidden sm:flex w-11 h-11 rounded-xl bg-[#141414] text-[#D9D2C7] items-center justify-center shrink-0 shadow-[0_4px_12px_-4px_rgba(20,20,20,0.35)] ring-1 ring-[#303030]">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="page-title">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-[13.5px] leading-relaxed text-[#6B6863] max-w-3xl">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 lg:justify-end shrink-0">{actions}</div>}
  </div>
);

export default PageHeader;
