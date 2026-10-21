import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FolderTree, Ruler, MapPin, Plus, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import { FormField } from '../components/ui/FormField';
import { ValidatedInput, ValidatedTextarea } from '../components/ui/ValidatedInput';
import { toast } from '../utils/toast';
import {
  masterCategorySchema,
  masterUnitSchema,
  masterLocationSchema,
} from '../utils/validationSchemas';
import type { z } from 'zod';
import { applyServerValidationErrors, getApiErrorMessage } from '../utils/apiErrors';

type CategoryFormData = z.infer<typeof masterCategorySchema>;
type UnitFormData = z.infer<typeof masterUnitSchema>;
type LocationFormData = z.infer<typeof masterLocationSchema>;

export const Masters: React.FC = () => {
  const { isStoreKeeper, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'categories' | 'units' | 'locations'>('categories');

  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Category Form
  const {
    register: registerCat,
    handleSubmit: handleSubmitCat,
    reset: resetCat,
    setError: setCatError,
    formState: { errors: catErrors, isSubmitting: isCatSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(masterCategorySchema),
    mode: 'onBlur',
    defaultValues: { name: '', description: '' },
  });

  // Unit Form
  const {
    register: registerUnit,
    handleSubmit: handleSubmitUnit,
    reset: resetUnit,
    setError: setUnitError,
    formState: { errors: unitErrors, isSubmitting: isUnitSubmitting },
  } = useForm<UnitFormData>({
    resolver: zodResolver(masterUnitSchema),
    mode: 'onBlur',
    defaultValues: { name: '', shortCode: '' },
  });

  // Location Form
  const {
    register: registerLoc,
    handleSubmit: handleSubmitLoc,
    reset: resetLoc,
    setError: setLocError,
    formState: { errors: locErrors, isSubmitting: isLocSubmitting },
  } = useForm<LocationFormData>({
    resolver: zodResolver(masterLocationSchema),
    mode: 'onBlur',
    defaultValues: { name: '', zone: '', description: '' },
  });

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    type: 'category' | 'unit' | 'location';
    name: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchMasters();
  }, []);

  const fetchMasters = async () => {
    try {
      setLoading(true);
      const [catRes, unitRes, locRes] = await Promise.all([
        api.get('/masters/categories'),
        api.get('/masters/units'),
        api.get('/masters/locations'),
      ]);
      setCategories(catRes.data);
      setUnits(unitRes.data);
      setLocations(locRes.data);
    } catch (err: any) {
      console.error(err);
      toast.error('Unable to load master data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (data: CategoryFormData) => {
    try {
      await api.post('/masters/categories', {
        name: data.name.trim(),
        description: data.description?.trim() || '',
      });
      resetCat();
      toast.success('Category created successfully');
      fetchMasters();
    } catch (err: any) {
      const fieldErrorFound = applyServerValidationErrors(err, setCatError);
      if (!fieldErrorFound) {
        toast.error(getApiErrorMessage(err, 'Failed to add category'));
      }
    }
  };

  const handleDeleteCategory = (cat: any) => {
    setDeleteTarget({ id: cat._id, type: 'category', name: cat.name });
  };

  const handleAddUnit = async (data: UnitFormData) => {
    try {
      await api.post('/masters/units', {
        name: data.name.trim(),
        shortCode: data.shortCode.trim().toUpperCase(),
      });
      resetUnit();
      toast.success('Unit created successfully');
      fetchMasters();
    } catch (err: any) {
      const fieldErrorFound = applyServerValidationErrors(err, setUnitError);
      if (!fieldErrorFound) {
        toast.error(getApiErrorMessage(err, 'Failed to add unit'));
      }
    }
  };

  const handleDeleteUnit = (u: any) => {
    setDeleteTarget({ id: u._id, type: 'unit', name: `${u.name} (${u.shortCode})` });
  };

  const handleAddLocation = async (data: LocationFormData) => {
    try {
      await api.post('/masters/locations', {
        name: data.name.trim(),
        zone: data.zone?.trim() || '',
        description: data.description?.trim() || '',
      });
      resetLoc();
      toast.success('Storage location created successfully');
      fetchMasters();
    } catch (err: any) {
      const fieldErrorFound = applyServerValidationErrors(err, setLocError);
      if (!fieldErrorFound) {
        toast.error(getApiErrorMessage(err, 'Failed to add location'));
      }
    }
  };

  const handleDeleteLocation = (l: any) => {
    setDeleteTarget({ id: l._id, type: 'location', name: l.name });
  };

  const executeDeleteTarget = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'category') {
        await api.delete(`/masters/categories/${deleteTarget.id}`);
        toast.success(`Category '${deleteTarget.name}' deleted successfully`);
      } else if (deleteTarget.type === 'unit') {
        await api.delete(`/masters/units/${deleteTarget.id}`);
        toast.success(`Unit '${deleteTarget.name}' deleted successfully`);
      } else if (deleteTarget.type === 'location') {
        await api.delete(`/masters/locations/${deleteTarget.id}`);
        toast.success(`Location '${deleteTarget.name}' deleted successfully`);
      }
      setDeleteTarget(null);
      fetchMasters();
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, `Failed to delete ${deleteTarget.type}`));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-4 w-full">
      <div className="pb-2 border-b border-[#E6E3DE]">
        <h1 className="text-xl font-bold text-[#171717] tracking-tight">Master Data Management</h1>
        <p className="text-xs text-[#6B6863] mt-0.5">
          Component categories, units of measurement, and physical warehouse bin locations.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E6E3DE]">
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'categories'
              ? 'border-[#807365] text-[#171717]'
              : 'border-transparent text-[#6B6863] hover:text-[#171717]'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'units'
              ? 'border-[#807365] text-[#171717]'
              : 'border-transparent text-[#6B6863] hover:text-[#171717]'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          Units ({units.length})
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'locations'
              ? 'border-[#807365] text-[#171717]'
              : 'border-transparent text-[#6B6863] hover:text-[#171717]'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Storage Locations ({locations.length})
        </button>
      </div>

      {/* TAB 1: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 enterprise-card p-4 h-fit">
            <h3 className="text-xs font-bold text-[#171717] mb-2.5">Add Category</h3>
            <form onSubmit={handleSubmitCat(handleAddCategory)} className="space-y-3" noValidate>
              <FormField label="Category Name" error={catErrors.name?.message} required>
                <ValidatedInput
                  type="text"
                  placeholder="e.g. Optocouplers"
                  hasError={!!catErrors.name}
                  {...registerCat('name')}
                />
              </FormField>
              <FormField label="Description" error={catErrors.description?.message}>
                <ValidatedTextarea
                  rows={2}
                  placeholder="Description..."
                  hasError={!!catErrors.description}
                  {...registerCat('description')}
                />
              </FormField>
              <button
                type="submit"
                disabled={isCatSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isCatSubmitting && <ButtonSpinner />}
                <span>Create Category</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-2 enterprise-card overflow-hidden">
            <table className="min-w-full divide-y divide-[#E6E3DE]">
              <thead>
                <tr>
                  <th className="th-enterprise">Category Name</th>
                  <th className="th-enterprise">Description</th>
                  {isAdmin && <th className="th-enterprise text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
                {loading ? (
                  <TableSkeleton rows={4} cols={isAdmin ? 3 : 2} />
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="py-8 text-center text-xs text-[#716B64]">
                      No categories added yet
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat._id} className="tr-enterprise">
                      <td className="td-enterprise font-semibold text-[#171717]">{cat.name}</td>
                      <td className="td-enterprise text-[#6B6863] text-xs">{cat.description || '-'}</td>
                      {isAdmin && (
                        <td className="td-enterprise text-right">
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            title="Delete Category"
                            className="btn-ghost p-1 text-[#A69B8D] hover:text-[#C2413A]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeTab === 'units' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 enterprise-card p-4 h-fit">
            <h3 className="text-xs font-bold text-[#171717] mb-2.5">Add Unit</h3>
            <form onSubmit={handleSubmitUnit(handleAddUnit)} className="space-y-3" noValidate>
              <FormField label="Unit Name" error={unitErrors.name?.message} required>
                <ValidatedInput
                  type="text"
                  placeholder="e.g. Kilograms"
                  hasError={!!unitErrors.name}
                  {...registerUnit('name')}
                />
              </FormField>
              <FormField label="Short Code" error={unitErrors.shortCode?.message} required hint="e.g. KG, NOS, MTR">
                <ValidatedInput
                  type="text"
                  placeholder="e.g. KG"
                  className="uppercase font-mono"
                  hasError={!!unitErrors.shortCode}
                  {...registerUnit('shortCode')}
                />
              </FormField>
              <button
                type="submit"
                disabled={isUnitSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isUnitSubmitting && <ButtonSpinner />}
                <span>Create Unit</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-2 enterprise-card overflow-hidden">
            <table className="min-w-full divide-y divide-[#E6E3DE]">
              <thead>
                <tr>
                  <th className="th-enterprise">Unit Name</th>
                  <th className="th-enterprise">Short Code</th>
                  {isAdmin && <th className="th-enterprise text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
                {loading ? (
                  <TableSkeleton rows={4} cols={isAdmin ? 3 : 2} />
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 3 : 2} className="py-8 text-center text-xs text-[#716B64]">
                      No units added yet
                    </td>
                  </tr>
                ) : (
                  units.map((u) => (
                    <tr key={u._id} className="tr-enterprise">
                      <td className="td-enterprise font-semibold text-[#171717]">{u.name}</td>
                      <td className="td-enterprise font-mono font-bold text-[#171717]">{u.shortCode}</td>
                      {isAdmin && (
                        <td className="td-enterprise text-right">
                          <button
                            onClick={() => handleDeleteUnit(u)}
                            title="Delete Unit"
                            className="btn-ghost p-1 text-[#A69B8D] hover:text-[#C2413A]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE LOCATIONS */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 enterprise-card p-4 h-fit">
            <h3 className="text-xs font-bold text-[#171717] mb-2.5">Add Storage Location</h3>
            <form onSubmit={handleSubmitLoc(handleAddLocation)} className="space-y-3" noValidate>
              <FormField label="Rack / Bin Name" error={locErrors.name?.message} required>
                <ValidatedInput
                  type="text"
                  placeholder="e.g. Rack D - Bin 04"
                  hasError={!!locErrors.name}
                  {...registerLoc('name')}
                />
              </FormField>
              <FormField label="Zone (Optional)" error={locErrors.zone?.message}>
                <ValidatedInput
                  type="text"
                  placeholder="e.g. Zone D"
                  hasError={!!locErrors.zone}
                  {...registerLoc('zone')}
                />
              </FormField>
              <FormField label="Description" error={locErrors.description?.message}>
                <ValidatedTextarea
                  rows={2}
                  placeholder="Notes..."
                  hasError={!!locErrors.description}
                  {...registerLoc('description')}
                />
              </FormField>
              <button
                type="submit"
                disabled={isLocSubmitting}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLocSubmitting && <ButtonSpinner />}
                <span>Create Location</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-2 enterprise-card overflow-hidden">
            <table className="min-w-full divide-y divide-[#E6E3DE]">
              <thead>
                <tr>
                  <th className="th-enterprise">Location Name</th>
                  <th className="th-enterprise">Zone</th>
                  <th className="th-enterprise">Description</th>
                  {isAdmin && <th className="th-enterprise text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
                {loading ? (
                  <TableSkeleton rows={4} cols={isAdmin ? 4 : 3} />
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 4 : 3} className="py-8 text-center text-xs text-[#716B64]">
                      No storage locations added yet
                    </td>
                  </tr>
                ) : (
                  locations.map((l) => (
                    <tr key={l._id} className="tr-enterprise">
                      <td className="td-enterprise font-semibold text-[#171717]">{l.name}</td>
                      <td className="td-enterprise text-[#6B6863] text-xs">{l.zone || '-'}</td>
                      <td className="td-enterprise text-[#6B6863] text-xs">{l.description || '-'}</td>
                      {isAdmin && (
                        <td className="td-enterprise text-right">
                          <button
                            onClick={() => handleDeleteLocation(l)}
                            title="Delete Location"
                            className="btn-ghost p-1 text-[#A69B8D] hover:text-[#C2413A]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDeleteTarget}
        title={`Delete ${deleteTarget?.type ? deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1) : ''}`}
        description={`Are you sure you want to delete ${deleteTarget?.type} '${deleteTarget?.name}'? Components referencing this may be affected.`}
        confirmText={`Delete ${deleteTarget?.type ? deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1) : ''}`}
        isLoading={deleteLoading}
        variant="danger"
      />
    </div>
  );
};
