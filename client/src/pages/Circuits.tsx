import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import {
  FileSpreadsheet,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Copy,
  Trash2,
  X,
  AlertTriangle,
  AlertCircle,
  Boxes,
  Wallet,
  Layers,
} from 'lucide-react';

interface BomItem {
  componentId: string;
  qtyPerUnit: number;
  designator?: string;
  remarks?: string;
}

interface CircuitItem {
  _id: string;
  circuitCode: string;
  name: string;
  version: string;
  description?: string;
  bomItems: BomItem[];
  bomItemCount: number;
  materialCostPerUnit: number;
  maxBuildableQty: number;
  bottleneckComponentId?: string;
  isLocked: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface ComponentOption {
  _id: string;
  partCode: string;
  name: string;
  ratePerUnit: number;
  inStoreStock: number;
  reservedStock: number;
}

interface BomAvailabilityLine {
  componentId: string;
  partCode: string;
  name: string;
  designator?: string;
  qtyPerUnit: number;
  ratePerUnit: number;
  lineCost: number;
  inStoreStock: number;
  reservedStock: number;
  availableStock: number;
  buildableQty: number;
  isActive: boolean;
}

export const Circuits: React.FC = () => {
  const { isAdmin, isProduction } = useAuth();
  const canEdit = isAdmin || isProduction;

  const [circuits, setCircuits] = useState<CircuitItem[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitItem | null>(null);
  const [detailedCircuit, setDetailedCircuit] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [duplicateVersion, setDuplicateVersion] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    circuitCode: '',
    name: '',
    version: '1.0',
    description: '',
  });
  const [bomRows, setBomRows] = useState<
    Array<{ componentId: string; qtyPerUnit: number; designator: string; remarks: string }>
  >([{ componentId: '', qtyPerUnit: 1, designator: '', remarks: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchComponents();
  }, []);

  useEffect(() => {
    fetchCircuits();
  }, [search, statusFilter]);

  const fetchComponents = async () => {
    try {
      const res = await api.get('/components?limit=500');
      setComponents(res.data.data);
    } catch (err) {
      console.error('Failed to load components:', err);
    }
  };

  const fetchCircuits = async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/circuits', { params });
      setCircuits(res.data.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to fetch circuits');
    } finally {
      setLoading(false);
    }
  };

  const componentMap = useMemo(() => new Map(components.map((c) => [c._id, c])), [components]);

  const liveEstimate = useMemo(() => {
    let total = 0;
    const lines = bomRows.map((row) => {
      const comp = componentMap.get(row.componentId);
      const rate = comp?.ratePerUnit || 0;
      const qty = Number(row.qtyPerUnit) || 0;
      const lineCost = rate * qty;
      total += lineCost;
      const available = comp ? Math.max(0, comp.inStoreStock - comp.reservedStock) : 0;
      return { comp, lineCost, available };
    });
    return { total: Number(total.toFixed(2)), lines };
  }, [bomRows, componentMap]);

