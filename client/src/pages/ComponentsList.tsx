import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import { SimpleSelect } from '../components/ui/Select';
import { FormField } from '../components/ui/FormField';
import { ValidatedInput, ValidatedTextarea } from '../components/ui/ValidatedInput';
import { toast } from '../utils/toast';
import { handleApiError } from '../utils/apiErrors';
import {
  componentSchema,
  ComponentFormData,
  stockAdjustmentSchema,
  StockAdjustmentFormData,
} from '../utils/validationSchemas';
import {
  Cpu,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  AlertCircle,
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
  Upload,
  FileDown,
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
  const [errorMsg, setErrorMsg] = useState('');

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

  // Specs state for Add Component
  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');
  const [specList, setSpecList] = useState<{ [key: string]: string }>({});

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Bulk Import
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<Record<string, string>[]>([]);
  const [bulkErrors, setBulkErrors] = useState<{ row: number; partCode: string; message: string }[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);

  // React Hook Form for Add Component
  const addForm = useForm<ComponentFormData>({
    resolver: zodResolver(componentSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      partCode: '',
      name: '',
      categoryId: '',
      unitId: '',
      locationId: '',
      package: '',
      openingStock: 0,
      minStock: 0,
      ratePerUnit: 0,
    },
  });

  // React Hook Form for Stock Adjustment
  const adjustForm = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      qtyChange: 0,
      reason: 'count_correction',
      notes: '',
    },
  });

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
    } catch (err: any) {
      console.error('Failed to load masters:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load categories/units/locations');
    }
  };

  const fetchComponents = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      if (lowStockOnly) params.append('lowStockOnly', 'true');

      const res = await api.get(`/components?${params.toString()}`);
      setComponents(res.data.data);
    } catch (err: any) {
      console.error('Failed to load components:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load components');
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
    resetAdjustForm();
    setShowAdjustModal(true);
  };

  const handleAddSpec = () => {
    if (specKey.trim() && specValue.trim()) {
      setSpecList({ ...specList, [specKey.trim()]: specValue.trim() });
      setSpecKey('');
      setSpecValue('');
    }
  };

  const handleCreateComponent = async (data: ComponentFormData) => {
    setFormError('');
    setSubmitting(true);

    try {
      await api.post('/components', {
        partCode: data.partCode.trim().toUpperCase(),
        name: data.name.trim(),
        categoryId: data.categoryId,
        unitId: data.unitId,
        locationId: data.locationId || undefined,
        package: data.package?.trim() || undefined,
        minStock: Number(data.minStock) || 0,
        ratePerUnit: Number(data.ratePerUnit) || 0,
        openingStock: Number(data.openingStock) || 0,
        specifications: specList,
      });

      toast.success(`Component '${data.partCode.toUpperCase()}' created successfully.`);
      setShowAddModal(false);
      resetAddForm();
      fetchComponents();
    } catch (err: any) {
      const msg = handleApiError(err, addForm.setError, 'Failed to create component');
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (data: StockAdjustmentFormData) => {
    if (!activeComponent) return;

    setFormError('');
    setSubmitting(true);

    try {
      await api.post(`/components/${activeComponent._id}/adjust`, {
        qtyChange: Number(data.qtyChange),
        reason: data.reason,
        notes: data.notes?.trim() || undefined,
      });

      toast.success(`Stock adjustment for ${activeComponent.partCode} committed to ledger.`);
      setShowAdjustModal(false);
      fetchComponents();
    } catch (err: any) {
      const msg = handleApiError(err, adjustForm.setError, 'Failed to adjust stock');
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetAddForm = () => {
    addForm.reset({
      partCode: '',
      name: '',
      categoryId: '',
      unitId: '',
      locationId: '',
      package: '',
      openingStock: 0,
      minStock: 0,
      ratePerUnit: 0,
    });
    setSpecList({});
    setSpecKey('');
    setSpecValue('');
    setFormError('');
  };

  const resetAdjustForm = () => {
    adjustForm.reset({
      qtyChange: 0,
      reason: 'count_correction',
      notes: '',
    });
    setFormError('');
  };

  const handleExportCSV = () => {
    const headers = ['Part Code', 'Name', 'Category', 'Package', 'In Store Stock', 'Reserved', 'With Vendor', 'Min Stock', 'Unit', 'Rate/Unit (INR)', 'Location'];
    const rows = components.map((c) => [
      c.partCode,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.categoryId?.name || ''}"`,
      c.package || '',
      c.inStoreStock,
      c.reservedStock,
      c.withVendorStock,
      c.minStock,
      c.unitId?.shortCode || '',
      c.ratePerUnit,
      `"${c.locationId?.name || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `wave_components_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Component catalog exported to CSV.');
  };

  const handleDownloadBulkTemplate = () => {
    const headers = ['partCode', 'name', 'categoryName', 'unitName', 'locationName', 'package', 'minStock', 'ratePerUnit', 'openingStock'];
    const sampleRow = ['RES-1K-0805', 'Resistor 1K 0805', categories[0]?.name || 'Resistors', units[0]?.name || 'Pieces', locations[0]?.name || '', '0805', '100', '0.50', '500'];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), sampleRow.join(',')].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'wave_bulk_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.warning('CSV file has no data rows');
        return;
      }
      const headers = lines[0].split(',').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = cells[i] || '';
        });
        return row;
      });
      setBulkRows(rows);
      setBulkErrors([]);
    };
    reader.readAsText(file);
  };

  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseCsvFile(file);
  };

  // Client-side preview check only - the backend re-validates everything
  // (duplicate part codes, category/unit existence) before committing, so
  // this is purely for fast feedback, never the source of truth.
  const getRowPreviewIssue = (row: Record<string, string>): string | null => {
    if (!row.partCode?.trim()) return 'Missing part code';
    if (!row.name?.trim()) return 'Missing name';
    if (!row.categoryName?.trim()) return 'Missing category';
    if (!row.unitName?.trim()) return 'Missing unit';
    if (!categories.some((c) => c.name.toLowerCase() === row.categoryName.trim().toLowerCase())) {
      return `Unknown category '${row.categoryName}'`;
    }
    if (!units.some((u) => u.name.toLowerCase() === row.unitName.trim().toLowerCase())) {
      return `Unknown unit '${row.unitName}'`;
    }
    return null;
  };

  const handleSubmitBulkImport = async () => {
    setBulkImporting(true);
    setBulkErrors([]);
    try {
      const payload = bulkRows.map((r) => ({
        partCode: r.partCode,
        name: r.name,
        categoryName: r.categoryName,
        unitName: r.unitName,
        locationName: r.locationName,
        package: r.package,
        minStock: r.minStock,
        ratePerUnit: r.ratePerUnit,
        openingStock: r.openingStock,
      }));
      const res = await api.post('/components/bulk-import', { rows: payload });
      toast.success(res.data.message || 'Bulk import completed successfully.');
      setShowBulkImportModal(false);
      setBulkRows([]);
      fetchComponents();
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setBulkErrors(err.response.data.errors);
        toast.error(err.response.data.message || 'Bulk import validation failed');
      } else {
        handleApiError(err, undefined, 'Bulk import failed');
      }
    } finally {
      setBulkImporting(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Top Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E6E3DE]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#171717] tracking-tight">Component Stock & Catalog</h1>
            <span className="badge-status badge-status-neutral text-[11px] font-mono">
              {components.length} items
            </span>
          </div>
          <p className="text-xs text-[#6B6863] mt-0.5">
            Active electronic components, storage balances, and immutable movement ledger.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button onClick={handleExportCSV} className="btn-secondary" title="Export catalog to CSV">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#807365]" />
            <span>Export</span>
          </button>
          {isStoreKeeper && (
            <>
              <button
                onClick={() => {
                  setBulkRows([]);
                  setBulkErrors([]);
                  setShowBulkImportModal(true);
                }}
                className="btn-secondary"
              >
                <Upload className="w-3.5 h-3.5 text-[#807365]" />
                <span>Bulk Import</span>
              </button>
              <button
                onClick={() => {
                  resetAddForm();
                  setShowAddModal(true);
                }}
                className="btn-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Component</span>
              </button>
            </>
          )}
        </div>
      </div>

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

      {/* Advanced Search & Filter Bar */}
      <div className="enterprise-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="flex-1 w-full relative">
          <Search className="w-3.5 h-3.5 text-[#807365] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter by part code, description, footprint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise !pl-9 !h-9 text-xs"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Category Dropdown Filter */}
          <SimpleSelect
            value={selectedCategory}
            onChange={setSelectedCategory}
            placeholder={`All Categories (${categories.length})`}
            options={[
              { value: '', label: `All Categories (${categories.length})` },
              ...categories.map((cat) => ({ value: cat._id, label: cat.name })),
            ]}
            triggerClassName="!h-9 text-xs !w-48"
          />

          {/* Low Stock Toggle Badge Filter */}
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              lowStockOnly
                ? 'bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/40 font-semibold'
                : 'bg-white text-[#6B6863] border-[#E6E3DE] hover:bg-[#F7F6F3]'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${lowStockOnly ? 'text-[#B7791F]' : 'text-[#A69B8D]'}`} />
            <span>Low Stock</span>
          </button>
        </div>
      </div>

      {/* Compact, Highly Readable Data Table (Attio & Linear Inspired) */}
      <div className="shadcn-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E7E4DE]">
            <thead className="sticky top-0 z-10 bg-[#FAF9F7]/95">
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
            <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
              {loading ? (
                <TableSkeleton rows={8} cols={10} />
              ) : components.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16">
                    <Cpu className="w-8 h-8 text-[#A69B8D] mx-auto mb-2 opacity-60" />
                    <h3 className="text-xs font-bold text-[#171717]">No components match your query</h3>
                    <p className="text-[11px] text-[#716B64] mt-0.5">Try resetting search filters or create a new part.</p>
                  </td>
                </tr>
              ) : (
                components.map((comp) => {
                  const isLow = comp.inStoreStock <= comp.minStock;
                  return (
                    <tr key={comp._id} className="table-row-interactive">
                      {/* Part Code */}
                      <td className="table-compact-td">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#171717]">
                            {comp.partCode}
                          </span>
                          {isLow && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-[#B7791F]"
                              title={`Below safety reserve (${comp.minStock})`}
                            ></span>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="table-compact-td font-medium text-[#171717] max-w-xs truncate">
                        {comp.name}
                      </td>

                      {/* Category */}
                      <td className="table-compact-td text-[#6B6863]">
                        {comp.categoryId?.name || '-'}
                      </td>

                      {/* Footprint / Package */}
                      <td className="table-compact-td">
                        {comp.package ? (
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F7F6F3] text-[#383531]">
                            {comp.package}
                          </span>
                        ) : (
                          <span className="text-[#A69B8D]">-</span>
                        )}
                      </td>

                      {/* In Store Stock (Physical on shelves) */}
                      <td className="table-compact-td text-right font-mono font-bold text-[#171717]">
                        {comp.inStoreStock}{' '}
                        <span className="text-[10px] text-[#A69B8D] font-normal">
                          {comp.unitId?.shortCode}
                        </span>
                      </td>

                      {/* Reserved (Allocated to approved jobs) */}
                      <td className="table-compact-td text-right font-mono text-[#B7791F] font-medium">
                        {comp.reservedStock}
                      </td>

                      {/* Available (Free to allocate) */}
                      <td className="table-compact-td text-right font-mono font-bold text-[#168060]">
                        {comp.availableStock ?? Math.max(0, comp.inStoreStock - comp.reservedStock)}
                      </td>

                      {/* Rate */}
                      <td className="table-compact-td text-right font-mono text-[#6B6863]">
                        ₹{comp.ratePerUnit.toFixed(2)}
                      </td>

                      {/* Location */}
                      <td className="table-compact-td text-[#6B6863]">
                        {comp.locationId?.name ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#6B6863]">
                            <MapPin className="w-3 h-3 text-[#A69B8D]" />
                            {comp.locationId.name}
                          </span>
                        ) : (
                          <span className="text-[#A69B8D] italic text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="table-compact-td text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenDetails(comp)}
                            title="View Stock Breakdown & Ledger Audit"
                            className="btn-ghost p-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#6B6863]" />
                          </button>
                          {isStoreKeeper && (
                            <button
                              onClick={() => handleOpenAdjust(comp)}
                              title="Stock Adjustment"
                              className="btn-ghost p-1 text-[#B7791F] hover:text-[#8f5e17] hover:bg-[#B7791F]/10"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: ADD COMPONENT ================= */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="xl"
        icon={<Cpu className="w-5 h-5 text-[#807365]" />}
        title="Add New Component"
        subtitle="Configure part details and initialize opening stock ledger."
        onSubmit={addForm.handleSubmit(handleCreateComponent)}
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
              disabled={submitting || addForm.formState.isSubmitting}
              className="btn-primary"
            >
              {(submitting || addForm.formState.isSubmitting) && <ButtonSpinner />}
              <span>{submitting || addForm.formState.isSubmitting ? 'Saving Component...' : 'Save Component'}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div role="alert" className="p-3 rounded-lg bg-[#C2413A]/10 border border-[#C2413A]/20 text-[#C2413A] text-xs">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Part Code"
              required
              error={addForm.formState.errors.partCode?.message}
              id="partCode"
            >
              <ValidatedInput
                id="partCode"
                placeholder="e.g. RES-10K-0805"
                className="uppercase font-mono"
                hasError={Boolean(addForm.formState.errors.partCode)}
                {...addForm.register('partCode')}
              />
            </FormField>

            <FormField
              label="Component Name"
              required
              error={addForm.formState.errors.name?.message}
              id="compName"
            >
              <ValidatedInput
                id="compName"
                placeholder="e.g. Resistor SMD 10K 1%"
                hasError={Boolean(addForm.formState.errors.name)}
                {...addForm.register('name')}
              />
            </FormField>

            <FormField
              label="Category"
              required
              error={addForm.formState.errors.categoryId?.message}
              id="categoryId"
            >
              <Controller
                control={addForm.control}
                name="categoryId"
                render={({ field }) => (
                  <SimpleSelect
                    id="categoryId"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Category"
                    hasError={Boolean(addForm.formState.errors.categoryId)}
                    options={categories.map((c) => ({ value: c._id, label: c.name }))}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Unit of Measurement"
              required
              error={addForm.formState.errors.unitId?.message}
              id="unitId"
            >
              <Controller
                control={addForm.control}
                name="unitId"
                render={({ field }) => (
                  <SimpleSelect
                    id="unitId"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select Unit"
                    hasError={Boolean(addForm.formState.errors.unitId)}
                    options={units.map((u) => ({
                      value: u._id,
                      label: `${u.name} (${u.shortCode})`,
                    }))}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Storage Location"
              optional
              error={addForm.formState.errors.locationId?.message}
              id="locationId"
            >
              <Controller
                control={addForm.control}
                name="locationId"
                render={({ field }) => (
                  <SimpleSelect
                    id="locationId"
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Select Location"
                    hasError={Boolean(addForm.formState.errors.locationId)}
                    options={[
                      { value: '', label: 'None (Unassigned)' },
                      ...locations.map((l) => ({ value: l._id, label: l.name })),
                    ]}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Package / Footprint"
              optional
              error={addForm.formState.errors.package?.message}
              id="pkg"
            >
              <ValidatedInput
                id="pkg"
                placeholder="e.g. SMD 0805, DIP-8"
                className="font-mono"
                hasError={Boolean(addForm.formState.errors.package)}
                {...addForm.register('package')}
              />
            </FormField>

            <FormField
              label="Opening Stock (Initial Store Qty)"
              optional
              helperText="Auto-recorded to stock ledger"
              error={addForm.formState.errors.openingStock?.message}
              id="openingStock"
            >
              <ValidatedInput
                id="openingStock"
                type="number"
                min="0"
                className="font-mono font-bold"
                hasError={Boolean(addForm.formState.errors.openingStock)}
                {...addForm.register('openingStock')}
              />
            </FormField>

            <FormField
              label="Minimum Safety Stock"
              optional
              error={addForm.formState.errors.minStock?.message}
              id="minStock"
            >
              <ValidatedInput
                id="minStock"
                type="number"
                min="0"
                className="font-mono"
                hasError={Boolean(addForm.formState.errors.minStock)}
                {...addForm.register('minStock')}
              />
            </FormField>

            <div className="sm:col-span-2">
              <FormField
                label="Unit Purchase Rate (₹)"
                optional
                error={addForm.formState.errors.ratePerUnit?.message}
                id="ratePerUnit"
              >
                <ValidatedInput
                  id="ratePerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  className="font-mono"
                  hasError={Boolean(addForm.formState.errors.ratePerUnit)}
                  {...addForm.register('ratePerUnit')}
                />
              </FormField>
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
                value={specKey}
                onChange={(e) => setSpecKey(e.target.value)}
                className="input-enterprise flex-1"
              />
              <input
                type="text"
                placeholder="Value (e.g. 50V, 1%)"
                value={specValue}
                onChange={(e) => setSpecValue(e.target.value)}
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
          onSubmit={adjustForm.handleSubmit(handleAdjustStock)}
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
                disabled={submitting || adjustForm.formState.isSubmitting}
                className="btn-primary"
              >
                {(submitting || adjustForm.formState.isSubmitting) && <ButtonSpinner />}
                <span>{submitting || adjustForm.formState.isSubmitting ? 'Committing...' : 'Commit to Ledger'}</span>
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
                <span>Reserved: <strong className="text-[#B7791F]">{activeComponent.reservedStock}</strong></span>
                <span>Available: <strong className="text-[#168060]">{activeComponent.availableStock}</strong></span>
              </div>
            </div>

            {formError && (
              <div role="alert" className="p-2.5 rounded-lg bg-[#C2413A]/10 border border-[#C2413A]/20 text-[#C2413A] text-xs">
                {formError}
              </div>
            )}

            <FormField
              label="Quantity Adjustment (+ Add, - Deduct)"
              required
              error={adjustForm.formState.errors.qtyChange?.message}
              id="qtyChange"
            >
              <ValidatedInput
                id="qtyChange"
                type="number"
                placeholder="e.g. +50 or -10"
                className="font-mono font-bold"
                hasError={Boolean(adjustForm.formState.errors.qtyChange)}
                {...adjustForm.register('qtyChange')}
              />
            </FormField>

            <FormField
              label="Mandatory Audit Reason"
              required
              error={adjustForm.formState.errors.reason?.message}
              id="adjustReason"
            >
              <Controller
                control={adjustForm.control}
                name="reason"
                render={({ field }) => (
                  <SimpleSelect
                    id="adjustReason"
                    value={field.value}
                    onChange={field.onChange}
                    hasError={Boolean(adjustForm.formState.errors.reason)}
                    options={[
                      { value: 'count_correction', label: 'Physical Count Correction' },
                      { value: 'damage', label: 'Damaged in Store' },
                      { value: 'lost', label: 'Lost / Misplaced' },
                      { value: 'other', label: 'Administrative Audit' },
                    ]}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Remarks / Notes"
              optional
              error={adjustForm.formState.errors.notes?.message}
              id="adjustNotes"
            >
              <ValidatedTextarea
                id="adjustNotes"
                rows={2}
                placeholder="Notes for ledger..."
                hasError={Boolean(adjustForm.formState.errors.notes)}
                {...adjustForm.register('notes')}
              />
            </FormField>
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
              <div className="p-3.5 rounded-xl border border-[#B7791F]/30 bg-[#B7791F]/5">
                <p className="text-[11px] font-medium text-[#B7791F] uppercase tracking-wider">Reserved</p>
                <p className="text-xl font-bold font-mono text-[#B7791F] mt-1">{activeComponent.reservedStock}</p>
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

      {/* BULK IMPORT MODAL */}
      <Modal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        size="2xl"
        icon={<Upload className="w-5 h-5 text-[#807365]" />}
        title="Bulk Import Components"
        subtitle="Download the template, fill it in, upload it, and preview before saving."
        footer={
          <>
            <button type="button" onClick={() => setShowBulkImportModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitBulkImport}
              disabled={bulkImporting || bulkRows.length === 0}
              className="btn-primary"
            >
              {bulkImporting ? <ButtonSpinner /> : <Upload className="w-4 h-4" />}
              <span>Import {bulkRows.length > 0 ? `${bulkRows.length} Row(s)` : ''}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={handleDownloadBulkTemplate} className="btn-secondary text-xs">
              <FileDown className="w-3.5 h-3.5 text-[#807365]" />
              <span>Download CSV Template</span>
            </button>
            <label className="btn-secondary text-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-[#807365]" />
              <span>Choose CSV File</span>
              <input type="file" accept=".csv" onChange={handleBulkFileChange} className="hidden" />
            </label>
          </div>

          {bulkErrors.length > 0 && (
            <div className="p-3 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/30 text-xs text-[#C2413A] space-y-1 max-h-40 overflow-y-auto">
              <div className="font-semibold">Server validation failed - nothing was imported:</div>
              {bulkErrors.map((e, i) => (
                <div key={i}>
                  Row {e.row} ({e.partCode}): {e.message}
                </div>
              ))}
            </div>
          )}

          {bulkRows.length > 0 && (
            <div className="enterprise-card overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className="th-enterprise">#</th>
                    <th className="th-enterprise">Part Code</th>
                    <th className="th-enterprise">Name</th>
                    <th className="th-enterprise">Category</th>
                    <th className="th-enterprise">Unit</th>
                    <th className="th-enterprise text-right">Opening Stock</th>
                    <th className="th-enterprise">Issue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E3DE]/60">
                  {bulkRows.map((row, idx) => {
                    const issue = getRowPreviewIssue(row);
                    return (
                      <tr key={idx} className={issue ? 'bg-[#C2413A]/5' : ''}>
                        <td className="td-enterprise">{idx + 1}</td>
                        <td className="td-enterprise font-mono">{row.partCode}</td>
                        <td className="td-enterprise">{row.name}</td>
                        <td className="td-enterprise">{row.categoryName}</td>
                        <td className="td-enterprise">{row.unitName}</td>
                        <td className="td-enterprise text-right font-mono">{row.openingStock || 0}</td>
                        <td className="td-enterprise">
                          {issue ? (
                            <span className="text-[#C2413A] font-medium">{issue}</span>
                          ) : (
                            <span className="text-[#168060] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
