import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { EmptyState } from '../components/ui/EmptyState';
import { TableSkeleton } from '../components/ui/Loading';
import { SimpleSelect } from '../components/ui/Select';
import { PageHeader } from '../components/ui/PageHeader';
import { toast } from '../utils/toast';
import { History, Calendar, User } from 'lucide-react';
import { TablePagination } from '../components/ui/TablePagination';

interface ActivityLogItem {
  _id: string;
  userName: string;
  action: string;
  module: string;
  targetLabel?: string;
  details?: string;
  createdAt: string;
}

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'auth', label: 'Access & Users' },
  { value: 'component', label: 'Components' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'stock_inward', label: 'Stock Inward' },
  { value: 'circuit', label: 'Circuits' },
  { value: 'job', label: 'Jobs' },
  { value: 'job_receipt', label: 'Job Receipts' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'settings', label: 'Settings' },
];

const MODULE_LABEL: Record<string, string> = Object.fromEntries(
  MODULE_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, fromDate, toDate, page, pageSize]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: String(pageSize) };
      if (moduleFilter) params.module = moduleFilter;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const res = await api.get('/activity-logs', { params });
      setLogs(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch activity logs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={History}
        title="Activity Log"
        description="Audit trail of who performed what action, and when — job approval, material issue, finished circuit receipt, job closing, stock adjustments and stock inward."
      />

      <div className="enterprise-card p-3 flex flex-col sm:flex-row items-center gap-3">
        <div className="w-full sm:w-56">
          <SimpleSelect
            value={moduleFilter}
            onValueChange={(v) => {
              setModuleFilter(v);
              setPage(1);
            }}
            options={MODULE_OPTIONS}
            placeholder="Filter by module"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-[#6B6863]">
          <Calendar className="w-4 h-4 text-[#A69B8D]" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="input-enterprise !h-9 !w-36 !text-xs"
          />
          <span>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="input-enterprise !h-9 !w-36 !text-xs"
          />
        </div>
        <div className="sm:ml-auto text-xs text-[#6B6863]">{total} entries</div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="th-enterprise">When</th>
                <th className="th-enterprise">User</th>
                <th className="th-enterprise">Module</th>
                <th className="th-enterprise">Action</th>
                <th className="th-enterprise">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E3DE]/60">
              {loading ? (
                <TableSkeleton rows={8} cols={5} />
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState
                      icon={History}
                      title="No activity recorded"
                      description="Mutating actions across the system will appear here as they happen."
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="tr-enterprise">
                    <td className="td-enterprise text-[12px] text-[#6B6863] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="td-enterprise">
                      <div className="flex items-center gap-1.5 font-medium text-[#171717]">
                        <User className="w-3.5 h-3.5 text-[#A69B8D]" />
                        {log.userName}
                      </div>
                    </td>
                    <td className="td-enterprise">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#383531] border border-[#E6E3DE]">
                        {MODULE_LABEL[log.module] || log.module}
                      </span>
                    </td>
                    <td className="td-enterprise text-[#171717]">{log.action}</td>
                    <td className="td-enterprise">
                      <div className="font-mono text-[12px] text-[#171717]">{log.targetLabel || '—'}</div>
                      {log.details && <div className="text-[11px] text-[#6B6863] mt-0.5">{log.details}</div>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="log entries"
        />
      </div>
    </div>
  );
};

export default ActivityLogs;
