import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'gold' | 'neutral' | 'indigo';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          container: 'bg-[#168060]/10 text-[#168060] border-[#168060]/25',
          dot: 'bg-[#168060]',
        };
      case 'warning':
        return {
          container: 'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/25',
          dot: 'bg-[#B7791F]',
        };
      case 'danger':
        return {
          container: 'bg-[#C2413A]/10 text-[#C2413A] border-[#C2413A]/25',
          dot: 'bg-[#C2413A]',
        };
      case 'gold':
      case 'indigo':
        return {
          container: 'bg-[#A69B8D]/15 text-[#807365] border-[#A69B8D]/35',
          dot: 'bg-[#807365]',
        };
      default:
        return {
          container: 'bg-[#E8E6E2]/60 text-[#6B6863] border-[#E6E3DE]',
          dot: 'bg-[#A69B8D]',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[12px] font-medium border tracking-tight ${styles.container} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />}
      {children}
    </span>
  );
};
