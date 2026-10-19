import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import {
  PackageCheck,
  Plus,
  Search,
  FileText,
  Printer,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  IndianRupee,
} from 'lucide-react';

interface ComponentOption {
  _id: string;
  partCode: string;
  name: string;
  package?: string;
  ratePerUnit: number;
  inStoreStock: number;
  unitId?: { shortCode: string };
}

interface InwardRow {
  componentId: string;
  partCode: string;
  name: string;
  unitShortCode: string;
  qty: number;
  unitRate: number;
  totalAmount: number;
  remarks: string;
}

interface InwardRecord {
  _id: string;
  inwardNumber: string;
  inwardDate: string;
  supplierName: string;
  billNumber?: string;
  billDate?: string;
  items: InwardRow[];
  totalItems: number;
  totalQty: number;
  totalAmount: number;
  notes?: string;
  createdById?: { name: string; email: string; role: string };
  createdAt: string;
}

export const StockInward: React.FC = () => {
  const { isStoreKeeper, isAdmin } = useAuth();
  const canAddInward = isStoreKeeper || isAdmin;

  const [inwards, setInwards] = useState<InwardRecord[]>([]);
  const [componentsList, setComponentsList] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Stats
  const [totalValueAllTime, setTotalValueAllTime] = useState(0);
  const [totalUnitsAllTime, setTotalUnitsAllTime] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [selectedInward, setSelectedInward] = useState<InwardRecord | null>(null);

  // Add Form state
  const [inwardDate, setInwardDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierName, setSupplierName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<InwardRow[]>([
    {
      componentId: '',
      partCode: '',
      name: '',
      unitShortCode: 'NOS',
      qty: 100,
      unitRate: 0,
      totalAmount: 0,
      remarks: '',
    },
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInwards();
    fetchComponents();
  }, [startDate, endDate]);

  const fetchInwards = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/stock-inward', { params });
      setInwards(res.data.data);
      if (res.data.meta) {
        setTotalValueAllTime(res.data.meta.totalValueAllTime || 0);
        setTotalUnitsAllTime(res.data.meta.totalUnitsAllTime || 0);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to fetch inward history');
    } finally {
      setLoading(false);
    }
  };

  const fetchComponents = async () => {
    try {
      const res = await api.get('/components?limit=200');
      setComponentsList(res.data.data);
    } catch (err) {
      console.error('Failed to load components for selection', err);
    }
  };

  const handleComponentSelect = (index: number, componentId: string) => {
    const comp = componentsList.find((c) => c._id === componentId);
    if (!comp) return;

    const newItems = [...items];
    const qty = newItems[index].qty || 1;
    const rate = comp.ratePerUnit || 0;

    newItems[index] = {
      ...newItems[index],
      componentId: comp._id,
      partCode: comp.partCode,
      name: comp.name,
      unitShortCode: comp.unitId?.shortCode || 'NOS',
      unitRate: rate,
      totalAmount: Number((qty * rate).toFixed(2)),
    };
    setItems(newItems);
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    const newItems = [...items];
    const validQty = Math.max(1, qty);
    const rate = newItems[index].unitRate || 0;
    newItems[index].qty = validQty;
    newItems[index].totalAmount = Number((validQty * rate).toFixed(2));
    setItems(newItems);
  };

  const handleItemRateChange = (index: number, rate: number) => {
    const newItems = [...items];
    const validRate = Math.max(0, rate);
    const qty = newItems[index].qty || 1;
    newItems[index].unitRate = validRate;
    newItems[index].totalAmount = Number((qty * validRate).toFixed(2));
    setItems(newItems);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        componentId: '',
        partCode: '',
        name: '',
        unitShortCode: 'NOS',
        qty: 50,
        unitRate: 0,
        totalAmount: 0,
        remarks: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      setErrorMsg('Stock inward must contain at least one line item.');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const grandTotalAmount = items.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
  const grandTotalQty = items.reduce((sum, item) => sum + (item.qty || 0), 0);

  const handleOpenAddModal = () => {
    setInwardDate(new Date().toISOString().slice(0, 10));
    setSupplierName('');
    setBillNumber('');
    setBillDate('');
    setNotes('');
    setItems([
      {
        componentId: '',
        partCode: '',
        name: '',
        unitShortCode: 'NOS',
        qty: 100,
        unitRate: 0,
        totalAmount: 0,
        remarks: '',
      },
    ]);
    setErrorMsg('');
    setShowAddModal(true);
  };

  const handleSubmitInward = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierName.trim()) {
      setErrorMsg('Please specify the Supplier / Source name.');
      return;
    }

    const invalidRow = items.find((it) => !it.componentId);
    if (invalidRow) {
      setErrorMsg('Please select a component for every row in the inward item list.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/stock-inward', {
        inwardDate,
        supplierName,
        billNumber,
        billDate: billDate || undefined,
        notes,
        items,
      });

      setSuccessMsg(`Goods Inward Note '${res.data.data.inwardNumber}' created successfully! Stock updated.`);
      setShowAddModal(false);
      fetchInwards();
      fetchComponents();

      // Open print slip for newly created inward
      setSelectedInward(res.data.data);
      setShowSlipModal(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to submit stock inward');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewSlip = (inward: InwardRecord) => {
    setSelectedInward(inward);
    setShowSlipModal(true);
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const filteredInwards = inwards.filter((inv) => {
    const q = search.toLowerCase();
    return (
      inv.inwardNumber.toLowerCase().includes(q) ||
      inv.supplierName.toLowerCase().includes(q) ||
      (inv.billNumber && inv.billNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Stock Inward (Goods Received)</h1>
          <p className="body-text text-[#6B6863] mt-1 max-w-2xl">
            Record incoming purchased electronic components. Automatically increments store stock and logs immutable stock ledger transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canAddInward && (
            <button
              onClick={handleOpenAddModal}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>New Inward Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Inward Notes"
          value={inwards.length}
          icon={FileText}
          subtitle="Cumulative GIN vouchers logged"
          iconBgClass="bg-[#168060]/10"
          iconColorClass="text-[#168060]"
          loading={loading}
        />
        <StatCard
          title="Total Units Received"
          value={totalUnitsAllTime.toLocaleString()}
          icon={PackageCheck}
          subtitle="Physical parts received in store"
          iconBgClass="bg-[#A69B8D]/15"
          iconColorClass="text-[#807365]"
          loading={loading}
        />
        <StatCard
          title="Total Inward Value"
          value={`₹${totalValueAllTime.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={IndianRupee}
          subtitle="Replenishment procurement value"
          iconBgClass="bg-[#168060]/10"
          iconColorClass="text-[#168060]"
          badge={{ label: 'Procured', variant: 'success' }}
          loading={loading}
        />
        <StatCard
          title="Catalog Components"
          value={componentsList.length}
          icon={Layers}
          subtitle="Active parts available for restock"
          iconBgClass="bg-[#F7F6F3]"
          iconColorClass="text-[#6B6863]"
          loading={loading}
        />
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-[#C2413A]/10 border border-[#C2413A]/25 rounded-[10px] text-sm text-[#C2413A] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C2413A] shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-[#C2413A]/70 hover:text-[#C2413A] p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-[#168060]/10 border border-[#168060]/25 rounded-[10px] text-sm text-[#168060] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#168060] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#168060]/70 hover:text-[#168060] p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="enterprise-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#807365] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by Inward #, Supplier, Bill #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise pl-9"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-[#6B6863]">
            <span className="text-[12px] text-[#807365]">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 border border-[#E6E3DE] rounded-[8px] text-xs focus:ring-2 focus:ring-[#807365]/20 focus:border-[#807365] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#6B6863]">
            <span className="text-[12px] text-[#807365]">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 border border-[#E6E3DE] rounded-[8px] text-xs focus:ring-2 focus:ring-[#807365]/20 focus:border-[#807365] focus:outline-none"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-[#807365] hover:text-[#C2413A] px-2 py-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Inward History Table */}
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="th-enterprise">GIN Voucher #</th>
                <th className="th-enterprise">Inward Date</th>
                <th className="th-enterprise">Supplier / Source</th>
                <th className="th-enterprise">Bill / Invoice #</th>
                <th className="th-enterprise text-center">Line Items</th>
                <th className="th-enterprise text-right">Total Qty</th>
                <th className="th-enterprise text-right">Total Amount</th>
                <th className="th-enterprise">Received By</th>
                <th className="th-enterprise text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E3DE]/60">
              {loading ? (
                <TableSkeleton rows={6} cols={9} />
              ) : filteredInwards.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12">
                    <EmptyState
                      icon={PackageCheck}
                      title={search || startDate || endDate ? 'No matching inward records' : 'No stock inward entries recorded'}
                      description={
                        search || startDate || endDate
                          ? 'Try adjusting your filters or date range.'
                          : 'Record your first component shipment to replenish inventory and create ledger entries.'
                      }
                      action={
                        canAddInward && !search
                          ? {
                              label: 'New Stock Inward',
                              onClick: handleOpenAddModal,
                              icon: Plus,
                            }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredInwards.map((inward) => (
                  <tr key={inward._id} className="tr-enterprise group">
                    <td className="td-enterprise">
                      <button
                        onClick={() => handleViewSlip(inward)}
                        className="font-mono font-semibold text-[#141414] hover:text-[#807365] hover:underline flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#807365] shrink-0" />
                        <span>{inward.inwardNumber}</span>
                      </button>
                    </td>
                    <td className="td-enterprise text-[#6B6863] font-mono text-xs">
                      {new Date(inward.inwardDate).toLocaleDateString()}
                    </td>
                    <td className="td-enterprise">
                      <div className="font-semibold text-[#171717]">{inward.supplierName}</div>
                      {inward.notes && <div className="text-[12px] text-[#6B6863] truncate max-w-xs">{inward.notes}</div>}
                    </td>
                    <td className="td-enterprise font-mono text-xs text-[#303030]">
                      {inward.billNumber || <span className="text-[#A69B8D] italic">—</span>}
                    </td>
                    <td className="td-enterprise text-center">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#383531] border border-[#E6E3DE]">
                        {inward.totalItems} {inward.totalItems === 1 ? 'part' : 'parts'}
                      </span>
                    </td>
                    <td className="td-enterprise text-right font-mono font-semibold text-[#171717]">
                      {inward.totalQty.toLocaleString()}
                    </td>
                    <td className="td-enterprise text-right font-mono font-bold text-[#141414]">
                      ₹{inward.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="td-enterprise text-[#6B6863] text-xs">
                      {inward.createdById?.name || 'Store'}
                    </td>
                    <td className="td-enterprise text-right">
                      <button
                        onClick={() => handleViewSlip(inward)}
                        className="btn-secondary text-xs px-2.5 py-1"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#807365]" />
                        <span>Print GIN</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD STOCK INWARD MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="2xl"
        icon={<PackageCheck className="w-5 h-5 text-[#807365]" />}
        title="New Goods Inward Entry (GIN)"
        subtitle="Record purchased electronic parts. Directly updates store balance and creates ledger entries."
        onSubmit={handleSubmitInward}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting && <ButtonSpinner />}
              <span>{submitting ? 'Updating Inventory & Posting...' : 'Confirm Inward & Post Stock'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#F7F6F3]/60 p-4.5 rounded-xl border border-[#E6E3DE]">
            <div>
              <label className="label-text block mb-1.5">
                Inward Date <span className="text-[#C2413A]">*</span>
              </label>
              <input
                type="date"
                required
                value={inwardDate}
                onChange={(e) => setInwardDate(e.target.value)}
                className="input-enterprise"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label-text block mb-1.5">
                Supplier / Source Name <span className="text-[#C2413A]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mouser Electronics / DigiKey / Arrow"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="input-enterprise"
              />
            </div>

            <div>
              <label className="label-text block mb-1.5">Bill / Invoice Number</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-9041"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                className="input-enterprise font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="label-text block mb-1.5">Notes / Procurement Remarks</label>
              <input
                type="text"
                placeholder="e.g. Lot inspection verified, tape packaging intact"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-enterprise"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-[#171717] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#807365]" />
                Inward Component Line Items
              </h4>
              <button
                type="button"
                onClick={handleAddRow}
                className="btn-secondary text-xs px-2.5 py-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="border border-[#E6E3DE] rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F7F6F3] text-[11px] font-semibold uppercase text-[#6B6863] border-b border-[#E6E3DE]">
                  <tr>
                    <th className="py-2.5 px-3 w-5/12">Select Component</th>
                    <th className="py-2.5 px-3 w-2/12 text-right">Inward Qty</th>
                    <th className="py-2.5 px-3 w-2/12 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 w-2/12 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-3 w-1/12 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E3DE]/60">
                  {items.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF9F7]">
                      <td className="py-2 px-3">
                        <select
                          required
                          value={row.componentId}
                          onChange={(e) => handleComponentSelect(idx, e.target.value)}
                          className="select-enterprise text-xs"
                        >
                          <option value="">-- Choose Component Part --</option>
                          {componentsList.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.partCode} — {c.name} (Stock: {c.inStoreStock})
                            </option>
                          ))}
                        </select>
                        {row.name && (
                          <div className="text-[11px] text-[#A69B8D] mt-0.5 truncate">{row.name}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          required
                          min="1"
                          value={row.qty}
                          onChange={(e) => handleItemQtyChange(idx, parseInt(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={row.unitRate}
                          onChange={(e) => handleItemRateChange(idx, parseFloat(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-[#171717]">
                        ₹{row.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="btn-ghost p-1 text-[#A69B8D] hover:text-[#C2413A]"
                          title="Delete row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F7F6F3] border-t border-[#E6E3DE] font-semibold text-xs">
                  <tr>
                    <td className="py-2.5 px-3 text-[#6B6863]">Total: {items.length} Line Items</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#171717]">
                      {grandTotalQty.toLocaleString()} units
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#6B6863]">Grand Total:</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-[#171717] text-sm">
                      ₹{grandTotalAmount.toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </Modal>

      {/* PRINTABLE GOODS INWARD NOTE (GIN) MODAL */}
      {selectedInward && (
        <Modal
          isOpen={showSlipModal}
          onClose={() => setShowSlipModal(false)}
          size="xl"
          className="print:p-0 print:border-none print:shadow-none"
          bodyClassName="p-0"
        headerBanner={
          <div className="px-6 sm:px-8 py-4.5 bg-white border-b border-[#E7E4DE] flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-[10px] bg-[#FAF9F7] border border-[#E7E4DE] text-[#807365] flex items-center justify-center shrink-0">
                <Printer className="w-5 h-5 text-[#807365]" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-semibold text-[#171717] block">Goods Inward Voucher</span>
                <span className="text-xs sm:text-[13px] text-[#716B64] font-mono">{selectedInward.inwardNumber}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handlePrintSlip}
                className="btn-primary text-xs px-3.5 py-2 inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Voucher</span>
              </button>
              <button
                onClick={() => setShowSlipModal(false)}
                className="p-2 rounded-[8px] text-[#716B64] hover:text-[#171717] hover:bg-[#FAF9F7] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        }
      >

            {/* Printable Voucher Paper */}
            <div className="p-8 font-sans text-[#171717] bg-white" id="printable-voucher">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-[#141414] pb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-[#171717] uppercase">WAVE ELECTRONICS</h2>
                  <p className="text-xs text-[#6B6863]">Electronic Components & PCB Assembly Division</p>
                  <p className="text-[11px] text-[#A69B8D]">Bhosari Industrial Estate, Pune, Maharashtra 411026</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-1 bg-[#F7F6F3] border border-[#E6E3DE] rounded-[6px] text-xs font-semibold text-[#171717] uppercase">
                    Goods Inward Note (GIN)
                  </div>
                  <div className="mt-1 text-sm font-mono font-bold text-[#171717]">{selectedInward.inwardNumber}</div>
                  <div className="text-xs text-[#6B6863]">
                    Date: {new Date(selectedInward.inwardDate).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Metadata Details */}
              <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#E6E3DE] text-xs">
                <div>
                  <span className="text-[11px] uppercase font-semibold text-[#807365] block">Supplier / Source:</span>
                  <div className="font-bold text-sm text-[#171717]">{selectedInward.supplierName}</div>
                  {selectedInward.billNumber && (
                    <div className="text-xs text-[#6B6863] mt-0.5 font-mono">
                      Invoice Ref: <span className="font-semibold text-[#171717]">{selectedInward.billNumber}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase font-semibold text-[#807365] block">Store Inward Log:</span>
                  <div className="text-xs text-[#383531]">
                    Received By: <span className="font-semibold">{selectedInward.createdById?.name || 'Store'}</span>
                  </div>
                  {selectedInward.notes && (
                    <div className="text-xs text-[#6B6863] mt-0.5 italic">"{selectedInward.notes}"</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-left text-xs border border-[#E6E3DE]">
                  <thead className="bg-[#F7F6F3] text-[11px] font-bold uppercase text-[#383531] border-b border-[#E6E3DE]">
                    <tr>
                      <th className="py-2.5 px-3 border-r border-[#E6E3DE] w-12 text-center">#</th>
                      <th className="py-2.5 px-3 border-r border-[#E6E3DE]">Part Code</th>
                      <th className="py-2.5 px-3 border-r border-[#E6E3DE]">Component Description</th>
                      <th className="py-2.5 px-3 border-r border-[#E6E3DE] text-right">Inward Qty</th>
                      <th className="py-2.5 px-3 border-r border-[#E6E3DE] text-right">Unit Rate (₹)</th>
                      <th className="py-2.5 px-3 text-right">Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E3DE]">
                    {selectedInward.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 border-r border-[#E6E3DE] text-center font-mono text-[#807365]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-[#E6E3DE] font-mono font-semibold text-[#171717]">
                          {it.partCode}
                        </td>
                        <td className="py-2 px-3 border-r border-[#E6E3DE] text-[#383531]">{it.name}</td>
                        <td className="py-2 px-3 border-r border-[#E6E3DE] text-right font-mono font-bold text-[#171717]">
                          {it.qty} {it.unitShortCode || 'NOS'}
                        </td>
                        <td className="py-2 px-3 border-r border-[#E6E3DE] text-right font-mono text-[#6B6863]">
                          ₹{it.unitRate.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#171717]">
                          ₹{it.totalAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F7F6F3] border-t-2 border-[#141414] font-bold text-xs">
                    <tr>
                      <td colSpan={3} className="py-2 px-3 border-r border-[#E6E3DE] text-right">
                        Totals:
                      </td>
                      <td className="py-2 px-3 border-r border-[#E6E3DE] text-right font-mono">
                        {selectedInward.totalQty.toLocaleString()} units
                      </td>
                      <td className="py-2 px-3 border-r border-[#E6E3DE] text-right">Grand Total:</td>
                      <td className="py-2 px-3 text-right font-mono text-[#171717] text-sm">
                        ₹{selectedInward.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-12 pb-4 text-center text-xs">
                <div>
                  <div className="border-t border-[#E6E3DE] pt-2 font-semibold text-[#171717]">Received By (Store)</div>
                  <div className="text-[11px] text-[#A69B8D] mt-0.5">Physical Count Verified</div>
                </div>
                <div>
                  <div className="border-t border-[#E6E3DE] pt-2 font-semibold text-[#171717]">Quality Inspection (QC)</div>
                  <div className="text-[11px] text-[#A69B8D] mt-0.5">Specification / Package Ok</div>
                </div>
                <div>
                  <div className="border-t border-[#E6E3DE] pt-2 font-semibold text-[#171717]">Authorized Signatory</div>
                  <div className="text-[11px] text-[#A69B8D] mt-0.5">Wave Electronics</div>
                </div>
              </div>
            </div>
        </Modal>
      )}
    </div>
  );
};
