import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import {
  Workflow,
  Plus,
  Search,
  Eye,
  Edit2,
  Ban,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Trash,
  Truck,
  CalendarClock,
  Layers,
  PackageCheck,
  CheckCheck,
  Receipt,
  FileCheck2,
} from 'lucide-react';

interface VendorOption {
  _id: string;
  name: string;
  city: string;
  isActive: boolean;
}

interface CircuitOption {
  _id: string;
  circuitCode: string;
  name: string;
  version: string;
  isActive: boolean;
  bomItemCount: number;
}

interface JobCircuitRow {
  circuitId: string;
  orderedQty: number;
}

interface IssueRow {
  componentId: string;
  partCode: string;
  name: string;
  remaining: number;
  qtyToIssue: number;
}

interface ReceiveRow {
  componentId: string;
  partCode: string;
  name: string;
  remaining: number;
  receivedQty: number;
  damagedQty: number;
}

interface ChallanSummary {
  _id: string;
  challanNumber: string;
  challanDate: string;
  items: Array<{
    componentId: string;
    partCode: string;
    name: string;
    issuedQty: number;
    receivedQty: number;
    damagedQty: number;
  }>;
  status: 'issued' | 'partially_received' | 'received';
  notes?: string;
  issuedBy?: { name: string };
  receivedBy?: { name: string };
}

interface JobListItem {
  _id: string;
  jobNumber: string;
  jobDate: string;
  targetDate?: string;
  vendorId: VendorOption;
  jobCircuits: Array<{
    circuitId: string;
    circuitCode: string;
    name: string;
    version: string;
    orderedQty: number;
  }>;
  status: 'draft' | 'approved' | 'material_issued' | 'partially_received' | 'closed' | 'cancelled';
  totalOrderedQty: number;
  totalEstimatedCost: number;
  hasShortage: boolean;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'gold' | 'neutral'> = {
  draft: 'neutral',
  approved: 'gold',
  material_issued: 'warning',
  partially_received: 'warning',
  closed: 'success',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  material_issued: 'Material Issued',
  partially_received: 'Partially Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const CHALLAN_STATUS_LABEL: Record<string, string> = {
  issued: 'Awaiting Receipt',
  partially_received: 'Partially Received',
  received: 'Fully Received',
};

export const Jobs: React.FC = () => {
  const { isAdmin, isProduction, isStoreKeeper } = useAuth();
  const canEdit = isAdmin || isProduction;

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [circuits, setCircuits] = useState<CircuitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  // Confirm dialog states
  const [confirmApproveJob, setConfirmApproveJob] = useState<JobListItem | null>(null);
  const [confirmCancelJob, setConfirmCancelJob] = useState<JobListItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Material Issue
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueJob, setIssueJob] = useState<JobListItem | null>(null);
  const [issueRows, setIssueRows] = useState<IssueRow[]>([]);
  const [issueIdempotencyKey, setIssueIdempotencyKey] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [jobChallans, setJobChallans] = useState<ChallanSummary[]>([]);

