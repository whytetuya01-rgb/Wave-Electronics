import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import {
  Cpu,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  History,
  Sliders,
  X,
  Eye,
  ArrowUpDown,
  FileSpreadsheet,
  Download,
  Boxes,
  MapPin,
  CheckCircle2,
  Tag,
  Layers,
} from 'lucide-react';

interface ComponentItem {
  _id: string;
  partCode: string;
  name: string;
  categoryId: { _id: string; name: string };
  unitId: { _id: string; name: string; shortCode: string };
  locationId?: { _id: string; name: string; zone?: string };
  package?: string;
  specifications: Record<string, string>;
  inStoreStock: number;
  reservedStock: number;
  withVendorStock: number;
  availableStock: number;
  minStock: number;
  ratePerUnit: number;
  datasheetUrl?: string;
  imageUrl?: string;
}

interface MasterOption {
  _id: string;
  name: string;
  shortCode?: string;
}

export const ComponentsList: React.FC = () => {
  const { isStoreKeeper } = useAuth();
  const [searchParams] = useSearchParams();

  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [categories, setCategories] = useState<MasterOption[]>([]);
  const [units, setUnits] = useState<MasterOption[]>([]);
  const [locations, setLocations] = useState<MasterOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (Attio Style)
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('filter') === 'lowStock');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(searchParams.get('action') === 'new');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [activeComponent, setActiveComponent] = useState<ComponentItem | null>(null);
  const [componentLedger, setComponentLedger] = useState<any[]>([]);

  // Add Component Form State
  const [formData, setFormData] = useState({
    partCode: '',
    name: '',
    categoryId: '',
    unitId: '',
    locationId: '',
    package: '',
    minStock: 0,
    ratePerUnit: 0,
    openingStock: 0,
    specKey: '',
    specValue: '',
  });
  const [specList, setSpecList] = useState<{ [key: string]: string }>({});

  // Adjust Form State
  const [adjustData, setAdjustData] = useState({
    qtyChange: 0,
    reason: 'count_correction',
    notes: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    fetchComponents();
  }, [search, selectedCategory, lowStockOnly]);

  const fetchMasters = async () => {
    try {
      const [catRes, unitRes, locRes] = await Promise.all([
        api.get('/masters/categories'),
        api.get('/masters/units'),
        api.get('/masters/locations'),
      ]);
      setCategories(catRes.data);
      setUnits(unitRes.data);
      setLocations(locRes.data);
    } catch (err) {
      console.error('Failed to load masters:', err);
    }
  };

  const fetchComponents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (lowStockOnly) params.append('lowStockOnly', 'true');

      const res = await api.get(`/components?${params.toString()}`);
      setComponents(res.data.data);
    } catch (err) {
      console.error('Failed to load components:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetails = async (comp: ComponentItem) => {
    setActiveComponent(comp);
    setShowDetailsModal(true);
    try {
      const res = await api.get(`/components/${comp._id}`);
      setComponentLedger(res.data.ledger || []);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    }
  };

  const handleOpenAdjust = (comp: ComponentItem) => {
    setActiveComponent(comp);
    setAdjustData({ qtyChange: 0, reason: 'count_correction', notes: '' });
    setFormError('');
    setShowAdjustModal(true);
  };

  const handleAddSpec = () => {
    if (formData.specKey.trim() && formData.specValue.trim()) {
      setSpecList({ ...specList, [formData.specKey.trim()]: formData.specValue.trim() });
      setFormData({ ...formData, specKey: '', specValue: '' });
    }
  };

  const handleCreateComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      await api.post('/components', {
        partCode: formData.partCode,
        name: formData.name,
        categoryId: formData.categoryId,
        unitId: formData.unitId,
        locationId: formData.locationId || undefined,
        package: formData.package,
        minStock: Number(formData.minStock),
        ratePerUnit: Number(formData.ratePerUnit),
        openingStock: Number(formData.openingStock),
        specifications: specList,
      });

      setShowAddModal(false);
      resetAddForm();
      fetchComponents();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create component');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeComponent) return;

    setFormError('');
    setSubmitting(true);

    try {
      await api.post(`/components/${activeComponent._id}/adjust`, {
        qtyChange: Number(adjustData.qtyChange),
        reason: adjustData.reason,
        notes: adjustData.notes,
      });

      setShowAdjustModal(false);
      fetchComponents();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAddForm = () => {
    setFormData({
      partCode: '',
      name: '',
      categoryId: '',
      unitId: '',
      locationId: '',
      package: '',
      minStock: 0,
      ratePerUnit: 0,
      openingStock: 0,
      specKey: '',
      specValue: '',
    });
    setSpecList({});
    setFormError('');
  };

  return (
    <div className="space-y-4 w-full">
      {/* Top Header & Primary Action (Linear Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Component Stock & Catalog</h1>
            <span className="badge-status badge-status-neutral text-[11px] font-mono">
              {components.length} items
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Active electronic components, storage balances, and immutable movement ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isStoreKeeper && (
            <button
              onClick={() => {
                resetAddForm();
                setShowAddModal(true);
              }}
              className="btn-linear-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Component</span>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Search & Filter Bar (Attio Style) */}
      <div className="shadcn-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="flex-1 w-full relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter by part code, description, footprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5] transition-all"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Low Stock Toggle Badge Filter */}
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              lowStockOnly
                ? 'bg-amber-50 text-[#D97706] border-amber-300 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${lowStockOnly ? 'text-[#D97706]' : 'text-slate-400'}`} />
            <span>Low Stock</span>
          </button>
        </div>
      </div>

      {/* Compact, Highly Readable Data Table (Attio & Linear Inspired) */}
      <div className="shadcn-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500">Loading catalog...</span>
            </div>
          </div>
        ) : components.length === 0 ? (
          <div className="text-center py-16">
            <Cpu className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
            <h3 className="text-xs font-bold text-slate-700">No components match your query</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Try resetting search filters or create a new part.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="sticky top-0 z-10 bg-slate-50/95">
                <tr>
                  <th className="table-compact-th">Part Code</th>
                  <th className="table-compact-th">Component Name</th>
                  <th className="table-compact-th">Category</th>
                  <th className="table-compact-th">Footprint</th>
                  <th className="table-compact-th text-right">In Store</th>
                  <th className="table-compact-th text-right">Reserved</th>
                  <th className="table-compact-th text-right">Available</th>
                  <th className="table-compact-th text-right">Rate</th>
                  <th className="table-compact-th">Location</th>
                  <th className="table-compact-th text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {components.map((comp) => {
                  const isLow = comp.inStoreStock <= comp.minStock;
                  return (
                    <tr key={comp._id} className="table-row-interactive">
                      {/* Part Code */}
                      <td className="table-compact-td">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#4F46E5]">
                            {comp.partCode}
                          </span>
                          {isLow && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#D97706]"
                              title={`Below safety reserve (${comp.minStock})`}
                            ></span>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="table-compact-td font-medium text-slate-900 max-w-xs truncate">
                        {comp.name}
                      </td>

                      {/* Category */}
                      <td className="table-compact-td text-slate-600">
                        {comp.categoryId?.name || '-'}
                      </td>

                      {/* Footprint / Package */}
                      <td className="table-compact-td">
                        {comp.package ? (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {comp.package}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* In Store Stock (Physical on shelves) */}
                      <td className="table-compact-td text-right font-mono font-bold text-slate-900">
                        {comp.inStoreStock}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          {comp.unitId?.shortCode}
                        </span>
                      </td>

                      {/* Reserved (Allocated to approved jobs) */}
                      <td className="table-compact-td text-right font-mono text-[#D97706] font-medium">
                        {comp.reservedStock}
                      </td>

                      {/* Available (Free to allocate) */}
                      <td className="table-compact-td text-right font-mono font-bold text-[#059669]">
                        {comp.availableStock ?? Math.max(0, comp.inStoreStock - comp.reservedStock)}
                      </td>

                      {/* Rate */}
                      <td className="table-compact-td text-right font-mono text-slate-600">
                        ₹{comp.ratePerUnit.toFixed(2)}
                      </td>

                      {/* Location */}
                      <td className="table-compact-td text-slate-600">
                        {comp.locationId?.name ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {comp.locationId.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="table-compact-td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenDetails(comp)}
                            title="View Stock Breakdown & Ledger Audit"
                            className="btn-linear-ghost p-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          {isStoreKeeper && (
                            <button
                              onClick={() => handleOpenAdjust(comp)}
                              title="Stock Adjustment"
                              className="btn-linear-ghost p-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= MODAL: ADD COMPONENT ================= */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="xl"
        icon={<Cpu className="w-5 h-5 text-[#807365]" />}
        title="Add New Component"
        subtitle="Configure part details and initialize opening stock ledger."
        onSubmit={handleCreateComponent}
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
              {submitting ? 'Saving...' : 'Save Component'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-[#C2413A]/10 border border-[#C2413A]/20 text-[#C2413A] text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-text block mb-1.5">
                Part Code <span className="text-[#C2413A]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. RES-10K-0805"
                value={formData.partCode}
                onChange={(e) => setFormData({ ...formData, partCode: e.target.value.toUpperCase() })}
                className="input-enterprise uppercase font-mono"
              />
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Component Name <span className="text-[#C2413A]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Resistor SMD 10K 1%"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-enterprise"
              />
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Category <span className="text-[#C2413A]">*</span>
              </label>
              <select
                required
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="select-enterprise"
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Unit of Measurement <span className="text-[#C2413A]">*</span>
              </label>
              <select
                required
                value={formData.unitId}
                onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                className="select-enterprise"
              >
                <option value="">Select Unit</option>
                {units.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.shortCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Storage Location
              </label>
              <select
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                className="select-enterprise"
              >
                <option value="">Select Location</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Package / Footprint
              </label>
              <input
                type="text"
                placeholder="e.g. SMD 0805, DIP-8"
                value={formData.package}
                onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                className="input-enterprise font-mono"
              />
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Opening Stock (Initial Store Qty)
              </label>
              <input
                type="number"
                min="0"
                value={formData.openingStock}
                onChange={(e) => setFormData({ ...formData, openingStock: Math.max(0, parseInt(e.target.value) || 0) })}
                className="input-enterprise font-mono font-bold"
              />
              <span className="helper-text block mt-1">Auto-recorded to stock ledger</span>
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Minimum Safety Stock
              </label>
              <input
                type="number"
                min="0"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Math.max(0, parseInt(e.target.value) || 0) })}
                className="input-enterprise font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label-text block mb-1.5">
                Unit Purchase Rate (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.ratePerUnit}
                onChange={(e) => setFormData({ ...formData, ratePerUnit: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="input-enterprise font-mono"
              />
            </div>
          </div>

          {/* Technical Specifications */}
          <div className="pt-3 border-t border-[#E6E3DE]">
            <label className="label-text block mb-1.5">
              Technical Specifications (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Parameter (e.g. Voltage, Tolerance)"
                value={formData.specKey}
                onChange={(e) => setFormData({ ...formData, specKey: e.target.value })}
                className="input-enterprise flex-1"
              />
              <input
                type="text"
                placeholder="Value (e.g. 50V, 1%)"
                value={formData.specValue}
                onChange={(e) => setFormData({ ...formData, specValue: e.target.value })}
                className="input-enterprise flex-1"
              />
              <button
                type="button"
                onClick={handleAddSpec}
                className="btn-secondary h-9 py-1 px-3 text-xs"
              >
                Add
              </button>
            </div>

            {Object.keys(specList).length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#F7F6F3] rounded-[9px] border border-[#E6E3DE]">
                {Object.entries(specList).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E6E3DE] rounded-[6px] text-xs text-[#171717]"
                  >
                    <strong className="text-[#141414]">{k}:</strong> {v}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...specList };
                        delete updated[k];
                        setSpecList(updated);
                      }}
                      className="text-[#C2413A] hover:text-[#9B2C2C] ml-1 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: STOCK ADJUSTMENT ================= */}
      {activeComponent && (
        <Modal
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          size="md"
          icon={<Sliders className="w-5 h-5 text-[#807365]" />}
          title="Physical Stock Correction"
          subtitle={`Adjust recorded inventory for ${activeComponent.partCode}`}
          onSubmit={handleAdjustStock}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || adjustData.qtyChange === 0}
                className="btn-primary"
              >
                {submitting ? 'Saving...' : 'Commit to Ledger'}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="p-3 bg-[#F7F6F3] rounded-[9px] border border-[#E6E3DE] text-xs">
              <div className="flex items-center justify-between">
                <p className="font-mono font-bold text-[#141414]">{activeComponent.partCode}</p>
                <span className="text-[#6B6863]">{activeComponent.categoryId?.name}</span>
              </div>
              <p className="text-[#6B6863] truncate mt-0.5">{activeComponent.name}</p>
              <div className="mt-2.5 pt-2 border-t border-[#E6E3DE] flex justify-between font-mono text-xs">
                <span>In Store: <strong className="text-[#141414]">{activeComponent.inStoreStock}</strong></span>
                <span>Reserved: <strong className="text-[#D97706]">{activeComponent.reservedStock}</strong></span>
                <span>Available: <strong className="text-[#168060]">{activeComponent.availableStock}</strong></span>
              </div>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-[#C2413A]/10 border border-[#C2413A]/20 text-[#C2413A] text-xs">
                {formError}
              </div>
            )}

            <div>
              <label className="label-text block mb-1.5">
                Quantity Adjustment (+ Add, - Deduct) <span className="text-[#C2413A]">*</span>
              </label>
              <input
                type="number"
                required
                placeholder="e.g. +50 or -10"
                value={adjustData.qtyChange || ''}
                onChange={(e) => setAdjustData({ ...adjustData, qtyChange: parseInt(e.target.value) || 0 })}
                className="input-enterprise font-mono font-bold"
              />
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Mandatory Audit Reason <span className="text-[#C2413A]">*</span>
              </label>
              <select
                required
                value={adjustData.reason}
                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                className="select-enterprise"
              >
                <option value="count_correction">Physical Count Correction</option>
                <option value="damage">Damaged in Store</option>
                <option value="lost">Lost / Misplaced</option>
                <option value="other">Administrative Audit</option>
              </select>
            </div>

            <div>
              <label className="label-text block mb-1.5">
                Remarks / Notes
              </label>
              <textarea
                rows={2}
                placeholder="Notes for ledger..."
                value={adjustData.notes}
                onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-[9px] border border-[#E6E3DE] text-sm focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ================= MODAL: COMPONENT DETAILS & STOCK LEDGER ================= */}
      {activeComponent && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          size="2xl"
          icon={<Eye className="w-5 h-5 text-[#807365]" />}
          title={
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-white">
                {activeComponent.partCode}
              </span>
              <span className="badge-status badge-status-neutral text-[10px]">
                {activeComponent.categoryId?.name}
              </span>
            </div>
          }
          subtitle={activeComponent.name}
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
          <div className="space-y-6">
            {/* Odoo-Style 4-Way Inventory Position */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl border border-[#E6E3DE] bg-white">
                <p className="text-[11px] font-medium text-[#6B6863] uppercase tracking-wider">In Store</p>
                <p className="text-xl font-bold font-mono text-[#141414] mt-1">{activeComponent.inStoreStock}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-[#D97706]/30 bg-[#FFFBEB]">
                <p className="text-[11px] font-medium text-[#D97706] uppercase tracking-wider">Reserved</p>
                <p className="text-xl font-bold font-mono text-[#D97706] mt-1">{activeComponent.reservedStock}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-[#168060]/30 bg-[#F0FDF4]">
                <p className="text-[11px] font-medium text-[#168060] uppercase tracking-wider">Available</p>
                <p className="text-xl font-bold font-mono text-[#168060] mt-1">{activeComponent.availableStock}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-[#807365]/30 bg-[#F7F6F3]">
                <p className="text-[11px] font-medium text-[#807365] uppercase tracking-wider">With Vendor</p>
                <p className="text-xl font-bold font-mono text-[#807365] mt-1">{activeComponent.withVendorStock}</p>
              </div>
            </div>

            {/* Immutable Stock Movement Ledger Audit */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-[#807365]" />
                <h4 className="text-sm font-semibold text-[#171717] tracking-tight">
                  Immutable Movement Ledger (Audit Trail)
                </h4>
              </div>

              <div className="enterprise-card overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="th-enterprise">Timestamp</th>
                      <th className="th-enterprise">Action Type</th>
                      <th className="th-enterprise text-right">Delta</th>
                      <th className="th-enterprise text-right">Store Balance</th>
                      <th className="th-enterprise">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E3DE]/60 font-mono">
                    {componentLedger.map((row) => (
                      <tr key={row._id} className="tr-enterprise">
                        <td className="td-enterprise text-[#6B6863] text-xs">
                          {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="td-enterprise font-sans">
                          <span className="badge-status badge-status-indigo text-[10px]">
                            {row.type}
                          </span>
                        </td>
                        <td className={`td-enterprise text-right font-bold ${row.qtyChange >= 0 ? 'text-[#168060]' : 'text-[#C2413A]'}`}>
                          {row.qtyChange >= 0 ? `+${row.qtyChange}` : row.qtyChange}
                        </td>
                        <td className="td-enterprise text-right font-bold text-[#171717]">
                          {row.balanceInStoreAfter}
                        </td>
                        <td className="td-enterprise text-[#6B6863] font-sans text-xs italic">
                          {row.notes || row.adjustmentReason || '—'}
                        </td>
                      </tr>
                    ))}
                    {componentLedger.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-xs text-[#A69B8D] italic font-sans">
                          No ledger transactions recorded for this component yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
