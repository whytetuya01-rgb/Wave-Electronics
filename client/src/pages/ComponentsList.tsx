import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
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
    <div className="space-y-4 max-w-7xl mx-auto">
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

      {/* ================= SHADCN-STYLE MODAL: ADD COMPONENT ================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full p-6 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Add New Component</h3>
                <p className="text-xs text-slate-500">Configure part details and initialize opening stock ledger.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateComponent} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Part Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RES-10K-0805"
                    value={formData.partCode}
                    onChange={(e) => setFormData({ ...formData, partCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 text-xs uppercase font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Component Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Resistor SMD 10K 1%"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit of Measurement <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.unitId}
                    onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Storage Location
                  </label>
                  <select
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Package / Footprint
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SMD 0805, DIP-8"
                    value={formData.package}
                    onChange={(e) => setFormData({ ...formData, package: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Stock (Initial Store Qty)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.openingStock}
                    onChange={(e) => setFormData({ ...formData, openingStock: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                  />
                  <span className="text-[10px] text-slate-500">Auto-recorded to stock ledger</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Minimum Safety Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Purchase Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.ratePerUnit}
                    onChange={(e) => setFormData({ ...formData, ratePerUnit: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                  />
                </div>
              </div>

              {/* Technical Specifications (Optional) */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Technical Specifications (Optional)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Parameter (e.g. Voltage, Tolerance)"
                    value={formData.specKey}
                    onChange={(e) => setFormData({ ...formData, specKey: e.target.value })}
                    className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 50V, 1%)"
                    value={formData.specValue}
                    onChange={(e) => setFormData({ ...formData, specValue: e.target.value })}
                    className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={handleAddSpec}
                    className="btn-linear-secondary py-1 text-xs"
                  >
                    Add
                  </button>
                </div>

                {Object.keys(specList).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-md border border-slate-200">
                    {Object.entries(specList).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-700"
                      >
                        <strong>{k}:</strong> {v}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...specList };
                            delete updated[k];
                            setSpecList(updated);
                          }}
                          className="text-red-500 hover:text-red-700 ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-linear-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-linear-primary"
                >
                  {submitting ? 'Saving...' : 'Save Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: STOCK ADJUSTMENT ================= */}
      {showAdjustModal && activeComponent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full p-5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Physical Stock Correction</h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs">
              <p className="font-mono font-bold text-[#4F46E5]">{activeComponent.partCode}</p>
              <p className="text-slate-600 truncate">{activeComponent.name}</p>
              <div className="mt-2 pt-1.5 border-t border-slate-200 flex justify-between font-mono text-[11px]">
                <span>In Store: <strong>{activeComponent.inStoreStock}</strong></span>
                <span>Reserved: <strong className="text-amber-600">{activeComponent.reservedStock}</strong></span>
              </div>
            </div>

            {formError && (
              <div className="mt-2.5 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleAdjustStock} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Quantity Adjustment (+ Add, - Deduct)
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. +50 or -10"
                  value={adjustData.qtyChange || ''}
                  onChange={(e) => setAdjustData({ ...adjustData, qtyChange: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason
                </label>
                <select
                  required
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                >
                  <option value="count_correction">Physical Count Correction</option>
                  <option value="damage">Damaged in Store</option>
                  <option value="lost">Lost / Misplaced</option>
                  <option value="other">Administrative Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes for ledger..."
                  value={adjustData.notes}
                  onChange={(e) => setAdjustData({ ...adjustData, notes: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="btn-linear-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || adjustData.qtyChange === 0}
                  className="btn-linear-primary"
                >
                  {submitting ? 'Saving...' : 'Commit to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: COMPONENT DETAILS & STOCK LEDGER ================= */}
      {showDetailsModal && activeComponent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-[#4F46E5]">
                    {activeComponent.partCode}
                  </span>
                  <span className="badge-status badge-status-neutral text-[10px]">
                    {activeComponent.categoryId?.name}
                  </span>
                </div>
                <h3 className="text-xs font-semibold text-slate-800 mt-0.5">{activeComponent.name}</h3>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Odoo-Style 4-Way Inventory Position */}
            <div className="grid grid-cols-4 gap-2.5 my-3.5">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <p className="text-[10px] font-semibold text-slate-500 uppercase">In Store</p>
                <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{activeComponent.inStoreStock}</p>
              </div>
              <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50">
                <p className="text-[10px] font-semibold text-[#D97706] uppercase">Reserved</p>
                <p className="text-lg font-bold font-mono text-[#D97706] mt-0.5">{activeComponent.reservedStock}</p>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                <p className="text-[10px] font-semibold text-[#059669] uppercase">Available</p>
                <p className="text-lg font-bold font-mono text-[#059669] mt-0.5">{activeComponent.availableStock}</p>
              </div>
              <div className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50">
                <p className="text-[10px] font-semibold text-[#4F46E5] uppercase">With Vendor</p>
                <p className="text-lg font-bold font-mono text-[#4F46E5] mt-0.5">{activeComponent.withVendorStock}</p>
              </div>
            </div>

            {/* Immutable Stock Movement Ledger Audit */}
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-[#4F46E5]" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Immutable Movement Ledger (Audit Trail)
                </h4>
              </div>

              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Timestamp</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Action Type</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Delta</th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-600">Store Balance</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-600">Reference / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono">
                    {componentLedger.map((row) => (
                      <tr key={row._id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 text-[11px]">
                          {new Date(row.createdAt).toLocaleDateString()} {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2">
                          <span className="badge-status badge-status-indigo text-[10px]">
                            {row.type}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${row.qtyChange >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                          {row.qtyChange >= 0 ? `+${row.qtyChange}` : row.qtyChange}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {row.balanceInStoreAfter}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-sans text-xs italic">
                          {row.notes || row.adjustmentReason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