  // Material Receive
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveChallan, setReceiveChallan] = useState<any>(null);
  const [receiveRows, setReceiveRows] = useState<ReceiveRow[]>([]);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receiveIdempotencyKey, setReceiveIdempotencyKey] = useState('');
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);
  const [receiveError, setReceiveError] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobListItem | null>(null);
  const [detailedJob, setDetailedJob] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({ vendorId: '', targetDate: '', remarks: '' });
  const [jobCircuitRows, setJobCircuitRows] = useState<JobCircuitRow[]>([{ circuitId: '', orderedQty: 1 }]);
  const [circuitDetailCache, setCircuitDetailCache] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchVendors();
    fetchCircuits();
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [search, statusFilter]);

  const fetchVendors = async () => {
    try {
      const res = await api.get('/vendors', { params: { status: 'active' } });
      setVendors(res.data.data);
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const fetchCircuits = async () => {
    try {
      const res = await api.get('/circuits', { params: { status: 'active', limit: 200 } });
      setCircuits(res.data.data);
    } catch (err) {
      console.error('Failed to load circuits:', err);
    }
  };

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/jobs', { params });
      setJobs(res.data.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  };

  const fetchCircuitDetail = async (circuitId: string) => {
    if (!circuitId || circuitDetailCache[circuitId]) return;
    try {
      const res = await api.get(`/circuits/${circuitId}`);
      setCircuitDetailCache((prev) => ({ ...prev, [circuitId]: res.data.data }));
    } catch (err) {
      console.error('Failed to load circuit detail for preview:', err);
    }
  };

  // Preview BOM aggregation for Create/Edit Job
  const aggregatedBomPreview = useMemo(() => {
    const map = new Map<
      string,
      {
        partCode: string;
        name: string;
        totalRequired: number;
        availableStock: number;
        ratePerUnit: number;
      }
    >();

    for (const row of jobCircuitRows) {
      if (!row.circuitId || row.orderedQty <= 0) continue;
      const circuit = circuitDetailCache[row.circuitId];
      if (!circuit || !circuit.bomItems) continue;

      for (const item of circuit.bomItems) {
        const comp = item.componentId;
        const compId = typeof comp === 'object' ? comp._id : comp;
        const partCode = typeof comp === 'object' ? comp.partCode : item.partCode || '—';
        const name = typeof comp === 'object' ? comp.name : item.name || '—';
        const availableStock = typeof comp === 'object' ? comp.availableStock ?? 0 : 0;
        const ratePerUnit = typeof comp === 'object' ? comp.ratePerUnit ?? 0 : 0;
        const req = (item.qtyPerUnit || 1) * row.orderedQty;

        if (map.has(compId)) {
          const existing = map.get(compId)!;
          existing.totalRequired += req;
        } else {
          map.set(compId, {
            partCode,
            name,
            totalRequired: req,
            availableStock,
            ratePerUnit,
          });
        }
      }
    }

    return Array.from(map.entries()).map(([componentId, data]) => ({
      componentId,
      ...data,
      hasShortage: data.totalRequired > data.availableStock,
      lineCost: data.totalRequired * data.ratePerUnit,
    }));
  }, [jobCircuitRows, circuitDetailCache]);

  const resetForm = () => {
    setFormData({ vendorId: '', targetDate: '', remarks: '' });
    setJobCircuitRows([{ circuitId: '', orderedQty: 1 }]);
    setFormError('');
  };

  const handleOpenAddModal = () => {
    resetForm();
    setFormMode('add');
    setShowFormModal(true);
  };

  const handleOpenEditModal = async (job: JobListItem) => {
    setFormMode('edit');
    setSelectedJob(job);
    setFormError('');
    try {
      const res = await api.get(`/jobs/${job._id}`);
      const j = res.data.data;
      setFormData({
        vendorId: typeof j.vendorId === 'object' ? j.vendorId._id : j.vendorId,
        targetDate: j.targetDate ? j.targetDate.slice(0, 10) : '',
        remarks: j.remarks || '',
      });
      const rows = j.jobCircuits.map((jc: any) => ({
        circuitId: jc.circuitId,
        orderedQty: jc.orderedQty,
      }));
      setJobCircuitRows(rows);
      await Promise.all(rows.map((r: any) => fetchCircuitDetail(r.circuitId)));
      setShowFormModal(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load job for editing');
    }
  };

  const handleOpenDetails = async (job: JobListItem) => {
    setSelectedJob(job);
    setShowDetailsModal(true);
    setDetailsLoading(true);
    setDetailedJob(null);
    setJobChallans([]);
    try {
      const [jobRes, challansRes] = await Promise.all([
        api.get(`/jobs/${job._id}`),
        api.get(`/challans/job/${job._id}`).catch(() => ({ data: { data: [] } })),
      ]);
      setDetailedJob(jobRes.data.data);
      setJobChallans(challansRes.data.data || []);
    } catch (err) {
      console.error('Failed to load job details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleAddCircuitRow = () => {
    setJobCircuitRows([...jobCircuitRows, { circuitId: '', orderedQty: 1 }]);
  };

  const handleRemoveCircuitRow = (index: number) => {
    setJobCircuitRows(jobCircuitRows.filter((_, i) => i !== index));
  };

  const handleCircuitRowChange = (index: number, field: 'circuitId' | 'orderedQty', val: any) => {
    const updated = [...jobCircuitRows];
    updated[index] = { ...updated[index], [field]: val };
    setJobCircuitRows(updated);
    if (field === 'circuitId' && typeof val === 'string') {
      fetchCircuitDetail(val);
    }
  };

  const generateIdempotencyKey = () => `iss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorId) {
      setFormError('Please select a vendor.');
      return;
    }
    const validRows = jobCircuitRows.filter((r) => r.circuitId && r.orderedQty > 0);
    if (validRows.length === 0) {
      setFormError('Please select at least one circuit with quantity > 0.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        vendorId: formData.vendorId,
        targetDate: formData.targetDate || undefined,
        remarks: formData.remarks || undefined,
        jobCircuits: validRows.map((r) => ({
          circuitId: r.circuitId,
          orderedQty: Number(r.orderedQty),
        })),
      };

      if (formMode === 'add') {
        const res = await api.post('/jobs', payload);
        setSuccessMsg(`Job '${res.data.data.jobNumber}' saved as draft`);
      } else if (selectedJob) {
        await api.put(`/jobs/${selectedJob._id}`, payload);
        setSuccessMsg(`Job '${selectedJob.jobNumber}' updated`);
      }
      setShowFormModal(false);
      resetForm();
      fetchJobs();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save job');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = (job: JobListItem) => {
    setConfirmApproveJob(job);
    setErrorMsg('');
  };

  const executeApprove = async () => {
    if (!confirmApproveJob) return;
    setActionLoading(true);
    setActionJobId(confirmApproveJob._id);
    setErrorMsg('');
    try {
      const res = await api.post(`/jobs/${confirmApproveJob._id}/approve`);
      setSuccessMsg(`Job '${res.data.data.jobNumber}' approved - material reserved`);
      setConfirmApproveJob(null);
      fetchJobs();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to approve job');
    } finally {
      setActionJobId(null);
      setActionLoading(false);
    }
  };

  const handleCancel = (job: JobListItem) => {
    setConfirmCancelJob(job);
    setErrorMsg('');
  };

  const executeCancel = async () => {
    if (!confirmCancelJob) return;
    setActionLoading(true);
    setActionJobId(confirmCancelJob._id);
    setErrorMsg('');
    try {
      await api.post(`/jobs/${confirmCancelJob._id}/cancel`);
      setSuccessMsg(`Job '${confirmCancelJob.jobNumber}' cancelled`);
      setConfirmCancelJob(null);
      fetchJobs();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to cancel job');
    } finally {
      setActionJobId(null);
      setActionLoading(false);
    }
  };

  // Material Issue Handlers
  const handleOpenIssueModal = async (job: JobListItem) => {
    setIssueJob(job);
    setIssueError('');
    setIssueIdempotencyKey(generateIdempotencyKey());
    setShowIssueModal(true);
    try {
      const res = await api.get(`/jobs/${job._id}`);
      const reqs = res.data.data.materialRequirement
        .filter((r: any) => r.reservedQty - r.issuedQty > 0)
        .map((r: any) => {
          const rem = r.reservedQty - r.issuedQty;
          return {
            componentId: r.componentId,
            partCode: r.partCode,
            name: r.name,
            remaining: rem,
            qtyToIssue: rem,
          };
        });
      setIssueRows(reqs);
    } catch (err: any) {
      setIssueError(err.response?.data?.message || 'Failed to load job material requirement');
    }
  };

  const handleIssueQtyChange = (index: number, val: number) => {
    const updated = [...issueRows];
    updated[index] = { ...updated[index], qtyToIssue: val };
    setIssueRows(updated);
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueJob) return;

    const toIssue = issueRows.filter((r) => r.qtyToIssue > 0);
    if (toIssue.length === 0) {
      setIssueError('Please specify quantity > 0 for at least one component.');
      return;
    }

    for (const item of toIssue) {
      if (item.qtyToIssue > item.remaining) {
        setIssueError(`Cannot issue ${item.qtyToIssue} of ${item.partCode} (remaining: ${item.remaining})`);
        return;
      }
    }

    setIssueSubmitting(true);
    try {
      const res = await api.post(`/jobs/${issueJob._id}/issue`, {
        items: toIssue.map((i) => ({
          componentId: i.componentId,
          qty: i.qtyToIssue,
        })),
        idempotencyKey: issueIdempotencyKey,
      });
      setSuccessMsg(`Material issued! Challan: ${res.data.data.challan.challanNumber}`);
      setShowIssueModal(false);
      fetchJobs();
    } catch (err: any) {
      setIssueError(err.response?.data?.message || 'Failed to issue material');
    } finally {
      setIssueSubmitting(false);
    }
  };

  // Material Receive Handlers
  const handleOpenReceiveModal = (challan: any) => {
    setReceiveChallan(challan);
    setReceiveError('');
    setReceiveNotes('');
    setReceiveIdempotencyKey(generateIdempotencyKey());
    const items = challan.items
      .filter((i: any) => i.issuedQty - i.receivedQty - i.damagedQty > 0)
      .map((i: any) => {
        const rem = i.issuedQty - i.receivedQty - i.damagedQty;
        return {
          componentId: i.componentId,
          partCode: i.partCode,
          name: i.name,
          remaining: rem,
          receivedQty: rem,
          damagedQty: 0,
        };
      });
    setReceiveRows(items);
    setShowReceiveModal(true);
  };

  const handleReceiveRowChange = (index: number, field: 'receivedQty' | 'damagedQty', val: number) => {
    const updated = [...receiveRows];
    updated[index] = { ...updated[index], [field]: val };
    setReceiveRows(updated);
  };

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveChallan) return;

    for (const item of receiveRows) {
      if (item.receivedQty + item.damagedQty > item.remaining) {
        setReceiveError(`Total (${item.receivedQty + item.damagedQty}) exceeds remaining (${item.remaining}) for ${item.partCode}`);
        return;
      }
    }

    setReceiveSubmitting(true);
    try {
      await api.post(`/challans/${receiveChallan._id}/receive`, {
        items: receiveRows
          .filter((i) => i.receivedQty > 0 || i.damagedQty > 0)
          .map((i) => ({
            componentId: i.componentId,
            receivedQty: i.receivedQty,
            damagedQty: i.damagedQty,
          })),
        notes: receiveNotes || undefined,
        idempotencyKey: receiveIdempotencyKey,
      });
      setSuccessMsg('Material receipt recorded successfully');
      setShowReceiveModal(false);
      if (selectedJob) {
        handleOpenDetails(selectedJob);
      }
      fetchJobs();
    } catch (err: any) {
      setReceiveError(err.response?.data?.message || 'Failed to record material receipt');
    } finally {
      setReceiveSubmitting(false);
    }
  };

  // Stat metrics
  const totalJobs = jobs.length;
  const draftJobs = jobs.filter((j) => j.status === 'draft').length;
  const draftShortages = jobs.filter((j) => j.status === 'draft' && j.hasShortage).length;
  const draftEstCost = jobs
    .filter((j) => j.status === 'draft')
    .reduce((acc, j) => acc + (j.totalEstimatedCost || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Jobs & Delivery Challan</h1>
          <p className="body-text text-slate-500 mt-1 max-w-2xl">
            Job-work orders sent to assembly vendors, with material requirements calculated from circuit BOMs.
          </p>
        </div>
        {canEdit && (
          <button onClick={handleOpenAddModal} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>Create Job</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Jobs"
          value={totalJobs}
          icon={Workflow}
          subtitle="All statuses"
          loading={loading}
        />
        <StatCard
          title="Draft Jobs"
          value={draftJobs}
          icon={CalendarClock}
          subtitle="Awaiting approval"
          iconBgClass="bg-slate-100"
          iconColorClass="text-slate-600"
          loading={loading}
        />
        <StatCard
          title="Draft Material Shortages"
          value={draftShortages}
          icon={AlertTriangle}
          subtitle="Drafts with insufficient stock"
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          badge={draftShortages > 0 ? { label: 'Review', variant: 'warning' } : undefined}
          loading={loading}
        />
        <StatCard
          title="Draft Estimated Value"
          value={`₹${draftEstCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={Wallet}
          subtitle="Material cost of draft jobs"
          iconBgClass="bg-[#A69B8D]/15"
          iconColorClass="text-[#807365]"
          loading={loading}
        />
      </div>

      {/* Notifications */}
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

      {successMsg && (
        <div className="p-3.5 bg-[#168060]/10 border border-[#168060]/25 rounded-[10px] text-sm text-[#168060] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#168060] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#168060]/60 hover:text-[#168060] p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="enterprise-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search job number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-enterprise w-full sm:w-56"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="approved">Approved</option>
          <option value="material_issued">Material Issued</option>
          <option value="partially_received">Partially Received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Jobs Table */}
      <div className="enterprise-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#6B6863] flex flex-col items-center gap-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#141414] border-t-transparent"></div>
            <span className="text-xs">Loading jobs...</span>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title={search ? 'No matching jobs found' : 'No jobs created yet'}
            description={
              search
                ? 'Try adjusting your search or status filter.'
                : 'Create your first job-work order for a vendor to assemble circuits.'
            }
            action={
              canEdit && !search
                ? { label: 'Create Job', onClick: handleOpenAddModal, icon: Plus }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Job Number</th>
                  <th className="th-enterprise">Vendor</th>
                  <th className="th-enterprise">Circuits</th>
                  <th className="th-enterprise text-right">Ordered Qty</th>
                  <th className="th-enterprise">Target Date</th>
                  <th className="th-enterprise text-center">Status</th>
                  <th className="th-enterprise text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E3DE]">
                {jobs.map((job) => (
                  <tr key={job._id} className="tr-enterprise group">
                    <td className="td-enterprise">
                      <div className="font-mono font-semibold text-[#171717]">{job.jobNumber}</div>
                      <div className="text-[12px] text-[#6B6863]">
                        {new Date(job.jobDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="td-enterprise">
                      <div className="flex items-center gap-1.5 text-[#171717]">
                        <Truck className="w-3.5 h-3.5 text-[#807365]" />
                        {job.vendorId?.name || '—'}
                      </div>
                      <div className="text-[12px] text-[#6B6863]">{job.vendorId?.city}</div>
                    </td>
                    <td className="td-enterprise">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {job.jobCircuits.map((jc) => (
                          <span
                            key={jc.circuitId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F7F6F3] border border-[#E6E3DE] text-[11px] font-mono text-[#383531]"
                          >
                            <span className="font-semibold">{jc.circuitCode}</span>
                            <span className="text-[#807365]">×{jc.orderedQty}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="td-enterprise text-right font-mono font-semibold text-[#171717]">
                      {job.totalOrderedQty}
                    </td>
                    <td className="td-enterprise text-[12px] text-[#6B6863]">
                      {job.targetDate ? new Date(job.targetDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="td-enterprise text-center">
                      <Badge variant={STATUS_VARIANT[job.status] || 'neutral'}>
                        {STATUS_LABEL[job.status] || job.status}
                      </Badge>
                      {job.status === 'draft' && job.hasShortage && (
                        <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-amber-600 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Shortage</span>
                        </div>
                      )}
                    </td>
                    <td className="td-enterprise text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetails(job)}
                          className="btn-secondary px-2 py-1 text-xs"
                          title="View Details & BOM Material Requirements"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Details</span>
                        </button>

                        {canEdit && job.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(job)}
                              className="btn-secondary px-2 py-1 text-xs"
                              title="Edit Job Draft"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Edit</span>
                            </button>
                            <button
                              onClick={() => handleApprove(job)}
                              disabled={actionLoading && actionJobId === job._id}
                              className="btn-primary px-2.5 py-1 text-xs bg-[#168060] hover:bg-[#12684e] text-white"
                              title="Approve Job & Reserve Stock"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Approve</span>
                            </button>
                          </>
                        )}

                        {isStoreKeeper && (job.status === 'approved' || job.status === 'material_issued' || job.status === 'partially_received') && (
                          <button
                            onClick={() => handleOpenIssueModal(job)}
                            className="btn-primary px-2 py-1 text-xs"
                            title="Issue Reserved Materials & Generate Delivery Challan"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Issue Material</span>
                          </button>
                        )}

                        {canEdit && (job.status === 'draft' || job.status === 'approved') && (
                          <button
                            onClick={() => handleCancel(job)}
                            disabled={actionLoading && actionJobId === job._id}
                            className="btn-secondary px-2 py-1 text-xs text-[#C2413A] hover:bg-[#C2413A]/10 border-[#C2413A]/30"
                            title="Cancel Job"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Job Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        size="2xl"
        icon={<Workflow className="w-5 h-5 text-[#807365]" />}
        title={formMode === 'add' ? 'Create Job Work Order' : `Edit Job - ${selectedJob?.jobNumber}`}
        subtitle="Select vendor and circuits. Material requirements and stock reservation availability are calculated automatically."
        onSubmit={handleSubmitForm}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowFormModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Saving...' : formMode === 'add' ? 'Save as Draft' : 'Update Job'}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {formError && (
            <div className="p-3 bg-[#C2413A]/10 border border-[#C2413A]/25 rounded-[10px] text-xs text-[#C2413A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text block mb-1.5">
                Vendor <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.vendorId}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                required
                className="select-enterprise w-full"
              >
                <option value="">Select Vendor...</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name} ({v.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text block mb-1.5">Target Completion Date</label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                className="input-enterprise w-full"
              />
            </div>
          </div>

          {/* Circuit Selection Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="label-text font-semibold text-slate-800">Circuits to Assemble</label>
              <button
                type="button"
                onClick={handleAddCircuitRow}
                className="btn-secondary px-2.5 py-1 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Circuit</span>
              </button>
            </div>

            <div className="space-y-2">
              {jobCircuitRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex-1">
                    <select
                      value={row.circuitId}
                      onChange={(e) => handleCircuitRowChange(idx, 'circuitId', e.target.value)}
                      required
                      className="select-enterprise w-full text-sm bg-white"
                    >
                      <option value="">Select Circuit BOM...</option>
                      {circuits.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.circuitCode} — {c.name} (v{c.version}) [{c.bomItemCount} components]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.orderedQty}
                      onChange={(e) => handleCircuitRowChange(idx, 'orderedQty', parseInt(e.target.value) || 0)}
                      required
                      placeholder="Qty"
                      className="input-enterprise text-right font-mono bg-white"
                    />
                  </div>

                  {jobCircuitRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCircuitRow(idx)}
                      className="text-slate-400 hover:text-red-600 p-1.5 transition-colors"
                      title="Remove Row"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Aggregated Material Preview */}
          {aggregatedBomPreview.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Calculated Material Requirements</span>
                <span>
                  Total Estimated Material Cost:{' '}
                  <strong className="text-slate-900 font-mono">
                    ₹
                    {aggregatedBomPreview
                      .reduce((sum, item) => sum + item.lineCost, 0)
                      .toFixed(2)}
                  </strong>
                </span>
              </div>
              <div className="enterprise-card overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                    <tr>
                      <th className="th-enterprise">Component</th>
                      <th className="th-enterprise text-right">Required Qty</th>
                      <th className="th-enterprise text-right">Available in Store</th>
                      <th className="th-enterprise text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aggregatedBomPreview.map((line) => (
                      <tr key={line.componentId}>
                        <td className="td-enterprise">
                          <span className="font-mono font-semibold">{line.partCode}</span>
                          <span className="text-slate-400 ml-1.5">({line.name})</span>
                        </td>
                        <td className="td-enterprise text-right font-mono font-semibold">{line.totalRequired}</td>
                        <td className="td-enterprise text-right font-mono">{line.availableStock}</td>
                        <td className="td-enterprise text-center">
                          {line.hasShortage ? (
                            <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                              <AlertTriangle className="w-3 h-3" /> Shortage
                            </span>
                          ) : (
                            <span className="text-[#168060] font-semibold text-[11px]">Sufficient</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <label className="label-text block mb-1.5">Remarks / Work Instructions</label>
            <textarea
              rows={2}
              placeholder="e.g. Special testing requirements, delivery instructions..."
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
            />
          </div>
        </div>
      </Modal>

      {/* Details & BOM Requirements Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        size="2xl"
        icon={<Workflow className="w-5 h-5 text-[#807365]" />}
        title={detailedJob ? `Job Order: ${detailedJob.jobNumber}` : 'Job Details'}
        subtitle={
          detailedJob && (
            <div className="flex items-center gap-3 text-xs mt-1">
              <span>Vendor: <strong>{detailedJob.vendorId?.name}</strong></span>
              <span>•</span>
              <span>Status: <strong className="capitalize">{detailedJob.status}</strong></span>
            </div>
          )
        }
        footer={
          <button type="button" onClick={() => setShowDetailsModal(false)} className="btn-secondary">
            Close
          </button>
        }
      >
        {detailsLoading ? (
          <div className="py-16 text-center text-sm text-[#6B6863] flex flex-col items-center gap-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#141414] border-t-transparent"></div>
            <span className="text-xs">Loading job requirements and challans...</span>
          </div>
        ) : detailedJob ? (
          <div className="space-y-6">
            {/* Circuits Ordered Section */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Circuits Ordered
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {detailedJob.jobCircuits.map((jc: any) => (
                  <div key={jc.circuitId} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="font-mono font-bold text-slate-900">{jc.circuitCode}</div>
                    <div className="text-xs text-slate-600 truncate">{jc.name}</div>
                    <div className="mt-2 text-xs flex justify-between">
                      <span className="text-slate-500">Ordered:</span>
                      <span className="font-mono font-bold text-slate-900">{jc.orderedQty} units</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Material Requirements & Reservation Status */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Material Requirements & Reservation Status
                </h4>
                <div className="text-xs text-slate-500 font-mono">
                  Total Reserved Components: {detailedJob.materialRequirement.length}
                </div>
              </div>
              <div className="enterprise-card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="th-enterprise">Part Code</th>
                      <th className="th-enterprise">Component Name</th>
                      <th className="th-enterprise text-right">Req / Circuit</th>
                      <th className="th-enterprise text-right">Total Req</th>
                      <th className="th-enterprise text-right">Reserved (This Job)</th>
                      <th className="th-enterprise text-right">Reserved (All Jobs)</th>
                      <th className="th-enterprise text-right">Available</th>
                      <th className="th-enterprise text-right">Issued Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailedJob.materialRequirement.map((mat: any) => (
                      <tr key={mat.componentId}>
                        <td className="td-enterprise font-mono font-semibold">{mat.partCode}</td>
                        <td className="td-enterprise text-slate-600">{mat.name}</td>
                        <td className="td-enterprise text-right font-mono">{mat.totalRequiredQty}</td>
                        <td className="td-enterprise text-right font-mono font-semibold">{mat.totalRequiredQty}</td>
                        <td className="td-enterprise text-right font-mono font-bold text-[#168060]">{mat.reservedQty}</td>
                        <td className="td-enterprise text-right font-mono text-slate-500">{mat.totalReservedAllJobs ?? mat.reservedQty}</td>
                        <td className="td-enterprise text-right font-mono text-slate-700">{mat.availableStock ?? '—'}</td>
                        <td className="td-enterprise text-right font-mono">{mat.issuedQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delivery Challans Linked */}
            {jobChallans.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Delivery Challans Issued ({jobChallans.length})
                </h4>
                <div className="space-y-3">
                  {jobChallans.map((ch) => (
                    <div key={ch._id} className="p-3.5 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-slate-400" />
                          <span className="font-mono font-bold text-slate-900">{ch.challanNumber}</span>
                          <span className="text-xs text-slate-500">
                            ({new Date(ch.challanDate).toLocaleDateString()})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ch.status === 'received' ? 'success' : 'warning'}>
                            {CHALLAN_STATUS_LABEL[ch.status] || ch.status}
                          </Badge>
                          {isStoreKeeper && ch.status !== 'received' && (
                            <button
                              onClick={() => handleOpenReceiveModal(ch)}
                              className="btn-secondary px-2 py-0.5 text-xs text-[#168060] hover:bg-[#168060]/10"
                            >
                              Receive Unused / Damaged
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        {ch.items.map((it) => (
                          <span key={it.componentId} className="font-mono">
                            {it.partCode}: Issued {it.issuedQty} | Received {it.receivedQty} | Damaged {it.damagedQty}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Failed to load job details.</p>
        )}
      </Modal>

      {/* Material Issue Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        size="xl"
        icon={<PackageCheck className="w-5 h-5 text-[#807365]" />}
        title={issueJob ? `Issue Material - ${issueJob.jobNumber}` : 'Issue Material'}
        subtitle="Moves stock from store to the vendor and generates a delivery challan. Enter less than the full remaining quantity for a partial issue."
        onSubmit={handleSubmitIssue}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowIssueModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={issueSubmitting || issueRows.length === 0}
              className="btn-primary"
            >
              {issueSubmitting ? 'Issuing...' : 'Issue Material & Generate Challan'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {issueError && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
              {issueError}
            </div>
          )}

          {issueRows.length === 0 && !issueError ? (
            <div className="py-8 text-center text-sm text-[#6B6863]">
              <PackageCheck className="w-8 h-8 mx-auto mb-2 text-[#A69B8D]" />
              Nothing left to issue - every reserved component on this job has already been fully issued.
            </div>
          ) : (
            <div className="enterprise-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="th-enterprise">Component</th>
                    <th className="th-enterprise text-right">Remaining Reserved</th>
                    <th className="th-enterprise text-right">Qty to Issue Now</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {issueRows.map((row, idx) => (
                    <tr key={row.componentId}>
                      <td className="td-enterprise">
                        <span className="font-mono font-semibold">{row.partCode}</span>
                        <div className="text-[12px] text-slate-500">{row.name}</div>
                      </td>
                      <td className="td-enterprise text-right font-mono font-bold text-[#168060]">
                        {row.remaining}
                      </td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="any"
                          value={row.qtyToIssue}
                          onChange={(e) => handleIssueQtyChange(idx, parseFloat(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-28 ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Receive Material Modal */}
      <Modal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        size="xl"
        icon={<CheckCheck className="w-5 h-5 text-[#807365]" />}
        title={receiveChallan ? `Receive Material - ${receiveChallan.challanNumber}` : 'Receive Material'}
        subtitle="Record components returned unused (back to store) or reported damaged/lost (written off). Supports partial receipts."
        onSubmit={handleSubmitReceive}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowReceiveModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={receiveSubmitting || receiveRows.length === 0}
              className="btn-primary"
            >
              {receiveSubmitting ? 'Recording...' : 'Record Receipt'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {receiveError && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
              {receiveError}
            </div>
          )}

          {receiveRows.length === 0 && !receiveError ? (
            <div className="py-8 text-center text-sm text-[#6B6863]">
              <PackageCheck className="w-8 h-8 mx-auto mb-2 text-[#A69B8D]" />
              Nothing left to receive - every issued component on this challan has already been fully reconciled.
            </div>
          ) : (
            <>
              <div className="enterprise-card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="th-enterprise">Component</th>
                      <th className="th-enterprise text-right">Remaining</th>
                      <th className="th-enterprise text-right">
                        <span className="inline-flex items-center gap-1">
                          <CheckCheck className="w-3 h-3 text-[#168060]" /> Received (good)
                        </span>
                      </th>
                      <th className="th-enterprise text-right">
                        <span className="inline-flex items-center gap-1">
                          <Ban className="w-3 h-3 text-[#C2413A]" /> Damaged / Lost
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receiveRows.map((row, idx) => (
                      <tr key={row.componentId}>
                        <td className="td-enterprise">
                          <span className="font-mono font-semibold">{row.partCode}</span>
                          <div className="text-[12px] text-slate-500">{row.name}</div>
                        </td>
                        <td className="td-enterprise text-right font-mono font-bold text-[#168060]">
                          {row.remaining}
                        </td>
                        <td className="td-enterprise text-right">
                          <input
                            type="number"
                            min="0"
                            max={row.remaining}
                            step="any"
                            value={row.receivedQty}
                            onChange={(e) => handleReceiveRowChange(idx, 'receivedQty', parseFloat(e.target.value) || 0)}
                            className="input-enterprise text-right font-mono w-24 ml-auto"
                          />
                        </td>
                        <td className="td-enterprise text-right">
                          <input
                            type="number"
                            min="0"
                            max={row.remaining}
                            step="any"
                            value={row.damagedQty}
                            onChange={(e) => handleReceiveRowChange(idx, 'damagedQty', parseFloat(e.target.value) || 0)}
                            className="input-enterprise text-right font-mono w-24 ml-auto"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="label-text block mb-1.5">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. vendor remarks, damage reason..."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Confirmation Dialogs */}
      <ConfirmModal
        isOpen={!!confirmApproveJob}
        onClose={() => setConfirmApproveJob(null)}
        onConfirm={executeApprove}
        title={`Approve Job Work Order: ${confirmApproveJob?.jobNumber}`}
        description={
          <div>
            <p className="text-sm text-[#383531]">
              Approving this job will <strong className="text-[#168060]">reserve stock</strong> for all required components from store inventory.
            </p>
            <p className="mt-2 text-xs text-[#6B6863] leading-relaxed">
              Physical stock is not deducted immediately (that occurs upon <em>Material Issue</em>), but reserved components become unavailable for other jobs until this order is completed or cancelled.
            </p>
          </div>
        }
        confirmText="Approve & Reserve Stock"
        variant="primary"
        isLoading={actionLoading}
      />

      <ConfirmModal
        isOpen={!!confirmCancelJob}
        onClose={() => setConfirmCancelJob(null)}
        onConfirm={executeCancel}
        title={`Cancel Job Work Order: ${confirmCancelJob?.jobNumber}`}
        description={
          <div>
            <p className="text-sm text-[#383531]">
              Are you sure you want to cancel job <strong>{confirmCancelJob?.jobNumber}</strong>?
            </p>
            <p className="mt-2 text-xs text-[#6B6863] leading-relaxed">
              {confirmCancelJob?.status === 'approved'
                ? 'All reserved component stock will be released back to the general pool for other jobs.'
                : 'This draft job will be permanently marked as cancelled.'}
            </p>
          </div>
        }
        confirmText="Cancel Job"
        variant="danger"
        isLoading={actionLoading}
      />
    </div>
  );
};

export default Jobs;
