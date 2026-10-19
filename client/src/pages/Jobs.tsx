import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import { JobFormModal } from '../components/jobs/JobFormModal';
import { JobDetailsModal } from '../components/jobs/JobDetailsModal';
import { IssueMaterialModal } from '../components/jobs/IssueMaterialModal';
import { ReceiveMaterialModal, JobReceiveModal } from '../components/jobs/JobReceiveModal';
import { CloseJobModal } from '../components/jobs/CloseJobModal';
import {
  VendorOption,
  CircuitOption,
  JobCircuitRow,
  IssueRow,
  ReceiveRow,
  JobCircuitReceiveRow,
  ComponentReturnRow,
  ReconciliationData,
  ChallanSummary,
  JobListItem,
  STATUS_VARIANT,
  STATUS_LABEL,
} from '../components/jobs/jobTypes';
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
  Truck,
  CalendarClock,
  PackageCheck,
  ClipboardCheck,
} from 'lucide-react';

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

  // Combined Job Receipt (finished circuits + component returns together)
  const [showJobReceiveModal, setShowJobReceiveModal] = useState(false);
  const [jobReceiveTarget, setJobReceiveTarget] = useState<JobListItem | null>(null);
  const [jobReceiveCircuitRows, setJobReceiveCircuitRows] = useState<JobCircuitReceiveRow[]>([]);
  const [jobReceiveComponentRows, setJobReceiveComponentRows] = useState<ComponentReturnRow[]>([]);
  const [jobReceiveVendorRef, setJobReceiveVendorRef] = useState('');
  const [jobReceiveRemarks, setJobReceiveRemarks] = useState('');
  const [jobReceiveIdempotencyKey, setJobReceiveIdempotencyKey] = useState('');
  const [jobReceiveSubmitting, setJobReceiveSubmitting] = useState(false);
  const [jobReceiveError, setJobReceiveError] = useState('');

  // Reconciliation & Closing
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeIsShort, setCloseIsShort] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [closeError, setCloseError] = useState('');

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
    setReconciliation(null);
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

    if (job.status === 'material_issued' || job.status === 'partially_received' || job.status === 'closed') {
      setReconciliationLoading(true);
      try {
        const res = await api.get(`/jobs/${job._id}/reconciliation`);
        setReconciliation(res.data.data);
      } catch (err) {
        console.error('Failed to load job reconciliation:', err);
      } finally {
        setReconciliationLoading(false);
      }
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

  // Combined Job Receipt Handlers (finished circuits + component returns)
  const handleOpenJobReceiveModal = async (job: JobListItem) => {
    setJobReceiveTarget(job);
    setJobReceiveError('');
    setJobReceiveVendorRef('');
    setJobReceiveRemarks('');
    setJobReceiveIdempotencyKey(generateIdempotencyKey());
    setShowJobReceiveModal(true);
    try {
      const [jobRes, challansRes] = await Promise.all([
        api.get(`/jobs/${job._id}`),
        api.get(`/challans/job/${job._id}`).catch(() => ({ data: { data: [] } })),
      ]);
      const jobDetail = jobRes.data.data;
      const challans: ChallanSummary[] = challansRes.data.data || [];

      const circuitRows: JobCircuitReceiveRow[] = jobDetail.jobCircuits
        .filter((jc: any) => jc.orderedQty - (jc.receivedGoodQty || 0) - (jc.receivedRejectedQty || 0) > 0)
        .map((jc: any) => ({
          jobCircuitId: jc._id,
          circuitCode: jc.circuitCode,
          circuitName: jc.circuitName,
          orderedQty: jc.orderedQty,
          remaining: jc.orderedQty - (jc.receivedGoodQty || 0) - (jc.receivedRejectedQty || 0),
          goodQty: 0,
          rejectedQty: 0,
          rejectionReason: '',
        }));

      const componentRows: ComponentReturnRow[] = [];
      for (const ch of challans) {
        for (const it of ch.items) {
          const remaining = it.issuedQty - it.receivedQty - it.damagedQty;
          if (remaining > 0) {
            componentRows.push({
              componentId: it.componentId,
              partCode: it.partCode,
              name: it.name,
              challanId: ch._id,
              challanNumber: ch.challanNumber,
              remaining,
              receivedQty: 0,
              damagedQty: 0,
            });
          }
        }
      }

      setJobReceiveCircuitRows(circuitRows);
      setJobReceiveComponentRows(componentRows);
    } catch (err: any) {
      setJobReceiveError(err.response?.data?.message || 'Failed to load job for receiving');
    }
  };

  const handleJobReceiveCircuitChange = (index: number, field: 'goodQty' | 'rejectedQty' | 'rejectionReason', val: any) => {
    const updated = [...jobReceiveCircuitRows];
    updated[index] = { ...updated[index], [field]: val };
    setJobReceiveCircuitRows(updated);
  };

  const handleJobReceiveComponentChange = (index: number, field: 'receivedQty' | 'damagedQty', val: number) => {
    const updated = [...jobReceiveComponentRows];
    updated[index] = { ...updated[index], [field]: val };
    setJobReceiveComponentRows(updated);
  };

  const handleSubmitJobReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobReceiveTarget) return;
    setJobReceiveError('');

    const circuitLines = jobReceiveCircuitRows.filter((r) => r.goodQty > 0 || r.rejectedQty > 0);
    const componentLines = jobReceiveComponentRows.filter((r) => r.receivedQty > 0 || r.damagedQty > 0);

    if (circuitLines.length === 0 && componentLines.length === 0) {
      setJobReceiveError('Enter a good/rejected circuit quantity or a received/damaged component quantity for at least one line');
      return;
    }
    for (const row of circuitLines) {
      if (row.goodQty + row.rejectedQty > row.remaining) {
        setJobReceiveError(`${row.circuitCode}: good + rejected cannot exceed the remaining ordered quantity (${row.remaining})`);
        return;
      }
    }
    for (const row of componentLines) {
      if (row.receivedQty + row.damagedQty > row.remaining) {
        setJobReceiveError(`${row.partCode}: received + damaged cannot exceed the remaining receivable quantity (${row.remaining})`);
        return;
      }
    }

    setJobReceiveSubmitting(true);
    try {
      const res = await api.post(`/jobs/${jobReceiveTarget._id}/receipts`, {
        vendorRefNumber: jobReceiveVendorRef || undefined,
        circuitReceipts: circuitLines.map((r) => ({
          jobCircuitId: r.jobCircuitId,
          goodQty: r.goodQty,
          rejectedQty: r.rejectedQty,
          rejectionReason: r.rejectedQty > 0 ? r.rejectionReason || undefined : undefined,
        })),
        componentReturns: componentLines.map((r) => ({
          componentId: r.componentId,
          challanId: r.challanId,
          receivedQty: r.receivedQty,
          damagedQty: r.damagedQty,
        })),
        remarks: jobReceiveRemarks || undefined,
        idempotencyKey: jobReceiveIdempotencyKey,
      });
      const receiptNumber = res.data.data.receipt.receiptNumber;
      setSuccessMsg(
        res.data.data.alreadyProcessed
          ? `Receipt already processed as '${receiptNumber}' (duplicate request ignored)`
          : `Job receipt '${receiptNumber}' recorded - finished circuits and component returns applied together`
      );
      setShowJobReceiveModal(false);
      if (selectedJob) handleOpenDetails(selectedJob);
      fetchJobs();
    } catch (err: any) {
      setJobReceiveError(err.response?.data?.message || 'Failed to record job receipt');
    } finally {
      setJobReceiveSubmitting(false);
    }
  };

  // Job Closing Handlers
  const handleOpenCloseModal = () => {
    setCloseIsShort(!(reconciliation?.closeEligible));
    setCloseReason('');
    setCloseError('');
    setShowCloseModal(true);
  };

  const handleSubmitClose = async () => {
    if (!selectedJob) return;
    setCloseError('');
    if (closeIsShort && !closeReason.trim()) {
      setCloseError('A reason is required to short-close a job with outstanding quantities or material');
      return;
    }
    setCloseSubmitting(true);
    try {
      const res = await api.post(`/jobs/${selectedJob._id}/close`, {
        shortClose: closeIsShort,
        reason: closeIsShort ? closeReason.trim() : undefined,
      });
      setSuccessMsg(res.data.data.job.isShortClosed ? `Job '${res.data.data.job.jobNumber}' short-closed` : `Job '${res.data.data.job.jobNumber}' closed`);
      setShowCloseModal(false);
      setShowDetailsModal(false);
      fetchJobs();
    } catch (err: any) {
      setCloseError(err.response?.data?.message || 'Failed to close job');
    } finally {
      setCloseSubmitting(false);
    }
  };

  // Stat metrics
  const totalJobs = jobs.length;
  const draftJobs = jobs.filter((j) => j.status === 'draft').length;
  const draftShortages = jobs.filter((j) => j.status === 'draft' && j.hasShortage).length;
  const draftEstCost = jobs
    .filter((j) => j.status === 'draft')
    .reduce((acc, j) => acc + (j.totalEstimatedCost || 0), 0);

  const canCloseJob = Boolean(
    isAdmin && detailedJob && (detailedJob.status === 'material_issued' || detailedJob.status === 'partially_received')
  );

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
              {loading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
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
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
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

                        {isStoreKeeper && (job.status === 'material_issued' || job.status === 'partially_received') && (
                          <button
                            onClick={() => handleOpenJobReceiveModal(job)}
                            className="btn-primary px-2 py-1 text-xs bg-[#168060] hover:bg-[#12684e]"
                            title="Receive Finished Circuits & Component Returns Together"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Receive</span>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <JobFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        mode={formMode}
        selectedJob={selectedJob}
        vendors={vendors}
        circuits={circuits}
        formData={formData}
        onFormDataChange={setFormData}
        jobCircuitRows={jobCircuitRows}
        onAddCircuitRow={handleAddCircuitRow}
        onRemoveCircuitRow={handleRemoveCircuitRow}
        onCircuitRowChange={handleCircuitRowChange}
        aggregatedBomPreview={aggregatedBomPreview}
        submitting={submitting}
        formError={formError}
        onSubmit={handleSubmitForm}
      />

      <JobDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        detailsLoading={detailsLoading}
        detailedJob={detailedJob}
        jobChallans={jobChallans}
        isStoreKeeper={isStoreKeeper}
        onOpenReceiveModal={handleOpenReceiveModal}
        reconciliation={reconciliation}
        reconciliationLoading={reconciliationLoading}
        canCloseJob={canCloseJob}
        onOpenCloseModal={handleOpenCloseModal}
      />

      <IssueMaterialModal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        issueJob={issueJob}
        issueRows={issueRows}
        onQtyChange={handleIssueQtyChange}
        onSubmit={handleSubmitIssue}
        submitting={issueSubmitting}
        error={issueError}
      />

      <ReceiveMaterialModal
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        receiveChallan={receiveChallan}
        receiveRows={receiveRows}
        onRowChange={handleReceiveRowChange}
        receiveNotes={receiveNotes}
        onNotesChange={setReceiveNotes}
        onSubmit={handleSubmitReceive}
        submitting={receiveSubmitting}
        error={receiveError}
      />

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

      <JobReceiveModal
        isOpen={showJobReceiveModal}
        onClose={() => setShowJobReceiveModal(false)}
        jobReceiveTarget={jobReceiveTarget}
        circuitRows={jobReceiveCircuitRows}
        onCircuitRowChange={handleJobReceiveCircuitChange}
        componentRows={jobReceiveComponentRows}
        onComponentRowChange={handleJobReceiveComponentChange}
        vendorRef={jobReceiveVendorRef}
        onVendorRefChange={setJobReceiveVendorRef}
        remarks={jobReceiveRemarks}
        onRemarksChange={setJobReceiveRemarks}
        onSubmit={handleSubmitJobReceive}
        submitting={jobReceiveSubmitting}
        error={jobReceiveError}
      />

      <CloseJobModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        closeIsShort={closeIsShort}
        closeReason={closeReason}
        onCloseReasonChange={setCloseReason}
        closeError={closeError}
        closeSubmitting={closeSubmitting}
        onSubmit={handleSubmitClose}
        reconciliation={reconciliation}
      />
    </div>
  );
};

export default Jobs;
