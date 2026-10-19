import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/Loading';
import {
  Boxes,
  Search,
  CheckCircle2,
  AlertTriangle,
  History,
  Download,
  RefreshCw,
  Layers,
  ArrowRight,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';

interface FinishedGoodsItem {
  _id: string;
  circuitId: {
    _id: string;
    description?: string;
    pcbSize?: string;
    status?: string;
  } | string;
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  goodQtyBalance: number;
  totalReceivedGoodQty: number;
  totalRejectedQty: number;
  totalDispatchedQty: number;
  createdAt: string;
  updatedAt: string;
}

interface FinishedGoodsSummary {
  totalGoodBalance: number;
  totalReceivedGoodQty: number;
  totalRejectedQty: number;
  totalDispatchedQty: number;
  totalCircuits: number;
  inStockCount: number;
  outOfStockCount: number;
}

interface FGTransaction {
  _id: string;
  circuitId: string;
  type: 'received_from_job' | 'dispatched' | 'adjusted';
  qtyChange: number;
  balanceAfter: number;
  jobId?: { _id: string; jobNumber: string; status: string };
  jobNumber?: string;
  jobReceiptId?: { _id: string; receiptNumber: string; receiptDate: string; remarks?: string };
  referenceNo?: string;
  notes?: string;
  createdById?: { _id: string; name: string; username: string };
  createdAt: string;
}

export const FinishedGoods: React.FC = () => {
  const [items, setItems] = useState<FinishedGoodsItem[]>([]);
  const [summary, setSummary] = useState<FinishedGoodsSummary>({
    totalGoodBalance: 0,
    totalReceivedGoodQty: 0,
    totalRejectedQty: 0,
    totalDispatchedQty: 0,
    totalCircuits: 0,
    inStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [errorMsg, setErrorMsg] = useState('');

  // Transaction Ledger Modal State
  const [selectedItem, setSelectedItem] = useState<FinishedGoodsItem | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [transactions, setTransactions] = useState<FGTransaction[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

  // Fetch Finished Goods data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params: Record<string, string> = {};
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== 'all') params.stockStatus = statusFilter;

      const res = await api.get('/finished-goods', { params });
      setItems(res.data.data || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err: any) {
      console.error('Error fetching finished goods:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load finished goods inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Open Transaction Ledger
  const handleOpenLedger = async (item: FinishedGoodsItem) => {
    setSelectedItem(item);
    setShowLedgerModal(true);
    setLedgerLoading(true);
    setLedgerError('');
    try {
      const res = await api.get(`/finished-goods/${item._id}/transactions`);
      setTransactions(res.data.data || []);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setLedgerError(err.response?.data?.message || 'Failed to load transaction history');
    } finally {
      setLedgerLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = [
      'Circuit Code',
      'Circuit Name',
      'Version',
      'Good Qty Balance',
      'Total Received',
      'Total Rejected',
      'Total Dispatched',
      'Last Updated',
    ];
    const rows = items.map((i) => [
      i.circuitCode,
      `"${i.circuitName.replace(/"/g, '""')}"`,
      i.circuitVersion,
      i.goodQtyBalance,
      i.totalReceivedGoodQty,
      i.totalRejectedQty,
      i.totalDispatchedQty,
      new Date(i.updatedAt).toLocaleDateString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `finished_goods_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Finished Goods Inventory</h1>
            <span className="badge-status badge-status-gold text-[11px] font-mono">
              Module 10
            </span>
          </div>
          <p className="body-text text-[#6B6863] mt-1 max-w-2xl">
            Usable assembled circuit stock on hand, historical job receipts, and inventory audit ledger.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="btn-secondary !px-3 !py-1.5 text-xs font-medium"
            title="Refresh finished goods list"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#807365] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || items.length === 0}
            className="btn-secondary !px-3 !py-1.5 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 text-[#807365]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Finished Units in Stock"
          value={summary.totalGoodBalance.toLocaleString()}
          icon={Boxes}
          subtitle="Usable circuit stock on hand"
          badge={{
            label: `${summary.inStockCount} In Stock`,
            variant: summary.totalGoodBalance > 0 ? 'success' : 'neutral',
          }}
          iconColorClass="text-[#168060]"
          iconBgClass="bg-[#168060]/10"
          loading={loading}
        />
        <StatCard
          title="Lifetime Received Good"
          value={summary.totalReceivedGoodQty.toLocaleString()}
          icon={CheckCircle2}
          subtitle="Cumulatively received from jobs"
          badge={{ label: 'Good Units', variant: 'gold' }}
          iconColorClass="text-[#807365]"
          iconBgClass="bg-[#A69B8D]/15"
          loading={loading}
        />
        <StatCard
          title="Lifetime Rejected Units"
          value={summary.totalRejectedQty.toLocaleString()}
          icon={AlertTriangle}
          subtitle="Excluded from usable stock balance"
          badge={{
            label: summary.totalRejectedQty > 0 ? 'Defects Tracked' : 'Zero Defect',
            variant: summary.totalRejectedQty > 0 ? 'warning' : 'success',
          }}
          iconColorClass="text-[#B7791F]"
          iconBgClass="bg-[#B7791F]/10"
          loading={loading}
        />
        <StatCard
          title="Total Circuit Products"
          value={summary.totalCircuits.toLocaleString()}
          icon={Layers}
          subtitle={`${summary.outOfStockCount} zero balance`}
          badge={{ label: 'BOM Recipes', variant: 'neutral' }}
          iconColorClass="text-[#171717]"
          iconBgClass="bg-[#171717]/10"
          loading={loading}
        />
      </div>

      {/* Advanced Toolbar / Search & Filter Bar */}
      <div className="enterprise-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#807365] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search circuit code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise !pl-9 !h-9 text-xs w-full"
          />
        </form>

        <div className="inline-flex rounded-lg border border-[#E6E3DE] p-1 bg-[#FAF9F7] text-xs w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[13px] font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-[#171717] shadow-xs border border-[#E6E3DE]/70 font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            All Circuits
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('in_stock')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[13px] font-medium transition-all ${
              statusFilter === 'in_stock'
                ? 'bg-white text-[#168060] shadow-xs border border-[#E6E3DE]/70 font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            In Stock ({summary.inStockCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('out_of_stock')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[13px] font-medium transition-all ${
              statusFilter === 'out_of_stock'
                ? 'bg-white text-[#C2413A] shadow-xs border border-[#E6E3DE]/70 font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            Zero Balance ({summary.outOfStockCount})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-[#C2413A]/10 border border-[#C2413A]/25 rounded-[10px] text-sm text-[#C2413A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C2413A] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Finished Goods Table (Matching Linear/Attio Styling) */}
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="th-enterprise">Circuit Code</th>
                <th className="th-enterprise">Circuit Name</th>
                <th className="th-enterprise text-center">Version</th>
                <th className="th-enterprise text-right">Available Stock</th>
                <th className="th-enterprise text-right">Total Received</th>
                <th className="th-enterprise text-right">Rejected</th>
                <th className="th-enterprise text-center">Last Updated</th>
                <th className="th-enterprise text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E3DE]">
              {loading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={Boxes}
                      title={search ? 'No matching finished goods' : 'No finished goods on hand'}
                      description={
                        search
                          ? 'Try adjusting your search query or status filter.'
                          : 'Assembled circuits will automatically appear here once received from vendor jobs.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item._id} className="tr-enterprise group">
                    <td className="td-enterprise font-mono font-bold text-[#171717]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FAF9F7] text-[#171717] border border-[#E6E3DE]">
                        {item.circuitCode}
                      </span>
                    </td>
                    <td className="td-enterprise">
                      <div className="font-medium text-[#171717]">{item.circuitName}</div>
                      {typeof item.circuitId === 'object' && item.circuitId?.description && (
                        <div className="text-[11px] text-[#716B64] truncate max-w-xs">
                          {item.circuitId.description}
                        </div>
                      )}
                    </td>
                    <td className="td-enterprise text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F7F6F3] text-[#6B6863] border border-[#E6E3DE]">
                        <Layers className="w-3 h-3 text-[#807365]" />
                        v{item.circuitVersion}
                      </span>
                    </td>
                    <td className="td-enterprise text-right font-semibold">
                      <span className={item.goodQtyBalance > 0 ? 'text-[#168060]' : 'text-[#716B64]'}>
                        {item.goodQtyBalance.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-[#716B64] ml-1 font-normal">units</span>
                    </td>
                    <td className="td-enterprise text-right font-medium text-[#171717]">
                      {item.totalReceivedGoodQty.toLocaleString()}
                    </td>
                    <td className="td-enterprise text-right">
                      {item.totalRejectedQty > 0 ? (
                        <span className="text-[#C2413A] font-semibold">
                          {item.totalRejectedQty.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[#A69B8D]">0</span>
                      )}
                    </td>
                    <td className="td-enterprise text-center text-xs text-[#716B64]">
                      {new Date(item.updatedAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="td-enterprise text-right">
                      <button
                        onClick={() => handleOpenLedger(item)}
                        className="btn-secondary !px-2.5 !py-1 text-xs font-medium"
                        title="View transaction audit ledger"
                      >
                        <History className="w-3.5 h-3.5 text-[#807365]" />
                        <span>Ledger</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Ledger Modal */}
      <Modal
        isOpen={showLedgerModal}
        onClose={() => setShowLedgerModal(false)}
        title={
          selectedItem ? (
            <div className="flex items-center gap-2">
              <span>Finished Goods Ledger:</span>
              <span className="font-mono text-[#807365]">{selectedItem.circuitCode}</span>
              <span className="badge-status badge-status-gold text-[11px]">v{selectedItem.circuitVersion}</span>
            </div>
          ) : (
            'Finished Goods Ledger'
          )
        }
        subtitle={
          selectedItem
            ? `${selectedItem.circuitName} — Complete movement and job receipt audit log`
            : ''
        }
        icon={<Boxes className="w-5 h-5 text-[#807365]" />}
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-4">
            {/* Quick Stat Bar */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-[10px] bg-[#FAF9F7] border border-[#E7E4DE]">
              <div>
                <div className="text-[11px] font-semibold text-[#716B64] uppercase tracking-wider">Current Good Stock</div>
                <div className="text-lg font-bold text-[#168060] mt-0.5">
                  {selectedItem.goodQtyBalance.toLocaleString()} units
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#716B64] uppercase tracking-wider">Total Received</div>
                <div className="text-lg font-bold text-[#171717] mt-0.5">
                  {selectedItem.totalReceivedGoodQty.toLocaleString()} units
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-[#716B64] uppercase tracking-wider">Inspection Rejections</div>
                <div className="text-lg font-bold text-[#C2413A] mt-0.5">
                  {selectedItem.totalRejectedQty.toLocaleString()} units
                </div>
              </div>
            </div>

            {ledgerError && (
              <div className="p-3 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/25 text-[#C2413A] text-xs">
                {ledgerError}
              </div>
            )}

            {/* Transactions Table */}
            <div className="enterprise-card overflow-hidden">
              <div className="overflow-x-auto max-h-[360px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#FAF9F7] z-10">
                    <tr>
                      <th className="th-enterprise">Timestamp</th>
                      <th className="th-enterprise">Type</th>
                      <th className="th-enterprise text-right">Change</th>
                      <th className="th-enterprise text-right">Balance After</th>
                      <th className="th-enterprise">Job Ref</th>
                      <th className="th-enterprise">Receipt Ref</th>
                      <th className="th-enterprise">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E3DE]">
                    {ledgerLoading ? (
                      <TableSkeleton rows={4} cols={7} />
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-xs text-[#716B64]">
                          No transaction records logged for this circuit yet.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx._id} className="tr-enterprise">
                          <td className="td-enterprise text-[#716B64] whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="td-enterprise">
                            {tx.type === 'received_from_job' && (
                              <span className="badge-status badge-status-success text-[11px]">
                                Job Receipt
                              </span>
                            )}
                            {tx.type === 'dispatched' && (
                              <span className="badge-status badge-status-neutral text-[11px]">
                                Dispatched
                              </span>
                            )}
                            {tx.type === 'adjusted' && (
                              <span className="badge-status badge-status-warning text-[11px]">
                                Adjusted
                              </span>
                            )}
                          </td>
                          <td className="td-enterprise text-right font-mono font-bold">
                            <span className={tx.qtyChange > 0 ? 'text-[#168060]' : 'text-[#C2413A]'}>
                              {tx.qtyChange > 0 ? `+${tx.qtyChange}` : tx.qtyChange}
                            </span>
                          </td>
                          <td className="td-enterprise text-right font-mono font-semibold text-[#171717]">
                            {tx.balanceAfter.toLocaleString()}
                          </td>
                          <td className="td-enterprise font-mono font-medium text-[#807365]">
                            {tx.jobNumber || '-'}
                          </td>
                          <td className="td-enterprise font-mono text-[#171717]">
                            {tx.referenceNo || tx.jobReceiptId?.receiptNumber || '-'}
                          </td>
                          <td className="td-enterprise text-[#716B64] max-w-xs truncate">
                            {tx.notes || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#716B64] pt-2 border-t border-[#E7E4DE]">
              <span>
                Audited against authoritative <code className="text-[#171717]">FinishedGoodsTransaction</code> ledger
              </span>
              <button
                type="button"
                onClick={() => setShowLedgerModal(false)}
                className="btn-secondary !px-4 !py-1.5 text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
