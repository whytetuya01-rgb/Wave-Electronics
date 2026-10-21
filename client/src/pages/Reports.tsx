import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton } from '../components/ui/Loading';
import { SimpleSelect } from '../components/ui/Select';
import { toast } from '../utils/toast';
import {
  FileText,
  BarChart3,
  Cpu,
  AlertTriangle,
  History,
  Truck,
  Clock,
  Workflow,
  Search,
  Download,
  RefreshCw,
  Eye,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Boxes,
  CheckCircle2,
  XCircle,
  Filter,
  DollarSign,
  Info,
} from 'lucide-react';

type ReportTab =
  | 'component-stock'
  | 'low-stock'
  | 'stock-ledger'
  | 'material-with-vendors'
  | 'pending-jobs'
  | 'job-reconciliation';

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('component-stock');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown master options
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);

  // Report Data States
  const [componentStockData, setComponentStockData] = useState<{ data: any[]; summary: any }>({
    data: [],
    summary: {},
  });
  const [lowStockData, setLowStockData] = useState<{ data: any[]; summary: any }>({
    data: [],
    summary: {},
  });
  const [ledgerData, setLedgerData] = useState<{ data: any[]; summary: any }>({
    data: [],
    summary: {},
  });
  const [vendorMaterialData, setVendorMaterialData] = useState<{
    componentsWithVendors: any[];
    activeJobsWithVendors: any[];
    summary: any;
  }>({
    componentsWithVendors: [],
    activeJobsWithVendors: [],
    summary: {},
  });
  const [pendingJobsData, setPendingJobsData] = useState<{ data: any[]; summary: any }>({
    data: [],
    summary: {},
  });
  const [reconciliationData, setReconciliationData] = useState<{ data: any[]; summary: any }>({
    data: [],
    summary: {},
  });

  // Modal for Single Job Reconciliation Details
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [singleJobRec, setSingleJobRec] = useState<any>(null);
  const [jobRecLoading, setJobRecLoading] = useState(false);
  const [showRecModal, setShowRecModal] = useState(false);

  // Initial Load of master dropdown options
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [catsRes, vendsRes] = await Promise.all([
          api.get('/masters/categories').catch(() => ({ data: [] })),
          api.get('/vendors').catch(() => ({ data: { data: [] } })),
        ]);
        const catList = Array.isArray(catsRes.data)
          ? catsRes.data
          : Array.isArray(catsRes.data?.data)
          ? catsRes.data.data
          : [];
        const vendList = Array.isArray(vendsRes.data?.data)
          ? vendsRes.data.data
          : Array.isArray(vendsRes.data)
          ? vendsRes.data
          : [];
        setCategories(catList);
        setVendors(vendList);
      } catch (err) {
        console.error('Error fetching masters for report filters:', err);
      }
    };
    fetchMasters();
  }, []);

  // Fetch Report Data on Tab Change or Filter Update
  const fetchReportData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      if (activeTab === 'component-stock') {
        const params: Record<string, string> = {};
        if (search.trim()) params.search = search.trim();
        if (categoryFilter !== 'all') params.categoryId = categoryFilter;
        if (statusFilter !== 'all') params.status = statusFilter;
        const res = await api.get('/reports/component-stock', { params });
        setComponentStockData(res.data);
      } else if (activeTab === 'low-stock') {
        const params: Record<string, string> = {};
        if (search.trim()) params.search = search.trim();
        if (categoryFilter !== 'all') params.categoryId = categoryFilter;
        const res = await api.get('/reports/low-stock', { params });
        setLowStockData(res.data);
      } else if (activeTab === 'stock-ledger') {
        const params: Record<string, string> = {};
        if (search.trim()) params.search = search.trim();
        if (txTypeFilter !== 'all') params.type = txTypeFilter;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const res = await api.get('/reports/stock-ledger', { params });
        setLedgerData(res.data);
      } else if (activeTab === 'material-with-vendors') {
        const params: Record<string, string> = {};
        if (vendorFilter !== 'all') params.vendorId = vendorFilter;
        const res = await api.get('/reports/material-with-vendors', { params });
        setVendorMaterialData(res.data);
      } else if (activeTab === 'pending-jobs') {
        const params: Record<string, string> = {};
        if (search.trim()) params.search = search.trim();
        if (vendorFilter !== 'all') params.vendorId = vendorFilter;
        const res = await api.get('/reports/pending-jobs', { params });
        setPendingJobsData(res.data);
      } else if (activeTab === 'job-reconciliation') {
        const params: Record<string, string> = {};
        if (search.trim()) params.search = search.trim();
        if (vendorFilter !== 'all') params.vendorId = vendorFilter;
        if (statusFilter !== 'all') params.status = statusFilter;
        const res = await api.get('/reports/job-reconciliation', { params });
        setReconciliationData(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching report:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeTab, categoryFilter, statusFilter, txTypeFilter, vendorFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReportData();
  };

  // Open Single Job Reconciliation Detail
  const handleOpenJobReconciliation = async (jobId: string) => {
    setSelectedJobId(jobId);
    setShowRecModal(true);
    setJobRecLoading(true);
    try {
      const res = await api.get(`/reports/job-reconciliation/${jobId}`);
      setSingleJobRec(res.data.data);
    } catch (err: any) {
      console.error('Error fetching single job reconciliation:', err);
    } finally {
      setJobRecLoading(false);
    }
  };

  // Generic CSV Exporter
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    const timestamp = new Date().toISOString().slice(0, 10);
    let filename = `report_${activeTab}_${timestamp}.csv`;

    if (activeTab === 'component-stock') {
      headers = [
        'Part Code',
        'Name',
        'Category',
        'Package',
        'In Store Stock',
        'Reserved Stock',
        'Available Stock',
        'With Vendor Stock',
        'Unit',
        'Rate/Unit (INR)',
        'Store Valuation (INR)',
        'Status',
      ];
      rows = (componentStockData.data || []).map((c) => [
        c.partCode,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.category}"`,
        c.package,
        c.inStoreStock,
        c.reservedStock,
        c.availableStock,
        c.withVendorStock,
        c.unit,
        c.ratePerUnit,
        c.storeValuation,
        c.stockHealth,
      ]);
    } else if (activeTab === 'low-stock') {
      headers = [
        'Part Code',
        'Name',
        'Category',
        'Available Stock',
        'Min Stock Level',
        'Deficit Units',
        'Rate/Unit (INR)',
        'Estimated Reorder Cost (INR)',
      ];
      rows = (lowStockData.data || []).map((c) => [
        c.partCode,
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.category}"`,
        c.availableStock,
        c.minStock,
        c.deficit,
        c.ratePerUnit,
        c.estimatedReorderCost,
      ]);
    } else if (activeTab === 'stock-ledger') {
      headers = [
        'Date & Time',
        'Part Code',
        'Component Name',
        'Transaction Type',
        'Location',
        'Change Qty',
        'Balance After',
        'Ref No',
      ];
      rows = (ledgerData.data || []).map((tx) => [
        new Date(tx.createdAt).toISOString(),
        tx.componentId?.partCode || '-',
        `"${(tx.componentId?.name || '').replace(/"/g, '""')}"`,
        tx.type,
        tx.locationType,
        tx.qtyChange,
        tx.balanceInStoreAfter,
        tx.referenceNo || '-',
      ]);
    } else if (activeTab === 'material-with-vendors') {
      headers = ['Part Code', 'Component Name', 'Category', 'With Vendor Stock', 'Unit', 'Rate/Unit (INR)', 'Valuation (INR)'];
      rows = (vendorMaterialData.componentsWithVendors || []).map((c) => [
        c.partCode,
        `"${c.name.replace(/"/g, '""')}"`,
        c.category,
        c.withVendorStock,
        c.unit,
        c.ratePerUnit,
        c.valuation,
      ]);
    } else if (activeTab === 'pending-jobs') {
      headers = [
        'Job Number',
        'Vendor',
        'Status',
        'Target Qty',
        'Completed Good Qty',
        'Rejected Qty',
        'Pending Qty',
        'Progress %',
        'Due Date',
        'Overdue',
      ];
      rows = (pendingJobsData.data || []).map((j) => [
        j.jobNumber,
        `"${j.vendor}"`,
        j.status,
        j.totalTarget,
        j.totalGood,
        j.totalRejected,
        j.totalPending,
        `${j.overallProgress}%`,
        j.deliveryDueDate ? new Date(j.deliveryDueDate).toLocaleDateString() : 'N/A',
        j.isOverdue ? 'YES' : 'NO',
      ]);
    } else if (activeTab === 'job-reconciliation') {
      headers = ['Job Number', 'Vendor', 'Status', 'Circuits Count', 'Close Snapshot Available', 'Created At'];
      rows = (reconciliationData.data || []).map((j) => [
        j.jobNumber,
        `"${j.vendorName}"`,
        j.status,
        j.circuitsCount,
        j.hasCloseSnapshot ? 'YES' : 'NO',
        new Date(j.createdAt).toLocaleDateString(),
      ]);
    }

    if (rows.length === 0) {
      toast.warning('No data available to export for this view');
      return;
    }
    toast.info('Export started...');
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to CSV successfully');
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Reports & Analytics</h1>
            <span className="badge-status badge-status-gold text-[11px] font-mono">
              Module 11
            </span>
          </div>
          <p className="body-text text-[#6B6863] mt-1 max-w-2xl">
            Authoritative inventory valuation, stock movement audit trails, vendor floor balances, and manufacturing job reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReportData}
            disabled={loading}
            className="btn-secondary !px-3 !py-1.5 text-xs font-medium"
            title="Refresh current report"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#807365] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading}
            className="btn-secondary !px-3 !py-1.5 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5 text-[#807365]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Linear & Attio Inspired Segmented Report Tabs Bar */}
      <div className="enterprise-card p-1.5 flex flex-wrap items-center gap-1.5 bg-[#FAF9F7] border border-[#E6E3DE]">
        {[
          { id: 'component-stock', label: '1. Component Stock', icon: Cpu },
          { id: 'low-stock', label: '2. Low Stock Alerts', icon: AlertTriangle },
          { id: 'stock-ledger', label: '3. Movement Ledger', icon: History },
          { id: 'material-with-vendors', label: '4. With Vendors', icon: Truck },
          { id: 'pending-jobs', label: '5. Pending Receipts', icon: Clock },
          { id: 'job-reconciliation', label: '6. Job Reconciliation', icon: Workflow },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-[#171717] shadow-xs font-semibold border border-[#E6E3DE]'
                : 'text-[#6B6863] hover:text-[#171717] hover:bg-white/60'
            }`}
          >
            <tab.icon
              className={`w-3.5 h-3.5 ${
                activeTab === tab.id
                  ? tab.id === 'low-stock'
                    ? 'text-[#C2413A]'
                    : 'text-[#807365]'
                  : 'text-[#A69B8D]'
              }`}
            />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab-Specific Summary Cards */}
      {activeTab === 'component-stock' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Inventory Valuation"
            value={`₹${(componentStockData.summary?.totalInventoryValuation || 0).toLocaleString('en-IN')}`}
            icon={Boxes}
            subtitle="Combined store & vendor floor stock"
            badge={{ label: 'Valuation', variant: 'gold' }}
            iconColorClass="text-[#807365]"
            iconBgClass="bg-[#A69B8D]/15"
            loading={loading}
          />
          <StatCard
            title="Physical Store Stock"
            value={(componentStockData.summary?.totalInStoreStock || 0).toLocaleString()}
            icon={Cpu}
            subtitle="Units physically inside store"
            badge={{
              label: `${componentStockData.summary?.totalComponents || 0} Components`,
              variant: 'neutral',
            }}
            iconColorClass="text-[#171717]"
            iconBgClass="bg-[#171717]/10"
            loading={loading}
          />
          <StatCard
            title="Available Unreserved Stock"
            value={(componentStockData.summary?.totalAvailableStock || 0).toLocaleString()}
            icon={CheckCircle2}
            subtitle={`${(componentStockData.summary?.totalReservedStock || 0).toLocaleString()} reserved for jobs`}
            badge={{ label: 'Usable', variant: 'success' }}
            iconColorClass="text-[#168060]"
            iconBgClass="bg-[#168060]/10"
            loading={loading}
          />
          <StatCard
            title="Stock Health Issues"
            value={`${(componentStockData.summary?.lowStockCount || 0) + (componentStockData.summary?.outOfStockCount || 0)}`}
            icon={AlertTriangle}
            subtitle={`${componentStockData.summary?.outOfStockCount || 0} zero stock, ${componentStockData.summary?.lowStockCount || 0} low`}
            badge={{
              label: componentStockData.summary?.outOfStockCount > 0 ? 'Critical' : 'Attention',
              variant: 'danger',
            }}
            iconColorClass="text-[#C2413A]"
            iconBgClass="bg-[#C2413A]/10"
            loading={loading}
          />
        </div>
      )}

      {activeTab === 'low-stock' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Low Stock Components"
            value={lowStockData.summary?.totalLowStockItems || 0}
            icon={AlertTriangle}
            subtitle="Below safety threshold level"
            badge={{ label: 'Action Required', variant: 'danger' }}
            iconColorClass="text-[#C2413A]"
            iconBgClass="bg-[#C2413A]/10"
            loading={loading}
          />
          <StatCard
            title="Critical Out of Stock"
            value={lowStockData.summary?.criticalOutOfStockCount || 0}
            icon={TrendingDown}
            subtitle="Zero available store balance"
            badge={{ label: 'Stockout', variant: 'danger' }}
            iconColorClass="text-[#C2413A]"
            iconBgClass="bg-[#C2413A]/15"
            loading={loading}
          />
          <StatCard
            title="Total Deficit Units"
            value={(lowStockData.summary?.totalDeficitUnits || 0).toLocaleString()}
            icon={Boxes}
            subtitle="Units needed to reach minStock"
            badge={{ label: 'Deficit', variant: 'warning' }}
            iconColorClass="text-[#B7791F]"
            iconBgClass="bg-[#B7791F]/10"
            loading={loading}
          />
          <StatCard
            title="Estimated Reorder Budget"
            value={`₹${(lowStockData.summary?.totalReorderCost || 0).toLocaleString('en-IN')}`}
            icon={FileText}
            subtitle="Estimated cost based on unit rates"
            badge={{ label: 'Est. PO Value', variant: 'gold' }}
            iconColorClass="text-[#807365]"
            iconBgClass="bg-[#A69B8D]/15"
            loading={loading}
          />
        </div>
      )}

      {activeTab === 'stock-ledger' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Logged Transactions"
            value={ledgerData.summary?.totalTransactions || 0}
            icon={History}
            subtitle="Audit movement events"
            badge={{ label: 'Ledger Audit', variant: 'neutral' }}
            iconColorClass="text-[#171717]"
            iconBgClass="bg-[#171717]/10"
            loading={loading}
          />
          <StatCard
            title="Inward Batches"
            value={ledgerData.summary?.typeSummary?.INWARD || 0}
            icon={Boxes}
            subtitle="GIN receipts from suppliers"
            badge={{ label: 'Inwards', variant: 'success' }}
            iconColorClass="text-[#168060]"
            iconBgClass="bg-[#168060]/10"
            loading={loading}
          />
          <StatCard
            title="Vendor Issues & Consumptions"
            value={
              (ledgerData.summary?.typeSummary?.ISSUE_TO_VENDOR || 0) +
              (ledgerData.summary?.typeSummary?.CIRCUIT_CONSUMPTION || 0)
            }
            icon={Workflow}
            subtitle="Manufacturing job-work writes"
            badge={{ label: 'Production', variant: 'gold' }}
            iconColorClass="text-[#807365]"
            iconBgClass="bg-[#A69B8D]/15"
            loading={loading}
          />
        </div>
      )}

      {activeTab === 'material-with-vendors' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Component Items with Vendors"
            value={vendorMaterialData.summary?.totalComponentsWithVendors || 0}
            icon={Truck}
            subtitle="Distinct raw materials on assembly lines"
            badge={{ label: 'Floor Stock', variant: 'gold' }}
            iconColorClass="text-[#807365]"
            iconBgClass="bg-[#A69B8D]/15"
            loading={loading}
          />
          <StatCard
            title="Total Units with Vendors"
            value={(vendorMaterialData.summary?.totalUnitsWithVendors || 0).toLocaleString()}
            icon={Boxes}
            subtitle="Issued raw component units"
            badge={{ label: 'Active Jobs', variant: 'neutral' }}
            iconColorClass="text-[#171717]"
            iconBgClass="bg-[#171717]/10"
            loading={loading}
          />
          <StatCard
            title="Vendor Inventory Valuation"
            value={`₹${(vendorMaterialData.summary?.totalValuationWithVendors || 0).toLocaleString('en-IN')}`}
            icon={FileText}
            subtitle="Total value of material in assembly"
            badge={{ label: 'Capital at Risk', variant: 'warning' }}
            iconColorClass="text-[#B7791F]"
            iconBgClass="bg-[#B7791F]/10"
            loading={loading}
          />
        </div>
      )}

      {activeTab === 'pending-jobs' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            title="Active Manufacturing Jobs"
            value={pendingJobsData.summary?.totalPendingJobs || 0}
            icon={Workflow}
            subtitle="Jobs in assembly progress"
            badge={{ label: 'Active', variant: 'gold' }}
            iconColorClass="text-[#807365]"
            iconBgClass="bg-[#A69B8D]/15"
            loading={loading}
          />
          <StatCard
            title="Target Ordered Circuits"
            value={(pendingJobsData.summary?.totalTargetCircuits || 0).toLocaleString()}
            icon={Boxes}
            subtitle="Total target quantity across jobs"
            badge={{ label: 'Target', variant: 'neutral' }}
            iconColorClass="text-[#171717]"
            iconBgClass="bg-[#171717]/10"
            loading={loading}
          />
          <StatCard
            title="Completed Good Received"
            value={(pendingJobsData.summary?.totalCompletedGood || 0).toLocaleString()}
            icon={CheckCircle2}
            subtitle="Received into Finished Goods"
            badge={{ label: 'Delivered', variant: 'success' }}
            iconColorClass="text-[#168060]"
            iconBgClass="bg-[#168060]/10"
            loading={loading}
          />
          <StatCard
            title="Circuits Pending Delivery"
            value={(pendingJobsData.summary?.totalPendingCircuits || 0).toLocaleString()}
            icon={Clock}
            subtitle={`${pendingJobsData.summary?.overdueJobsCount || 0} overdue jobs`}
            badge={{
              label: pendingJobsData.summary?.overdueJobsCount > 0 ? 'Overdue Alert' : 'On Track',
              variant: pendingJobsData.summary?.overdueJobsCount > 0 ? 'danger' : 'neutral',
            }}
            iconColorClass={
              pendingJobsData.summary?.overdueJobsCount > 0 ? 'text-[#C2413A]' : 'text-[#807365]'
            }
            iconBgClass={
              pendingJobsData.summary?.overdueJobsCount > 0 ? 'bg-[#C2413A]/10' : 'bg-[#A69B8D]/15'
            }
            loading={loading}
          />
        </div>
      )}

      {activeTab === 'job-reconciliation' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard
            title="Total Audited Jobs"
            value={reconciliationData.summary?.totalJobs || 0}
            icon={Workflow}
            subtitle="Jobs with receipts or closed"
            badge={{ label: 'Audit Scope', variant: 'neutral' }}
            iconColorClass="text-[#171717]"
            iconBgClass="bg-[#171717]/10"
            loading={loading}
          />
          <StatCard
            title="Fully Reconciled & Closed"
            value={reconciliationData.summary?.closedCount || 0}
            icon={CheckCircle2}
            subtitle="Zero variance closed jobs"
            badge={{ label: 'Clean Close', variant: 'success' }}
            iconColorClass="text-[#168060]"
            iconBgClass="bg-[#168060]/10"
            loading={loading}
          />
          <StatCard
            title="Short-Closed with Variance"
            value={reconciliationData.summary?.shortClosedCount || 0}
            icon={AlertTriangle}
            subtitle="Snapshotted discrepancy reason"
            badge={{ label: 'Exception', variant: 'warning' }}
            iconColorClass="text-[#B7791F]"
            iconBgClass="bg-[#B7791F]/10"
            loading={loading}
          />
          <StatCard
            title="Active / Partial Receipts"
            value={reconciliationData.summary?.inProgressCount || 0}
            icon={Clock}
            subtitle="Receipts currently open"
            badge={{ label: 'In Progress', variant: 'gold' }}
            iconColorClass="text-[#807365]"
            iconBgClass="bg-[#A69B8D]/15"
            loading={loading}
          />
        </div>
      )}

      {/* Advanced Toolbar / Search & Filter Bar */}
      <div className="enterprise-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#807365] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={
              activeTab === 'pending-jobs' || activeTab === 'job-reconciliation'
                ? 'Search by job number...'
                : 'Search by part code, component name, reference...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise !pl-9 !h-9 text-xs w-full"
          />
        </form>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto shrink-0">
          {/* Category Filter for Component & Low Stock */}
          {(activeTab === 'component-stock' || activeTab === 'low-stock') && (
            <div className="w-48 shrink-0">
              <SimpleSelect
                value={categoryFilter}
                onValueChange={(val) => setCategoryFilter(val)}
                options={[
                  { value: 'all', label: `All Categories (${categories.length})` },
                  ...categories.map((cat) => ({ value: cat._id, label: cat.name })),
                ]}
                className="!h-9 text-xs"
              />
            </div>
          )}

          {/* Status Filter for Component Stock */}
          {activeTab === 'component-stock' && (
            <div className="w-44 shrink-0">
              <SimpleSelect
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'healthy', label: 'Healthy Stock' },
                  { value: 'low_stock', label: 'Low Stock (≤ Min)' },
                  { value: 'out_of_stock', label: 'Out of Stock (0)' },
                  { value: 'with_vendors', label: 'With Vendors Only' },
                ]}
                className="!h-9 text-xs"
              />
            </div>
          )}

          {/* Vendor Filter for Material, Pending Jobs, Reconciliation */}
          {(activeTab === 'material-with-vendors' ||
            activeTab === 'pending-jobs' ||
            activeTab === 'job-reconciliation') && (
            <div className="w-48 shrink-0">
              <SimpleSelect
                value={vendorFilter}
                onValueChange={(val) => setVendorFilter(val)}
                options={[
                  { value: 'all', label: `All Vendors (${vendors.length})` },
                  ...vendors.map((v) => ({ value: v._id, label: v.name })),
                ]}
                className="!h-9 text-xs"
              />
            </div>
          )}

          {/* Ledger Transaction Type */}
          {activeTab === 'stock-ledger' && (
            <div className="w-52 shrink-0">
              <SimpleSelect
                value={txTypeFilter}
                onValueChange={(val) => setTxTypeFilter(val)}
                options={[
                  { value: 'all', label: 'All Transaction Types' },
                  { value: 'INWARD', label: 'INWARD (GIN)' },
                  { value: 'RESERVE', label: 'RESERVE (Job Approved)' },
                  { value: 'UNRESERVE', label: 'UNRESERVE (Cancelled)' },
                  { value: 'ISSUE_TO_VENDOR', label: 'ISSUE_TO_VENDOR' },
                  { value: 'CIRCUIT_CONSUMPTION', label: 'CONSUMPTION' },
                  { value: 'RETURN_FROM_VENDOR', label: 'RETURN_FROM_VENDOR' },
                  { value: 'ADJUSTMENT', label: 'ADJUSTMENT' },
                ]}
                className="!h-9 text-xs"
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchReportData}
            className="btn-primary !h-9 !px-4 text-xs font-semibold shrink-0"
          >
            Apply
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

      {/* REPORT DATA TABLES */}

      {/* 1. Component Stock Report Table */}
      {activeTab === 'component-stock' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Part Code</th>
                  <th className="th-enterprise">Component Name</th>
                  <th className="th-enterprise">Category</th>
                  <th className="th-enterprise text-right">In Store</th>
                  <th className="th-enterprise text-right">Reserved</th>
                  <th className="th-enterprise text-right">Available</th>
                  <th className="th-enterprise text-right">With Vendor</th>
                  <th className="th-enterprise text-right">Rate/Unit</th>
                  <th className="th-enterprise text-right">Store Valuation</th>
                  <th className="th-enterprise text-center">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {loading ? (
                  <TableSkeleton rows={6} cols={10} />
                ) : componentStockData.data.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12">
                      <EmptyState
                        icon={Cpu}
                        title="No components found"
                        description="Try adjusting your category or status filters."
                      />
                    </td>
                  </tr>
                ) : (
                  componentStockData.data.map((c) => (
                    <tr key={c._id} className="tr-enterprise group">
                      <td className="td-enterprise font-mono font-bold text-[#171717]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FAF9F7] text-[#171717] border border-[#E6E3DE]">
                          {c.partCode}
                        </span>
                      </td>
                      <td className="td-enterprise">
                        <div className="font-medium text-[#171717]">{c.name}</div>
                        {c.package && c.package !== '-' && (
                          <div className="text-[11px] text-[#716B64]">{c.package}</div>
                        )}
                      </td>
                      <td className="td-enterprise text-[#716B64]">{c.category}</td>
                      <td className="td-enterprise text-right font-medium text-[#171717]">
                        {c.inStoreStock.toLocaleString()}{' '}
                        <span className="text-[10px] text-[#A69B8D]">{c.unit}</span>
                      </td>
                      <td className="td-enterprise text-right text-[#716B64]">
                        {c.reservedStock > 0 ? c.reservedStock.toLocaleString() : '-'}
                      </td>
                      <td className="td-enterprise text-right">
                        <span
                          className={`font-semibold ${
                            c.availableStock > 0 ? 'text-[#168060]' : 'text-[#C2413A]'
                          }`}
                        >
                          {c.availableStock.toLocaleString()}
                        </span>
                      </td>
                      <td className="td-enterprise text-right text-[#807365] font-medium">
                        {c.withVendorStock > 0 ? c.withVendorStock.toLocaleString() : '-'}
                      </td>
                      <td className="td-enterprise text-right text-[#716B64] font-mono">
                        ₹{c.ratePerUnit.toFixed(2)}
                      </td>
                      <td className="td-enterprise text-right font-bold text-[#171717] font-mono">
                        ₹{c.storeValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="td-enterprise text-center">
                        {c.stockHealth === 'healthy' && (
                          <span className="badge-status badge-status-success text-[10px]">
                            Healthy
                          </span>
                        )}
                        {c.stockHealth === 'low_stock' && (
                          <span className="badge-status badge-status-warning text-[10px]">
                            Low Stock
                          </span>
                        )}
                        {c.stockHealth === 'out_of_stock' && (
                          <span className="badge-status badge-status-error text-[10px]">
                            Out of Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Low Stock Alerts Report Table */}
      {activeTab === 'low-stock' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Part Code</th>
                  <th className="th-enterprise">Component Name</th>
                  <th className="th-enterprise">Category</th>
                  <th className="th-enterprise text-right">Available</th>
                  <th className="th-enterprise text-right">Min Threshold</th>
                  <th className="th-enterprise text-right">Deficit Needed</th>
                  <th className="th-enterprise text-right">Rate/Unit</th>
                  <th className="th-enterprise text-right">Est. Reorder Cost</th>
                  <th className="th-enterprise text-center">Urgency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {loading ? (
                  <TableSkeleton rows={5} cols={9} />
                ) : lowStockData.data.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12">
                      <EmptyState
                        icon={CheckCircle2}
                        title="All components meet minimum safety thresholds"
                        description="No components currently require immediate purchase reorders."
                      />
                    </td>
                  </tr>
                ) : (
                  lowStockData.data.map((c) => (
                    <tr key={c._id} className="tr-enterprise group">
                      <td className="td-enterprise font-mono font-bold text-[#171717]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FAF9F7] text-[#171717] border border-[#E6E3DE]">
                          {c.partCode}
                        </span>
                      </td>
                      <td className="td-enterprise">
                        <div className="font-medium text-[#171717]">{c.name}</div>
                        <div className="text-[11px] text-[#716B64]">{c.package}</div>
                      </td>
                      <td className="td-enterprise text-[#716B64]">{c.category}</td>
                      <td className="td-enterprise text-right">
                        <span
                          className={`font-semibold ${
                            c.availableStock === 0 ? 'text-[#C2413A]' : 'text-[#B7791F]'
                          }`}
                        >
                          {c.availableStock.toLocaleString()} {c.unit}
                        </span>
                      </td>
                      <td className="td-enterprise text-right text-[#716B64] font-medium">
                        {c.minStock.toLocaleString()} {c.unit}
                      </td>
                      <td className="td-enterprise text-right font-bold text-[#C2413A]">
                        +{c.deficit.toLocaleString()} {c.unit}
                      </td>
                      <td className="td-enterprise text-right text-[#716B64] font-mono">
                        ₹{c.ratePerUnit.toFixed(2)}
                      </td>
                      <td className="td-enterprise text-right font-bold text-[#171717] font-mono">
                        ₹{c.estimatedReorderCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="td-enterprise text-center">
                        {c.isCritical ? (
                          <span className="badge-status badge-status-error text-[10px]">
                            CRITICAL (0)
                          </span>
                        ) : (
                          <span className="badge-status badge-status-warning text-[10px]">
                            REORDER
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. Stock Movement Ledger Report Table */}
      {activeTab === 'stock-ledger' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Timestamp</th>
                  <th className="th-enterprise">Component</th>
                  <th className="th-enterprise">Transaction Type</th>
                  <th className="th-enterprise">Location</th>
                  <th className="th-enterprise text-right">Quantity Change</th>
                  <th className="th-enterprise text-right">Store Balance</th>
                  <th className="th-enterprise">Reference / No</th>
                  <th className="th-enterprise">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {loading ? (
                  <TableSkeleton rows={6} cols={8} />
                ) : ledgerData.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={History}
                        title="No stock transactions found"
                        description="Try widening your date range or clearing transaction type filters."
                      />
                    </td>
                  </tr>
                ) : (
                  ledgerData.data.map((tx) => (
                    <tr key={tx._id} className="tr-enterprise group">
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
                        <span className="font-mono font-bold text-[#171717]">
                          {tx.componentId?.partCode || '-'}
                        </span>
                        <div className="text-[10px] text-[#716B64] truncate max-w-[140px]">
                          {tx.componentId?.name}
                        </div>
                      </td>
                      <td className="td-enterprise">
                        <span
                          className={`badge-status text-[10px] ${
                            tx.type === 'INWARD'
                              ? 'badge-status-success'
                              : tx.type === 'RESERVE' || tx.type === 'ISSUE_TO_VENDOR'
                              ? 'badge-status-gold'
                              : tx.type === 'CIRCUIT_CONSUMPTION'
                              ? 'badge-status-neutral'
                              : 'badge-status-warning'
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="td-enterprise font-medium text-[#716B64]">{tx.locationType}</td>
                      <td className="td-enterprise text-right font-mono font-bold">
                        <span className={tx.qtyChange > 0 ? 'text-[#168060]' : 'text-[#C2413A]'}>
                          {tx.qtyChange > 0 ? `+${tx.qtyChange}` : tx.qtyChange}
                        </span>
                      </td>
                      <td className="td-enterprise text-right font-mono font-semibold text-[#171717]">
                        {tx.balanceInStoreAfter?.toLocaleString() ?? '-'}
                      </td>
                      <td className="td-enterprise font-mono text-[#171717]">
                        {tx.referenceNo || '-'}
                      </td>
                      <td className="td-enterprise text-[#716B64]">{tx.createdById?.name || 'System'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Material With Vendors Report Table */}
      {activeTab === 'material-with-vendors' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Part Code</th>
                  <th className="th-enterprise">Raw Component Name</th>
                  <th className="th-enterprise">Category</th>
                  <th className="th-enterprise text-right">Floor Stock</th>
                  <th className="th-enterprise text-right">Unit Rate</th>
                  <th className="th-enterprise text-right">Held Valuation</th>
                  <th className="th-enterprise text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {loading ? (
                  <TableSkeleton rows={5} cols={7} />
                ) : vendorMaterialData.componentsWithVendors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        icon={Truck}
                        title="No material currently held with vendors"
                        description="All issued manufacturing batches have been completely reconciled or returned."
                      />
                    </td>
                  </tr>
                ) : (
                  vendorMaterialData.componentsWithVendors.map((c) => (
                    <tr key={c._id} className="tr-enterprise group">
                      <td className="td-enterprise font-mono font-bold text-[#171717]">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#FAF9F7] text-[#171717] border border-[#E6E3DE]">
                          {c.partCode}
                        </span>
                      </td>
                      <td className="td-enterprise">
                        <div className="font-medium text-[#171717]">{c.name}</div>
                      </td>
                      <td className="td-enterprise text-[#716B64]">{c.category}</td>
                      <td className="td-enterprise text-right font-bold text-[#807365]">
                        {c.withVendorStock.toLocaleString()} {c.unit}
                      </td>
                      <td className="td-enterprise text-right font-mono text-[#716B64]">
                        ₹{c.ratePerUnit.toFixed(2)}
                      </td>
                      <td className="td-enterprise text-right font-mono font-bold text-[#171717]">
                        ₹{c.valuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="td-enterprise text-center">
                        <span className="badge-status badge-status-gold text-[10px]">
                          On Vendor Assembly Floor
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Pending Job Receipts Report Table */}
      {activeTab === 'pending-jobs' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Job Number</th>
                  <th className="th-enterprise">Vendor Assembler</th>
                  <th className="th-enterprise text-center">Status</th>
                  <th className="th-enterprise text-right">Target Qty</th>
                  <th className="th-enterprise text-right">Received</th>
                  <th className="th-enterprise text-right">Pending</th>
                  <th className="th-enterprise">Progress</th>
                  <th className="th-enterprise text-center">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {loading ? (
                  <TableSkeleton rows={5} cols={8} />
                ) : pendingJobsData.data.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={CheckCircle2}
                        title="No pending job receipts"
                        description="All manufacturing jobs are fully received or no active production runs found."
                      />
                    </td>
                  </tr>
                ) : (
                  pendingJobsData.data.map((j) => (
                    <tr key={j._id} className="tr-enterprise group">
                      <td className="td-enterprise font-mono font-bold text-[#807365]">
                        {j.jobNumber}
                      </td>
                      <td className="td-enterprise">
                        <div className="font-medium text-[#171717]">{j.vendor}</div>
                      </td>
                      <td className="td-enterprise text-center">
                        <span
                          className={`badge-status text-[10px] ${
                            j.status === 'partially_received'
                              ? 'badge-status-gold'
                              : j.status === 'material_issued'
                              ? 'badge-status-neutral'
                              : 'badge-status-warning'
                          }`}
                        >
                          {j.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="td-enterprise text-right font-medium text-[#171717]">
                        {j.totalTarget.toLocaleString()}
                      </td>
                      <td className="td-enterprise text-right font-semibold text-[#168060]">
                        {j.totalGood.toLocaleString()}
                      </td>
                      <td className="td-enterprise text-right font-bold text-[#807365]">
                        {j.totalPending.toLocaleString()}
                      </td>
                      <td className="td-enterprise">
                        <div className="w-full bg-[#E7E4DE] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#168060] h-1.5 rounded-full transition-all"
                            style={{ width: `${j.overallProgress}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[#716B64] mt-0.5 text-right font-medium">
                          {j.overallProgress}%
                        </div>
                      </td>
                      <td className="td-enterprise text-center text-xs">
                        {j.deliveryDueDate ? (
                          <span
                            className={
                              j.isOverdue ? 'text-[#C2413A] font-bold' : 'text-[#716B64]'
                            }
                          >
                            {new Date(j.deliveryDueDate).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-[#A69B8D]">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Job Reconciliation Audit Report Table */}
      {activeTab === 'job-reconciliation' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Job Number</th>
                  <th className="th-enterprise">Vendor Assembler</th>
                  <th className="th-enterprise text-center">Status</th>
                  <th className="th-enterprise text-center">Circuits</th>
                  <th className="th-enterprise text-center">Audit Snapshot</th>
                  <th className="th-enterprise text-center">Date</th>
                  <th className="th-enterprise text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {loading ? (
                  <TableSkeleton rows={5} cols={7} />
                ) : reconciliationData.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        icon={Workflow}
                        title="No jobs found for reconciliation audit"
                        description="Try clearing search filters."
                      />
                    </td>
                  </tr>
                ) : (
                  reconciliationData.data.map((j) => (
                    <tr key={j._id} className="tr-enterprise group">
                      <td className="td-enterprise font-mono font-bold text-[#807365]">
                        {j.jobNumber}
                      </td>
                      <td className="td-enterprise font-medium text-[#171717]">{j.vendorName}</td>
                      <td className="td-enterprise text-center">
                        <span
                          className={`badge-status text-[10px] ${
                            j.status === 'closed' && !j.isShortClosed
                              ? 'badge-status-success'
                              : j.status === 'closed' && j.isShortClosed
                              ? 'badge-status-warning'
                              : 'badge-status-gold'
                          }`}
                        >
                          {j.status === 'closed' && j.isShortClosed ? 'short closed' : j.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="td-enterprise text-center font-medium text-[#171717]">
                        {j.circuitsCount}
                      </td>
                      <td className="td-enterprise text-center">
                        {j.hasCloseSnapshot ? (
                          <span className="badge-status badge-status-neutral text-[10px] font-mono">
                            Frozen Snapshot
                          </span>
                        ) : (
                          <span className="badge-status badge-status-gold text-[10px]">
                            Live Computed
                          </span>
                        )}
                      </td>
                      <td className="td-enterprise text-center text-xs text-[#716B64]">
                        {new Date(j.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="td-enterprise text-right">
                        <button
                          onClick={() => handleOpenJobReconciliation(j._id)}
                          className="btn-secondary !px-2.5 !py-1 text-xs font-medium"
                          title="View complete component BOM variance"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#807365]" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Advanced Enterprise Reports Roadmap Section */}
      <div className="enterprise-card p-5 bg-[#FAF9F7]/70 border border-[#E6E3DE]">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#807365] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#171717]">
              Enterprise Advanced Reports Roadmap
            </h4>
            <p className="text-xs text-[#716B64]">
              The 6 operational reports above utilize authoritative database models, real ledger transactions, and job reconciliation algorithms. The following advanced analytical modules are designated for Phase 2:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-[10px] bg-white border border-[#E6E3DE]">
                <div className="font-semibold text-xs text-[#171717]">WIP Valuation & Cost Accounting</div>
                <div className="text-[11px] text-[#716B64] mt-1">
                  Capital locked in floor WIP, labor overhead absorption, and standard vs actual BOM variance.
                </div>
              </div>
              <div className="p-3.5 rounded-[10px] bg-white border border-[#E6E3DE]">
                <div className="font-semibold text-xs text-[#171717]">Vendor Defect & Scrap Analytics</div>
                <div className="text-[11px] text-[#716B64] mt-1">
                  Assembler PPM defect rates, component attrition benchmarking, and inspection pass yields.
                </div>
              </div>
              <div className="p-3.5 rounded-[10px] bg-white border border-[#E6E3DE]">
                <div className="font-semibold text-xs text-[#171717]">Component Aging & Dead Stock</div>
                <div className="text-[11px] text-[#716B64] mt-1">
                  FIFO shelf-life analysis, non-moving component write-downs, and inventory turns ratio.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Job Reconciliation Detail */}
      <Modal
        isOpen={showRecModal}
        onClose={() => setShowRecModal(false)}
        title={
          singleJobRec ? (
            <div className="flex items-center gap-2">
              <span>Job Reconciliation:</span>
              <span className="font-mono text-[#807365]">{singleJobRec.job?.jobNumber}</span>
              <span className="badge-status badge-status-gold text-[11px]">
                {singleJobRec.job?.status}
              </span>
            </div>
          ) : (
            'Job Material Reconciliation'
          )
        }
        subtitle="Component-by-component Planned vs Issued vs Consumed vs Returned vs Damaged vs Variance"
        icon={<Workflow className="w-5 h-5 text-[#807365]" />}
        size="2xl"
      >
        {jobRecLoading ? (
          <div className="py-12">
            <TableSkeleton rows={5} cols={8} />
          </div>
        ) : !singleJobRec ? (
          <div className="py-8 text-center text-xs text-[#716B64]">
            Unable to compute reconciliation for this job.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Eligibility Banner */}
            <div
              className={`p-3 rounded-[10px] border text-xs flex items-center justify-between ${
                singleJobRec.reconciliation?.closeEligible
                  ? 'bg-[#168060]/10 border-[#168060]/20 text-[#168060]'
                  : 'bg-[#B7791F]/10 border-[#B7791F]/20 text-[#B7791F]'
              }`}
            >
              <div className="flex items-center gap-2">
                {singleJobRec.reconciliation?.closeEligible ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span className="font-semibold">
                  {singleJobRec.reconciliation?.closeEligible
                    ? 'Job is fully reconciled and eligible for regular closing.'
                    : 'Job has outstanding material balances or pending circuit receipts.'}
                </span>
              </div>
              <span className="text-[11px]">
                {singleJobRec.reconciliation?.circuits?.length || 0} circuit recipes
              </span>
            </div>

            {/* Components Reconciliation Table */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#171717] mb-2">
                Component Material Balance Breakdown
              </h4>
              <div className="enterprise-card overflow-hidden">
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#FAF9F7] z-10">
                      <tr>
                        <th className="th-enterprise">Part Code</th>
                        <th className="th-enterprise">Name</th>
                        <th className="th-enterprise text-right">Issued</th>
                        <th className="th-enterprise text-right">Consumed</th>
                        <th className="th-enterprise text-right">Returned</th>
                        <th className="th-enterprise text-right">Damaged</th>
                        <th className="th-enterprise text-right">Remaining w/ Vendor</th>
                        <th className="th-enterprise text-center">Ledger Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E3DE]">
                      {(singleJobRec.reconciliation?.components || []).map((c: any) => (
                        <tr key={c.componentId} className="tr-enterprise">
                          <td className="td-enterprise font-mono font-bold text-[#171717]">
                            {c.partCode}
                          </td>
                          <td className="td-enterprise text-[#171717]">{c.name}</td>
                          <td className="td-enterprise text-right font-semibold text-[#171717]">
                            {c.issuedQty}
                          </td>
                          <td className="td-enterprise text-right text-[#168060] font-medium">
                            {c.consumedQty}
                          </td>
                          <td className="td-enterprise text-right text-[#807365]">{c.returnedQty}</td>
                          <td className="td-enterprise text-right text-[#C2413A]">
                            {c.damagedQty > 0 ? c.damagedQty : '-'}
                          </td>
                          <td className="td-enterprise text-right font-mono font-bold">
                            <span className={c.remainingWithVendor > 0 ? 'text-[#B7791F]' : 'text-[#168060]'}>
                              {c.remainingWithVendor > 0 ? c.remainingWithVendor : '0'}
                            </span>
                          </td>
                          <td className="td-enterprise text-center">
                            {c.ledgerDiscrepancy === 0 ? (
                              <span className="badge-status badge-status-success text-[10px]">Matches</span>
                            ) : (
                              <span
                                className="badge-status badge-status-error text-[10px]"
                                title={`Ledger discrepancy: ${c.ledgerDiscrepancy}`}
                              >
                                Mismatch
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#716B64] pt-2 border-t border-[#E7E4DE]">
              <span>Authoritative job-work reconciliation calculation snapshot</span>
              <button
                type="button"
                onClick={() => setShowRecModal(false)}
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