  const resetForm = () => {
    setFormData({ circuitCode: '', name: '', version: '1.0', description: '' });
    setBomRows([{ componentId: '', qtyPerUnit: 1, designator: '', remarks: '' }]);
    setFormError('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setFormMode('add');
    setShowFormModal(true);
  };

  const handleOpenEdit = async (c: CircuitItem) => {
    setFormMode('edit');
    setSelectedCircuit(c);
    setFormError('');
    try {
      const res = await api.get(`/circuits/${c._id}`);
      const data = res.data.data;
      setFormData({
        circuitCode: data.circuitCode,
        name: data.name,
        version: data.version,
        description: data.description || '',
      });
      setBomRows(
        data.bomItems.map((item: any) => ({
          componentId: item.componentId?._id || item.componentId,
          qtyPerUnit: item.qtyPerUnit,
          designator: item.designator || '',
          remarks: item.remarks || '',
        }))
      );
      setShowFormModal(true);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to load circuit for editing');
    }
  };

  const handleOpenDetails = async (c: CircuitItem) => {
    setSelectedCircuit(c);
    setShowDetailsModal(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/circuits/${c._id}`);
      setDetailedCircuit(res.data.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleOpenDuplicate = (c: CircuitItem) => {
    setSelectedCircuit(c);
    setDuplicateVersion('');
    setFormError('');
    setShowDuplicateModal(true);
  };

  const addBomRow = () => {
    setBomRows([...bomRows, { componentId: '', qtyPerUnit: 1, designator: '', remarks: '' }]);
  };

  const removeBomRow = (index: number) => {
    setBomRows(bomRows.filter((_, i) => i !== index));
  };

  const updateBomRow = (index: number, field: string, value: any) => {
    const updated = [...bomRows];
    updated[index] = { ...updated[index], [field]: value };
    setBomRows(updated);
  };

  const usedComponentIds = (currentIndex: number) =>
    new Set(bomRows.filter((_, i) => i !== currentIndex).map((r) => r.componentId).filter(Boolean));

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validRows = bomRows.filter((r) => r.componentId);
    if (validRows.length === 0) {
      setFormError('At least one BOM component is required');
      return;
    }

    const seen = new Set();
    for (const r of validRows) {
      if (seen.has(r.componentId)) {
        setFormError('A BOM cannot contain the same component twice - remove the duplicate row');
        return;
      }
      seen.add(r.componentId);
      if (!r.qtyPerUnit || r.qtyPerUnit <= 0) {
        setFormError('Every BOM row needs a quantity greater than zero');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        bomItems: validRows.map((r) => ({
          componentId: r.componentId,
          qtyPerUnit: Number(r.qtyPerUnit),
          designator: r.designator,
          remarks: r.remarks,
        })),
      };

      if (formMode === 'add') {
        await api.post('/circuits', { ...formData, ...payload });
        setSuccessMsg(`Circuit '${formData.circuitCode.toUpperCase()}' created successfully`);
      } else if (selectedCircuit) {
        await api.put(`/circuits/${selectedCircuit._id}`, {
          name: formData.name,
          description: formData.description,
          ...payload,
        });
        setSuccessMsg(`Circuit '${formData.circuitCode}' updated successfully`);
      }

      setShowFormModal(false);
      resetForm();
      fetchCircuits();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save circuit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (c: CircuitItem) => {
    try {
      await api.patch(`/circuits/${c._id}/status`);
      setSuccessMsg(`Circuit '${c.circuitCode}' ${c.status === 'active' ? 'deactivated' : 'activated'}`);
      fetchCircuits();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update circuit status');
    }
  };

  const handleDuplicate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCircuit) return;
    if (!duplicateVersion.trim()) {
      setFormError('New version label is required (e.g. "2.0")');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/circuits/${selectedCircuit._id}/duplicate`, {
        newVersion: duplicateVersion.trim(),
      });
      setSuccessMsg(`Circuit duplicated as version '${duplicateVersion.trim()}'`);
      setShowDuplicateModal(false);
      fetchCircuits();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to duplicate circuit');
    } finally {
      setSubmitting(false);
    }
  };

