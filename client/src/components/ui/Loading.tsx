import React from 'react';
import waveLogo from '../../assets/brand/wave-logo.png';

/* =========================================================================
   1. BRANDED APPLICATION LOADER (WAVE ELECTRONICS)
   Used strictly during initial auth/app bootstrap.
   ========================================================================= */
export const AppLoader: React.FC<{ message?: string }> = ({
  message = 'Initializing Wave Electronics...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex flex-col items-center justify-center bg-[#FAF9F7] text-[#171717] p-6 select-none"
    >
      <div className="flex flex-col items-center text-center max-w-sm">
        {/* Company logo */}
        <img src={waveLogo} alt="WCS Wave Control System" className="h-20 w-auto mb-6" />

        {/* Company Title */}
        <h1 className="text-xl font-bold tracking-tight text-[#171717]">
          Wave Electronics
        </h1>
        <p className="text-xs text-[#716B64] font-medium mt-1">
          Component Stock &amp; Job Management System
        </p>

        {/* Elegant Golden-Grey Progress Track */}
        <div className="w-48 h-1 bg-[#E7E4DE] rounded-full overflow-hidden mt-6 relative">
          <div className="h-full bg-gradient-to-r from-[#807365] via-[#A69B8D] to-[#807365] rounded-full w-24 animate-[shimmer_1.4s_infinite_linear]" />
        </div>

        <span className="text-[11px] font-mono text-[#807365] mt-3">
          {message}
        </span>
      </div>
    </div>
  );
};

/* =========================================================================
   2. ATOMIC SKELETON PRIMITIVE
   ========================================================================= */
export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rounded' | 'circle' | 'pill';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rounded',
}) => {
  const variantClass = {
    text: 'h-4 rounded',
    rounded: 'rounded-[9px]',
    circle: 'rounded-full',
    pill: 'rounded-full',
  }[variant];

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer border border-[#E7E4DE]/60 ${variantClass} ${className}`}
    />
  );
};

/* =========================================================================
   3. INLINE BUTTON SPINNER
   ========================================================================= */
export const ButtonSpinner: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5',
}) => (
  <svg
    className={`animate-spin text-current ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3.5"
    />
    <path
      className="opacity-90"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

/* =========================================================================
   4. TABLE SKELETON
   Preserves layout, can be rendered inside <tbody> or as full card table.
   ========================================================================= */
export interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  headers?: string[];
  rowClassName?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  cols = 6,
  headers,
  rowClassName = '',
}) => {
  // If headers provided, render as full table structure
  if (headers && headers.length > 0) {
    return (
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="th-enterprise">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E4DE]/60">
              {Array.from({ length: rows }).map((_, rIdx) => (
                <tr key={rIdx} className={rowClassName}>
                  {headers.map((_, cIdx) => (
                    <td key={cIdx} className="td-enterprise">
                      <Skeleton
                        className={`h-4 ${
                          cIdx === 0
                            ? 'w-20 font-mono'
                            : cIdx === 1
                            ? 'w-44'
                            : cIdx === headers.length - 1
                            ? 'w-16 ml-auto'
                            : 'w-28'
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Otherwise render table rows to be embedded directly into existing <tbody>
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className={rowClassName}>
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="td-enterprise">
              <Skeleton
                className={`h-4 ${
                  cIdx === 0
                    ? 'w-20'
                    : cIdx === 1
                    ? 'w-48'
                    : cIdx === cols - 1
                    ? 'w-16'
                    : 'w-24'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/* =========================================================================
   5. DASHBOARD SKELETON
   Pre-mount layout for Executive Dashboard.
   ========================================================================= */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard metrics">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* 4 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="enterprise-card p-4.5 bg-white border border-[#E7E4DE] flex flex-col justify-between"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-32" />
              </div>
              <Skeleton className="w-10 h-10 rounded-[10px]" />
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </div>

      {/* Low Stock Table Skeleton Card */}
      <div className="enterprise-card overflow-hidden">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-[#E7E4DE] bg-[#FAF9F7]/50">
          <div className="space-y-1">
            <Skeleton className="h-4.5 w-72" />
            <Skeleton className="h-3.5 w-48" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="p-4">
          <TableSkeleton
            rows={4}
            cols={7}
            headers={[
              'Part Code',
              'Component Name',
              'Category',
              'In-Store Stock',
              'Min Stock',
              'Location',
              'Deficit',
            ]}
          />
        </div>
      </div>

      {/* Lifecycle Workflow Skeleton */}
      <div className="enterprise-card p-5">
        <div className="pb-3 mb-4 border-b border-[#E7E4DE] flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-4.5 w-80" />
            <Skeleton className="h-3.5 w-96" />
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-[#E7E4DE] bg-white space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   6. CARD SKELETON
   ========================================================================= */
export const CardSkeleton: React.FC<{ count?: number; className?: string }> = ({
  count = 3,
  className = 'grid grid-cols-1 md:grid-cols-3 gap-4',
}) => {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="enterprise-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
};

/* =========================================================================
   7. FORM SKELETON
   ========================================================================= */
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 6 }) => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-[#E7E4DE]">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
};

/* =========================================================================
   8. DETAIL SKELETON
   ========================================================================= */
export const DetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 rounded-xl border border-[#E7E4DE] bg-white flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Key-Value Pairs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-xl border border-[#E7E4DE] bg-white">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </div>

      {/* Sub-table Skeleton */}
      <div className="rounded-xl border border-[#E7E4DE] bg-white p-5 space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
};
