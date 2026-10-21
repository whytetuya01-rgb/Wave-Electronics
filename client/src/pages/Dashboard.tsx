import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StatCard } from '../components/ui/StatCard';
import { DashboardSkeleton } from '../components/ui/Loading';
import {
  Cpu,
  AlertTriangle,
  FolderTree,
  DollarSign,
  ArrowRight,
  Plus,
  PackageCheck,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Workflow,
  Package,
  History,
  CalendarClock,
  LayoutDashboard,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState({
    totalComponents: 0,
    lowStockCount: 0,
    categoriesCount: 0,
    locationsCount: 0,
    inventoryValuation: 0,
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  const [jobStats, setJobStats] = useState({ openJobsCount: 0, draftJobsCount: 0, overdueOpenJobs: 0 });
  const [vendorStats, setVendorStats] = useState({ totalUnitsWithVendors: 0, totalValuationWithVendors: 0, activeJobsHoldingMaterial: 0 });
  const [pendingSummary, setPendingSummary] = useState({ totalPendingJobs: 0, overdueJobsCount: 0 });
  const [overdueByVendor, setOverdueByVendor] = useState<{ vendor: string; jobs: any[] }[]>([]);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const [compRes, catRes, locRes, lowRes, jobSummaryRes, vendorMaterialRes, pendingJobsRes, ledgerRes] = await Promise.all([
        api.get('/components?limit=200'),
        api.get('/masters/categories'),
        api.get('/masters/locations'),
        api.get('/components?lowStockOnly=true'),
        api.get('/jobs/stats/summary'),
        api.get('/reports/material-with-vendors'),
        api.get('/reports/pending-jobs'),
        api.get('/reports/stock-ledger?limit=10'),
      ]);

      const components = compRes.data.data || [];
      const valuation = components.reduce(
        (sum: number, c: any) => sum + (c.inStoreStock || 0) * (c.ratePerUnit || 0),
        0
      );

      setStats({
        totalComponents: compRes.data.meta?.total || components.length,
        lowStockCount: lowRes.data.meta?.total || lowRes.data.data?.length || 0,
        categoriesCount: catRes.data.length || 0,
        locationsCount: locRes.data.length || 0,
        inventoryValuation: valuation,
      });

      setLowStockItems(lowRes.data.data || []);

      setJobStats({
        openJobsCount: jobSummaryRes.data.openJobsCount || 0,
        draftJobsCount: jobSummaryRes.data.draftJobsCount || 0,
        overdueOpenJobs: jobSummaryRes.data.overdueOpenJobs || 0,
      });

      setVendorStats({
        totalUnitsWithVendors: vendorMaterialRes.data.summary?.totalUnitsWithVendors || 0,
        totalValuationWithVendors: vendorMaterialRes.data.summary?.totalValuationWithVendors || 0,
        activeJobsHoldingMaterial: vendorMaterialRes.data.summary?.activeJobsHoldingMaterial || 0,
      });

      setPendingSummary({
        totalPendingJobs: pendingJobsRes.data.summary?.totalPendingJobs || 0,
        overdueJobsCount: pendingJobsRes.data.summary?.overdueJobsCount || 0,
      });

      const overdueJobs = (pendingJobsRes.data.data || []).filter((j: any) => j.isOverdue);
      const grouped = new Map<string, any[]>();
      overdueJobs.forEach((j: any) => {
        const key = j.vendor || 'Unknown Vendor';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(j);
      });
      setOverdueByVendor(Array.from(grouped.entries()).map(([vendor, jobs]) => ({ vendor, jobs })));

      setRecentMovements(ledgerRes.data.data || []);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setErrorMsg(error.response?.data?.message || 'Failed to load dashboard data. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3.5 bg-[#C2413A]/10 border border-[#C2413A]/25 rounded-[10px] text-sm text-[#C2413A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C2413A] shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-[#C2413A]/60 hover:text-[#C2413A] p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <PageHeader
        icon={LayoutDashboard}
        title="Executive Dashboard"
        description="Operational component stock balances, inventory valuation, and warehouse status."
        actions={
          <>
            <Link to="/stock-inward" className="btn-secondary">
              <PackageCheck className="w-4 h-4 text-[#807365]" />
              <span>Stock Inward</span>
            </Link>
            <Link to="/vendors" className="btn-secondary">
              <Truck className="w-4 h-4 text-[#807365]" />
              <span>Assemblers</span>
            </Link>
            <Link to="/components?action=new" className="btn-primary">
              <Plus className="w-4 h-4" />
              <span>Add Component</span>
            </Link>
          </>
        }
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Catalog Items"
          value={stats.totalComponents}
          icon={Cpu}
          subtitle={`Across ${stats.categoriesCount} categories`}
          iconBgClass="bg-[#A69B8D]/15"
          iconColorClass="text-[#807365]"
          badge={{ label: 'Catalog', variant: 'gold' }}
          loading={loading}
          staggerIndex={0}
        />
        <StatCard
          title="Low Stock Warnings"
          value={stats.lowStockCount}
          icon={AlertTriangle}
          subtitle="Below safety threshold"
          iconBgClass={stats.lowStockCount > 0 ? 'bg-[#B7791F]/10' : 'bg-[#168060]/10'}
          iconColorClass={stats.lowStockCount > 0 ? 'text-[#B7791F]' : 'text-[#168060]'}
          badge={{
            label: stats.lowStockCount > 0 ? 'Restock' : 'Optimal',
            variant: stats.lowStockCount > 0 ? 'warning' : 'success',
          }}
          loading={loading}
          staggerIndex={1}
        />
        <StatCard
          title="Store Valuation"
          value={`₹${stats.inventoryValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          subtitle="Total in-store inventory assets"
          iconBgClass="bg-[#168060]/10"
          iconColorClass="text-[#168060]"
          badge={{ label: 'Live Rates', variant: 'success' }}
          loading={loading}
          staggerIndex={2}
        />
        <StatCard
          title="Warehouse Bins"
          value={stats.locationsCount}
          icon={FolderTree}
          subtitle="Rack and bin storage codes"
          iconBgClass="bg-[#F7F6F3]"
          iconColorClass="text-[#6B6863]"
          badge={{ label: 'Organized', variant: 'neutral' }}
          loading={loading}
          staggerIndex={3}
        />
      </div>

      {/* Job & Vendor Monitoring KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link to="/jobs" className="block h-full">
          <StatCard
            title="Open Jobs"
            value={jobStats.openJobsCount}
            icon={Workflow}
            subtitle={`${jobStats.draftJobsCount} in draft`}
            iconBgClass="bg-[#A69B8D]/15"
            iconColorClass="text-[#807365]"
            loading={loading}
          />
        </Link>
        <Link to="/reports" className="block h-full">
          <StatCard
            title="Material With Vendors"
            value={`${vendorStats.totalUnitsWithVendors.toLocaleString()} pcs`}
            icon={Package}
            subtitle={`₹${vendorStats.totalValuationWithVendors.toLocaleString('en-IN', { maximumFractionDigits: 0 })} held across ${vendorStats.activeJobsHoldingMaterial} job(s)`}
            iconBgClass="bg-[#F7F6F3]"
            iconColorClass="text-[#6B6863]"
            loading={loading}
          />
        </Link>
        <Link to="/reports" className="block h-full">
          <StatCard
            title="Pending Finished Receipts"
            value={pendingSummary.totalPendingJobs}
            icon={Clock}
            subtitle="Jobs awaiting circuits from vendor"
            iconBgClass="bg-[#B7791F]/10"
            iconColorClass="text-[#B7791F]"
            loading={loading}
          />
        </Link>
        <StatCard
          title="Overdue Jobs"
          value={jobStats.overdueOpenJobs}
          icon={CalendarClock}
          subtitle="Past target date, not yet closed"
          iconBgClass={jobStats.overdueOpenJobs > 0 ? 'bg-[#C2413A]/10' : 'bg-[#168060]/10'}
          iconColorClass={jobStats.overdueOpenJobs > 0 ? 'text-[#C2413A]' : 'text-[#168060]'}
          badge={
            jobStats.overdueOpenJobs > 0
              ? { label: 'Follow Up', variant: 'danger' }
              : { label: 'On Track', variant: 'success' }
          }
          loading={loading}
        />
      </div>

      {/* Overdue Jobs Grouped By Vendor */}
      {overdueByVendor.length > 0 && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E3DE] flex items-center gap-2.5 bg-white">
            <span className="w-2 h-2 rounded-full bg-[#C2413A]" />
            <h2 className="text-sm font-semibold text-[#171717] tracking-tight">
              Overdue Jobs By Vendor (Past Target Date)
            </h2>
          </div>
          <div className="divide-y divide-[#E6E3DE]/60">
            {overdueByVendor.map((group) => (
              <div key={group.vendor} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium text-[#171717]">
                  <Truck className="w-4 h-4 text-[#A69B8D]" />
                  {group.vendor}
                  <span className="text-xs text-[#6B6863] font-normal">({group.jobs.length} job(s))</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.jobs.map((j: any) => (
                    <Link
                      key={j._id}
                      to="/jobs"
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#C2413A]/10 text-[#C2413A] border border-[#C2413A]/25 hover:bg-[#C2413A]/20 transition-colors"
                      title={`Due ${j.deliveryDueDate ? new Date(j.deliveryDueDate).toLocaleDateString() : ''}`}
                    >
                      {j.jobNumber}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Stock Movements */}
      {recentMovements.length > 0 && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E3DE] flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <History className="w-4 h-4 text-[#807365]" />
              <h2 className="text-sm font-semibold text-[#171717] tracking-tight">Recent Stock Movements</h2>
            </div>
            <Link
              to="/reports"
              className="text-xs font-medium text-[#141414] hover:text-[#807365] flex items-center gap-1 transition-colors"
            >
              <span>View Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Date</th>
                  <th className="th-enterprise">Component</th>
                  <th className="th-enterprise">Type</th>
                  <th className="th-enterprise text-right">Qty Change</th>
                  <th className="th-enterprise">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]/60">
                {recentMovements.map((tx: any) => (
                  <tr key={tx._id} className="tr-enterprise">
                    <td className="td-enterprise text-[12px] text-[#6B6863] whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="td-enterprise font-mono text-[12px] text-[#171717]">
                      {tx.componentId?.partCode || '—'}
                    </td>
                    <td className="td-enterprise">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#383531] border border-[#E6E3DE]">
                        {tx.type}
                      </span>
                    </td>
                    <td
                      className={`td-enterprise text-right font-mono font-semibold ${
                        tx.qtyChange > 0 ? 'text-[#168060]' : tx.qtyChange < 0 ? 'text-[#C2413A]' : 'text-[#6B6863]'
                      }`}
                    >
                      {tx.qtyChange > 0 ? '+' : ''}
                      {tx.qtyChange}
                    </td>
                    <td className="td-enterprise text-[12px] text-[#6B6863]">{tx.referenceNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Critical Stock Warning Table */}
      {lowStockItems.length > 0 && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E3DE] flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#B7791F]" />
              <h2 className="text-sm font-semibold text-[#171717] tracking-tight">
                Items Requiring Stock Replenishment (Below Safety Level)
              </h2>
            </div>
            <Link
              to="/stock-inward"
              className="text-xs font-medium text-[#141414] hover:text-[#807365] flex items-center gap-1 transition-colors"
            >
              <span>Create Inward Entry</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Part Code</th>
                  <th className="th-enterprise">Component Name</th>
                  <th className="th-enterprise">Category</th>
                  <th className="th-enterprise text-right">In-Store Stock</th>
                  <th className="th-enterprise text-right">Min Stock</th>
                  <th className="th-enterprise">Location</th>
                  <th className="th-enterprise text-center">Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]/60">
                {lowStockItems.map((item) => (
                  <tr key={item._id} className="tr-enterprise">
                    <td className="td-enterprise font-mono font-semibold text-[#171717]">
                      {item.partCode}
                    </td>
                    <td className="td-enterprise font-medium text-[#171717] max-w-sm truncate">
                      {item.name}
                    </td>
                    <td className="td-enterprise text-[#6B6863]">
                      {item.categoryId?.name || '—'}
                    </td>
                    <td className="td-enterprise text-right font-mono font-bold text-[#C2413A]">
                      {item.inStoreStock} <span className="text-[11px] text-[#A69B8D] font-normal">{item.unitId?.shortCode}</span>
                    </td>
                    <td className="td-enterprise text-right font-mono text-[#6B6863]">
                      {item.minStock}
                    </td>
                    <td className="td-enterprise text-[#6B6863]">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#383531] border border-[#E6E3DE]">
                        {item.locationId?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td className="td-enterprise text-center font-mono">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/25">
                        -{item.minStock - item.inStoreStock} units
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enterprise Manufacturing Lifecycle Workflow */}
      <div className="enterprise-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[#E6E3DE]">
          <div>
            <h3 className="section-heading text-[16px] text-[#171717]">Manufacturing & Job-Work Operations Lifecycle</h3>
            <p className="helper-text mt-0.5 text-[#6B6863]">
              End-to-end component traceability from supplier inward to finished goods receipt.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-medium bg-[#168060]/10 text-[#168060] border border-[#168060]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#168060]" />
            System Live
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {/* Stage 1 */}
          <div className="p-4 rounded-xl border border-[#E6E3DE] bg-white hover:border-[#D8D4CE] transition-all">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#171717]">1. Component Masters</span>
              <CheckCircle2 className="w-4 h-4 text-[#168060]" />
            </div>
            <p className="text-xs text-[#6B6863] leading-relaxed">
              Standardized parts catalog, unit conversions, and rack/bin storage coordinates.
            </p>
          </div>

          {/* Stage 2 */}
          <div className="p-4 rounded-xl border border-[#807365]/30 bg-[#F7F6F3]/60 hover:border-[#807365]/50 transition-all">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#171717]">2. Procurement & GIN</span>
              <CheckCircle2 className="w-4 h-4 text-[#168060]" />
            </div>
            <p className="text-xs text-[#6B6863] leading-relaxed">
              Goods Inward Notes, supplier invoices, store inventory auto-replenishment, and ledger audit trail.
            </p>
          </div>

          {/* Stage 3 */}
          <div className="p-4 rounded-xl border border-[#E6E3DE] bg-white hover:border-[#D8D4CE] transition-all">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#171717]">3. Assembler Partners</span>
              <CheckCircle2 className="w-4 h-4 text-[#168060]" />
            </div>
            <p className="text-xs text-[#6B6863] leading-relaxed">
              Verified job-work assembly vendors, GST profiles, labor rates, and held-material balance tracking.
            </p>
          </div>

          {/* Stage 4 */}
          <div className="p-4 rounded-xl border border-[#E6E3DE] bg-white hover:border-[#D8D4CE] transition-all">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#171717]">4. Circuit BOM & Jobs</span>
              <Clock className="w-4 h-4 text-[#A69B8D]" />
            </div>
            <p className="text-xs text-[#6B6863] leading-relaxed">
              Recipe component lists, bottleneck detection, material dispatch challans, and stock reservation.
            </p>
          </div>

          {/* Stage 5 */}
          <div className="p-4 rounded-xl border border-[#E6E3DE] bg-white hover:border-[#D8D4CE] transition-all">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#171717]">5. Receipt & Audit</span>
              <Clock className="w-4 h-4 text-[#A69B8D]" />
            </div>
            <p className="text-xs text-[#6B6863] leading-relaxed">
              Finished PCB assembly receipt, good/defect classification, parts reconciliation, and closure locking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