  const totalCircuits = circuits.length;
  const activeCircuits = circuits.filter((c) => c.status === 'active').length;
  const buildableNow = circuits.filter((c) => c.status === 'active' && c.maxBuildableQty > 0).length;
  const blockedByShortage = circuits.filter((c) => c.status === 'active' && c.maxBuildableQty === 0).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Circuits (Recipes / BOM)</h1>
          <p className="body-text text-slate-500 mt-1 max-w-2xl">
            Bills of material for each circuit, with live material cost and maximum buildable quantity from current stock.
          </p>
        </div>
        {canEdit && (
          <button onClick={handleOpenAdd} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span>Add Circuit</span>
          </button>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Circuits" value={totalCircuits} icon={FileSpreadsheet} subtitle="All versions on record" loading={loading} />
        <StatCard
          title="Active Circuits"
          value={activeCircuits}
          icon={CheckCircle2}
          subtitle="Available for job creation"
          iconBgClass="bg-emerald-50"
          iconColorClass="text-emerald-600"
          loading={loading}
        />
        <StatCard
          title="Buildable Now"
          value={buildableNow}
          icon={Boxes}
          subtitle="At least 1 unit buildable from stock"
          iconBgClass="bg-[#A69B8D]/15"
          iconColorClass="text-[#807365]"
          loading={loading}
        />
        <StatCard
          title="Blocked by Shortage"
          value={blockedByShortage}
          icon={AlertTriangle}
          subtitle="Zero buildable - bottleneck component"
          iconBgClass="bg-amber-50"
          iconColorClass="text-amber-600"
          badge={blockedByShortage > 0 ? { label: 'Review', variant: 'warning' } : undefined}
          loading={loading}
        />
      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-700 p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-700 p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toolbar / Search / Filter */}
      <div className="enterprise-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search circuit code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise pl-9"
          />
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-slate-50 text-xs w-full sm:w-auto">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-md text-[13px] font-medium transition-all capitalize ${
                statusFilter === filter
                  ? 'bg-white text-slate-900 shadow-xs border border-gray-200/60'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Circuits Table */}
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="th-enterprise">Circuit</th>
                <th className="th-enterprise">Version</th>
                <th className="th-enterprise text-right">Components</th>
                <th className="th-enterprise text-right">Material Cost / Unit</th>
                <th className="th-enterprise text-right">Max Buildable</th>
                <th className="th-enterprise text-center">Status</th>
                <th className="th-enterprise text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E3DE]">
              {loading ? (
                <TableSkeleton rows={6} cols={7} />
              ) : circuits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    <EmptyState
                      icon={FileSpreadsheet}
                      title={search ? 'No matching circuits found' : 'No circuits defined yet'}
                      description={
                        search
                          ? 'Try adjusting your search or status filter.'
                          : 'Define your first circuit BOM to start calculating material cost and buildable quantity.'
                      }
                      action={canEdit && !search ? { label: 'Add Circuit', onClick: handleOpenAdd, icon: Plus } : undefined}
                    />
                  </td>
                </tr>
              ) : (
                circuits.map((c) => (
                  <tr key={c._id} className="tr-enterprise group">
                    <td className="td-enterprise">
                      <div className="font-mono font-semibold text-[#171717]">{c.circuitCode}</div>
                      <div className="text-[#6B6863] font-medium">{c.name}</div>
                    </td>
                    <td className="td-enterprise">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F7F6F3] text-[#6B6863] border border-[#E6E3DE]">
                        <Layers className="w-3 h-3 text-[#807365]" />v{c.version}
                      </span>
                      {c.isLocked && <span className="block text-[11px] text-[#B7791F] mt-1">Locked (referenced by a job)</span>}
                    </td>
                    <td className="td-enterprise text-right font-mono">{c.bomItemCount}</td>
                    <td className="td-enterprise text-right font-mono font-semibold text-[#171717]">
                      ₹{c.materialCostPerUnit.toFixed(2)}
                    </td>
                    <td className="td-enterprise text-right">
                      <span className={`font-mono font-bold ${c.maxBuildableQty === 0 ? 'text-[#C2413A]' : 'text-[#168060]'}`}>
                        {c.maxBuildableQty}
                      </span>
                      {c.maxBuildableQty === 0 && (
                        <AlertTriangle className="inline-block w-3.5 h-3.5 text-[#B7791F] ml-1 -mt-0.5" />
                      )}
                    </td>
                    <td className="td-enterprise text-center">
                      <Badge variant={c.status === 'active' ? 'success' : 'neutral'} dot>
                        {c.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="td-enterprise text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDetails(c)}
                          title="View BOM & Availability"
                          className="btn-ghost p-1.5 rounded-md text-[#6B6863] hover:text-[#171717]"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(c)}
                              title={c.isLocked ? 'Locked - duplicate as new version instead' : 'Edit Circuit'}
                              className="btn-ghost p-1.5 rounded-md disabled:opacity-40 text-[#6B6863] hover:text-[#171717]"
                              disabled={c.isLocked}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDuplicate(c)}
                              title="Duplicate as New Version"
                              className="btn-ghost p-1.5 rounded-md text-[#6B6863] hover:text-[#171717]"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(c)}
                              title={c.status === 'active' ? 'Deactivate' : 'Activate'}
                              className="btn-ghost p-1.5 rounded-md text-[#6B6863] hover:text-[#171717]"
                            >
                              {c.status === 'active' ? (
                                <XCircle className="w-4 h-4 text-[#6B6863] hover:text-[#B7791F]" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-slate-400 hover:text-emerald-600" />
                              )}
                            </button>
                          </>
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

      {/* ============ ADD / EDIT CIRCUIT MODAL (BOM Builder) ============ */}
      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        size="2xl"
        icon={<FileSpreadsheet className="w-5 h-5 text-[#807365]" />}
        title={formMode === 'add' ? 'Add New Circuit Recipe' : `Edit Circuit: ${formData.circuitCode}`}
        subtitle="Define the circuit identity, PCB specifications, and its bill of materials (BOM)."
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
              {submitting && <ButtonSpinner />}
              <span>{submitting ? 'Saving...' : formMode === 'add' ? 'Save Circuit' : 'Save Changes'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {formError && (
            <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">{formError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text block mb-1.5">
                Circuit Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={formMode === 'edit'}
                placeholder="e.g. PCB-001"
                value={formData.circuitCode}
                onChange={(e) => setFormData({ ...formData, circuitCode: e.target.value.toUpperCase() })}
                className="input-enterprise font-mono uppercase disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div>
              <label className="label-text block mb-1.5">
                Version <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={formMode === 'edit'}
                placeholder="e.g. 1.0"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                className="input-enterprise font-mono disabled:bg-slate-50 disabled:text-slate-500"
              />
              {formMode === 'edit' && (
                <p className="helper-text mt-1">Use "Duplicate as New Version" to change the version.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="label-text block mb-1.5">
                Circuit Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Smart Switch Controller"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-enterprise"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-text block mb-1.5">Description</label>
              <textarea
                rows={2}
                placeholder="Optional description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
              />
            </div>
          </div>

          {/* BOM Builder */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <label className="label-text font-semibold text-sm text-[#171717]">Bill of Materials (BOM Components)</label>
              <button type="button" onClick={addBomRow} className="btn-secondary text-xs py-1">
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
            </div>

            <div className="space-y-2">
              {bomRows.map((row, idx) => {
                const comp = componentMap.get(row.componentId);
                const line = liveEstimate.lines[idx];
                const used = usedComponentIds(idx);
                return (
                  <div key={idx} className="p-3 rounded-xl border border-gray-200 bg-[#F7F6F3]/50 grid grid-cols-12 gap-2 items-start">
                    <div className="col-span-12 sm:col-span-4">
                      <select
                        value={row.componentId}
                        onChange={(e) => updateBomRow(idx, 'componentId', e.target.value)}
                        className="select-enterprise text-xs"
                      >
                        <option value="">Select component...</option>
                        {components.map((c) => (
                          <option key={c._id} value={c._id} disabled={used.has(c._id)}>
                            {c.partCode} - {c.name}
                          </option>
                        ))}
                      </select>
                      {comp && (
                        <p className="helper-text mt-1">
                          Available: <span className="font-mono font-medium">{line?.available ?? 0}</span> | Rate: ₹{comp.ratePerUnit.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        placeholder="Qty"
                        value={row.qtyPerUnit}
                        onChange={(e) => updateBomRow(idx, 'qtyPerUnit', parseFloat(e.target.value) || 0)}
                        className="input-enterprise text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Designator (R1-R4)"
                        value={row.designator}
                        onChange={(e) => updateBomRow(idx, 'designator', e.target.value)}
                        className="input-enterprise text-xs font-mono"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Remarks (optional)"
                        value={row.remarks}
                        onChange={(e) => updateBomRow(idx, 'remarks', e.target.value)}
                        className="input-enterprise text-xs"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-1 flex sm:justify-end items-center gap-2">
                      {line && line.comp && (
                        <span className="text-[11px] font-mono text-slate-600 sm:hidden">₹{line.lineCost.toFixed(2)}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBomRow(idx)}
                        disabled={bomRows.length === 1}
                        className="btn-ghost p-1.5 rounded-md disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 p-3 bg-[#A69B8D]/10 border border-[#A69B8D]/30 rounded-[10px]">
              <Wallet className="w-4 h-4 text-[#807365]" />
              <span className="text-xs text-[#6B6863]">Live Estimated Material Cost:</span>
              <span className="font-mono font-bold text-[#171717]">₹{liveEstimate.total.toFixed(2)}</span>
              <span className="helper-text">(authoritative value is recalculated on save)</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* ============ DUPLICATE AS NEW VERSION MODAL ============ */}
      <Modal
        isOpen={showDuplicateModal && !!selectedCircuit}
        onClose={() => setShowDuplicateModal(false)}
        size="sm"
        icon={<Copy className="w-5 h-5 text-[#807365]" />}
        title="Duplicate as New Version"
        subtitle={`Creates an independent new version with the same BOM for ${selectedCircuit?.circuitCode}`}
        onSubmit={handleDuplicate}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowDuplicateModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? 'Creating...' : 'Create Version'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="helper-text">
            Creates a new, independent version of <strong className="font-mono text-[#171717]">{selectedCircuit?.circuitCode}</strong> (currently v
            {selectedCircuit?.version}) with the same BOM. The original version is never altered.
          </p>

          {formError && (
            <div className="p-2 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/25 text-[#C2413A] text-xs">
              {formError}
            </div>
          )}

          <div>
            <label className="label-text block mb-1.5">New Version Label</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. 2.0"
              value={duplicateVersion}
              onChange={(e) => setDuplicateVersion(e.target.value)}
              className="input-enterprise font-mono"
            />
          </div>
        </div>
      </Modal>

      {/* ============ CIRCUIT DETAILS MODAL (BOM + Availability) ============ */}
      <Modal
        isOpen={showDetailsModal && !!selectedCircuit}
        onClose={() => setShowDetailsModal(false)}
        size="2xl"
        headerBanner={
          selectedCircuit ? (
            <div className="px-6 sm:px-8 py-5 bg-white flex items-center justify-between shrink-0 border-b border-[#E7E4DE]">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-[10px] bg-[#FAF9F7] border border-[#E7E4DE] text-[#807365] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg sm:text-[19px] font-semibold text-[#171717] tracking-tight">{selectedCircuit.circuitCode}</h2>
                    <Badge variant="gold">v{selectedCircuit.version}</Badge>
                    <Badge variant={selectedCircuit.status === 'active' ? 'success' : 'neutral'} dot>
                      {selectedCircuit.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-[13px] text-[#716B64] mt-0.5">{selectedCircuit.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="p-2 rounded-[8px] text-[#716B64] hover:text-[#171717] hover:bg-[#FAF9F7] transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : null
        }
        footer={
          <button
            type="button"
            onClick={() => setShowDetailsModal(false)}
            className="btn-secondary"
          >
            Close View
          </button>
        }
      >
        {selectedCircuit && (
          <div className="space-y-5">
            {detailsLoading ? (
              <div className="py-10 text-center text-sm text-slate-400">Loading BOM availability...</div>
            ) : detailedCircuit ? (
              <>
                {detailedCircuit.description && <p className="body-text text-slate-600">{detailedCircuit.description}</p>}

                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-gray-200">
                    <span className="helper-text font-medium block">Material Cost / Unit</span>
                    <div className="mt-1.5 metric-number text-slate-900">₹{detailedCircuit.materialCostPerUnit.toFixed(2)}</div>
                  </div>
                  <div className="p-4 bg-slate-50/70 rounded-xl border border-gray-200">
                    <span className="helper-text font-medium block">Maximum Buildable</span>
                    <div
                      className={`mt-1.5 metric-number ${
                        detailedCircuit.maxBuildableQty === 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {detailedCircuit.maxBuildableQty} units
                    </div>
                  </div>
                  <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200">
                    <span className="helper-text font-medium block text-amber-700">Bottleneck Component</span>
                    <div className="mt-1.5 text-sm font-mono font-bold text-amber-900">
                      {detailedCircuit.bomAvailability?.find((l: BomAvailabilityLine) => l.componentId === detailedCircuit.bottleneckComponentId)
                        ?.partCode || '—'}
                    </div>
                  </div>
                </div>

                {/* BOM Table */}
                <div className="enterprise-card overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="th-enterprise">Component</th>
                        <th className="th-enterprise">Designator</th>
                        <th className="th-enterprise text-right">Qty / Unit</th>
                        <th className="th-enterprise text-right">Available Stock</th>
                        <th className="th-enterprise text-right">Buildable</th>
                        <th className="th-enterprise text-right">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailedCircuit.bomAvailability?.map((line: BomAvailabilityLine) => {
                        const isBottleneck = line.componentId === detailedCircuit.bottleneckComponentId;
                        return (
                          <tr key={line.componentId} className={`tr-enterprise ${isBottleneck ? 'bg-amber-50/60' : ''}`}>
                            <td className="td-enterprise">
                              <div className="font-mono font-semibold text-slate-900 flex items-center gap-1.5">
                                {line.partCode}
                                {isBottleneck && (
                                  <span title="Bottleneck component">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                  </span>
                                )}
                                {!line.isActive && <Badge variant="danger">Inactive</Badge>}
                              </div>
                              <div className="text-[12px] text-slate-500">{line.name}</div>
                            </td>
                            <td className="td-enterprise font-mono text-[12px] text-slate-600">{line.designator || '—'}</td>
                            <td className="td-enterprise text-right font-mono">{line.qtyPerUnit}</td>
                            <td className="td-enterprise text-right font-mono">{line.availableStock}</td>
                            <td className={`td-enterprise text-right font-mono font-bold ${line.buildableQty === 0 ? 'text-red-600' : 'text-slate-900'}`}>
                              {line.buildableQty}
                            </td>
                            <td className="td-enterprise text-right font-mono">₹{line.lineCost.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Linked jobs will appear here once the Jobs module is available.
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Failed to load circuit details.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
export default Circuits;
