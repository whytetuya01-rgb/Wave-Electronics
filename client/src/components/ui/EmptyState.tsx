import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  const ActionIcon = action?.icon;

  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-white border border-[#E6E3DE] flex items-center justify-center text-[#807365] mb-3.5 shadow-[0_2px_8px_-2px_rgba(20,20,20,0.08)] ring-4 ring-[#F4F2EE]">
        <Icon className="w-5 h-5 text-[#807365]" />
      </div>
      <h3 className="text-sm font-semibold text-[#171717] tracking-tight">{title}</h3>
      <p className="helper-text text-[#6B6863] mt-1 max-w-sm text-center">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 btn-primary text-xs"
        >
          {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};
