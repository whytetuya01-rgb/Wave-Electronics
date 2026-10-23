import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FolderTree, Ruler, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { TablePagination } from '../components/ui/TablePagination';
import { usePagination } from '../hooks/usePagination';
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

interface Category { _id: string; name: string; description?: string; componentCount: number }
interface Unit { _id: string; name: string; shortCode: string; componentCount: number }
interface StorageLocation { _id: string; name: string; zone?: string; description?: string; componentCount: number }

type MasterType = 'category' | 'unit' | 'location';

// Edit + delete buttons for one row. Delete is admin-only and disabled while
// components still use the record (the server refuses it too).
const RowActions: React.FC<{
  label: string;
  inUse: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ label, inUse, canEdit, canDelete, onEdit, onDelete }) => (
  <div className="flex items-center justify-end gap-1">
    {canEdit && (
      <button onClick={onEdit} title={`Edit ${label}`} aria-label={`Edit ${label}`} className="btn-ghost p-1 text-[#A69B8D] hover:text-[#171717]">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    )}
    {canDelete && (
      <button
        onClick={onDelete}
        disabled={inUse > 0}
        title={inUse > 0 ? `Can't delete: used by ${inUse} component${inUse === 1 ? '' : 's'}` : `Delete ${label}`}
        aria-label={`Delete ${label}`}
        className="btn-ghost p-1 text-[#A69B8D] hover:text-[#C2413A] disabled:opacity-35 disabled:hover:text-[#A69B8D] disabled:cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// Heading of the add/edit form card; shows which record is being edited.
const FormHeading: React.FC<{ noun: string; editingName?: string; onCancel: () => void }> = ({ noun, editingName, onCancel }) => (
  <div className="flex items-start justify-between gap-2 mb-2.5">
    <div>
      <h3 className="text-xs font-bold text-[#171717]">{editingName ? `Edit ${noun}` : `Add ${noun}`}</h3>
      {editingName && <p className="text-[11px] text-[#716B64] mt-0.5 truncate">Editing '{editingName}'</p>}
    </div>
    {editingName && (
      <button type="button" onClick={onCancel} title="Cancel editing" aria-label="Cancel editing" className="btn-ghost p-1 text-[#A69B8D] hover:text-[#171717]">
        <X className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

const InUse: React.FC<{ count: number }> = ({ count }) => (
  <span className={`font-mono text-xs ${count > 0 ? 'text-[#171717] font-semibold' : 'text-[#A69B8D]'}`}>{count}</span>
);

export const Masters: React.FC = () => {
  const { isStoreKeeper, isAdmin } = useAuth();
  // Store keepers and admins add and edit; only admins delete.
  const canManage = isStoreKeeper;
  const [activeTab, setActiveTab] = useState<'categories' | 'units' | 'locations'>('categories');

  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const categoriesPagination = usePagination(categories);
  const unitsPagination = usePagination(units);
  const locationsPagination = usePagination(locations);
  const [loading, setLoading] = useState(true);

  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingLoc, setEditingLoc] = useState<StorageLocation | null>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Category Form
  const {
    register: registerCat,
    handleSubmit: handleSubmitCat,
    reset: resetCat,
    setError: setCatError,
    setFocus: setCatFocus,
    formState: { errors: catErrors, isSubmitting: isCatSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(masterCategorySchema),
    mode: 'onSubmit',
    defaultValues: { name: '', description: '' },
  });

  // Unit Form
  const {
    register: registerUnit,
    handleSubmit: handleSubmitUnit,
    reset: resetUnit,
    setError: setUnitError,
    setFocus: setUnitFocus,
    formState: { errors: unitErrors, isSubmitting: isUnitSubmitting },
  } = useForm<UnitFormData>({
    resolver: zodResolver(masterUnitSchema),
    mode: 'onSubmit',
    defaultValues: { name: '', shortCode: '' },
  });

  // Location Form
  const {
    register: registerLoc,
    handleSubmit: handleSubmitLoc,
    reset: resetLoc,
    setError: setLocError,
    setFocus: setLocFocus,
    formState: { errors: locErrors, isSubmitting: isLocSubmitting },
  } = useForm<LocationFormData>({
    resolver: zodResolver(masterLocationSchema),
    mode: 'onSubmit',
    defaultValues: { name: '', zone: '', description: '' },
  });

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; type: MasterType; name: string } | null>(null);
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

  // Brings the form (above the table on narrow screens) into view and puts
  // the cursor in its first field.
  const focusForm = (focus: () => void) => {
    formCardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    requestAnimationFrame(focus);
  };

  // ----- Categories -----
  const startEditCategory = (cat: Category) => {
    setEditingCat(cat);
    resetCat({ name: cat.name, description: cat.description || '' });
    focusForm(() => setCatFocus('name'));
  };
  const cancelEditCategory = () => {
    setEditingCat(null);
    resetCat({ name: '', description: '' });
  };
  const handleSaveCategory = async (data: CategoryFormData) => {
    const payload = { name: data.name.trim(), description: data.description?.trim() || '' };
    try {
      if (editingCat) {
        await api.put(`/masters/categories/${editingCat._id}`, payload);
        toast.success(`Category '${payload.name}' updated`);
      } else {
        await api.post('/masters/categories', payload);
        toast.success('Category created successfully');
      }
      cancelEditCategory();
      fetchMasters();
    } catch (err: any) {
      if (!applyServerValidationErrors(err, setCatError)) {
        toast.error(getApiErrorMessage(err, editingCat ? 'Failed to update category' : 'Failed to add category'));
      }
    }
  };

  // ----- Units -----
  const startEditUnit = (u: Unit) => {
    setEditingUnit(u);
    resetUnit({ name: u.name, shortCode: u.shortCode });
    focusForm(() => setUnitFocus('name'));
  };
  const cancelEditUnit = () => {
    setEditingUnit(null);
    resetUnit({ name: '', shortCode: '' });
  };
  const handleSaveUnit = async (data: UnitFormData) => {
    const payload = { name: data.name.trim(), shortCode: data.shortCode.trim().toUpperCase() };
    try {
      if (editingUnit) {
        await api.put(`/masters/units/${editingUnit._id}`, payload);
        toast.success(`Unit '${payload.name}' updated`);
      } else {
        await api.post('/masters/units', payload);
        toast.success('Unit created successfully');
      }
      cancelEditUnit();
      fetchMasters();
    } catch (err: any) {
      if (!applyServerValidationErrors(err, setUnitError)) {
        toast.error(getApiErrorMessage(err, editingUnit ? 'Failed to update unit' : 'Failed to add unit'));
      }
    }
  };

  // ----- Storage locations -----
  const startEditLocation = (l: StorageLocation) => {
    setEditingLoc(l);
    resetLoc({ name: l.name, zone: l.zone || '', description: l.description || '' });
    focusForm(() => setLocFocus('name'));
  };
  const cancelEditLocation = () => {
    setEditingLoc(null);
    resetLoc({ name: '', zone: '', description: '' });
  };
  const handleSaveLocation = async (data: LocationFormData) => {
    const payload = { name: data.name.trim(), zone: data.zone?.trim() || '', description: data.description?.trim() || '' };
    try {
      if (editingLoc) {
        await api.put(`/masters/locations/${editingLoc._id}`, payload);
        toast.success(`Location '${payload.name}' updated`);
      } else {
        await api.post('/masters/locations', payload);
        toast.success('Storage location created successfully');
      }
      cancelEditLocation();
      fetchMasters();
    } catch (err: any) {
      if (!applyServerValidationErrors(err, setLocError)) {
        toast.error(getApiErrorMessage(err, editingLoc ? 'Failed to update location' : 'Failed to add location'));
      }
    }
  };

  const executeDeleteTarget = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'category') {
        await api.delete(`/masters/categories/${deleteTarget.id}`);
        if (editingCat?._id === deleteTarget.id) cancelEditCategory();
        toast.success(`Category '${deleteTarget.name}' deleted successfully`);
      } else if (deleteTarget.type === 'unit') {
        await api.delete(`/masters/units/${deleteTarget.id}`);
        if (editingUnit?._id === deleteTarget.id) cancelEditUnit();
        toast.success(`Unit '${deleteTarget.name}' deleted successfully`);
      } else {
        await api.delete(`/masters/locations/${deleteTarget.id}`);
        if (editingLoc?._id === deleteTarget.id) cancelEditLocation();
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

  const tabClass = (tab: typeof activeTab) =>
    `flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
      activeTab === tab ? 'border-[#807365] text-[#171717]' : 'border-transparent text-[#6B6863] hover:text-[#171717]'
    }`;
  const formCardClass = (editing: boolean) =>
    `md:col-span-1 enterprise-card p-4 h-fit scroll-mt-4 ${editing ? 'ring-1 ring-[#807365]/40 bg-[#FAF9F7]' : ''}`;
  const tableSpan = canManage ? 'md:col-span-2' : 'md:col-span-3';
  const rowClass = (editing: boolean) => `tr-enterprise ${editing ? 'bg-[#A69B8D]/10' : ''}`;
  const saveButton = (submitting: boolean, editing: boolean, noun: string) => (
    <div className="flex gap-2">
      {editing && (
        <button type="button" onClick={() => (activeTab === 'categories' ? cancelEditCategory() : activeTab === 'units' ? cancelEditUnit() : cancelEditLocation())} className="btn-secondary flex-1">
          Cancel
        </button>
      )}
      <button type="submit" disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
        {submitting && <ButtonSpinner />}
        <span>{editing ? 'Save Changes' : `Create ${noun}`}</span>
      </button>
    </div>
  );

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        icon={FolderTree}
        title="Master Data"
        description="Component categories, units of measurement, and physical warehouse bin locations."
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E6E3DE]">
        <button onClick={() => setActiveTab('categories')} className={tabClass('categories')}>
          <FolderTree className="w-3.5 h-3.5" />
          Categories ({categories.length})
        </button>
        <button onClick={() => setActiveTab('units')} className={tabClass('units')}>
          <Ruler className="w-3.5 h-3.5" />
          Units ({units.length})
        </button>
        <button onClick={() => setActiveTab('locations')} className={tabClass('locations')}>
          <MapPin className="w-3.5 h-3.5" />
          Storage Locations ({locations.length})
        </button>
      </div>

      {!canManage && <p className="text-xs text-[#716B64]">View only: store keepers and admins can add or change master data.</p>}

      {/* TAB 1: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {canManage && (
            <div ref={formCardRef} className={formCardClass(!!editingCat)}>
              <FormHeading noun="Category" editingName={editingCat?.name} onCancel={cancelEditCategory} />
              <form onSubmit={handleSubmitCat(handleSaveCategory)} className="space-y-3" noValidate>
                <FormField label="Category Name" error={catErrors.name?.message} required>
                  <ValidatedInput type="text" placeholder="e.g. Optocouplers" hasError={!!catErrors.name} {...registerCat('name')} />
                </FormField>
                <FormField label="Description" error={catErrors.description?.message}>
                  <ValidatedTextarea rows={2} placeholder="Description..." hasError={!!catErrors.description} {...registerCat('description')} />
                </FormField>
                {saveButton(isCatSubmitting, !!editingCat, 'Category')}
              </form>
            </div>
          )}

          <div className={`${tableSpan} enterprise-card overflow-hidden`}>
            <table className="min-w-full divide-y divide-[#E6E3DE]">
              <thead>
                <tr>
                  <th className="th-enterprise">Category Name</th>
                  <th className="th-enterprise">Description</th>
                  <th className="th-enterprise text-right">Components</th>
                  {canManage && <th className="th-enterprise text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
                {loading ? (
                  <TableSkeleton rows={4} cols={canManage ? 4 : 3} />
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="py-8 text-center text-xs text-[#716B64]">
                      No categories added yet
                    </td>
                  </tr>
                ) : (
                  categoriesPagination.pageItems.map((cat) => (
                    <tr key={cat._id} className={rowClass(editingCat?._id === cat._id)}>
                      <td className="td-enterprise font-semibold text-[#171717]">{cat.name}</td>
                      <td className="td-enterprise text-[#6B6863] text-xs">{cat.description || '-'}</td>
                      <td className="td-enterprise text-right"><InUse count={cat.componentCount} /></td>
                      {canManage && (
                        <td className="td-enterprise text-right">
                          <RowActions
                            label={`category ${cat.name}`}
                            inUse={cat.componentCount}
                            canEdit={canManage}
                            canDelete={isAdmin}
                            onEdit={() => startEditCategory(cat)}
                            onDelete={() => setDeleteTarget({ id: cat._id, type: 'category', name: cat.name })}
                          />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePagination
              page={categoriesPagination.page}
              pageSize={categoriesPagination.pageSize}
              total={categoriesPagination.total}
              onPageChange={categoriesPagination.setPage}
              onPageSizeChange={categoriesPagination.setPageSize}
              itemLabel="categories"
            />
          </div>
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeTab === 'units' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {canManage && (
            <div ref={formCardRef} className={formCardClass(!!editingUnit)}>
              <FormHeading noun="Unit" editingName={editingUnit ? `${editingUnit.name} (${editingUnit.shortCode})` : undefined} onCancel={cancelEditUnit} />
              <form onSubmit={handleSubmitUnit(handleSaveUnit)} className="space-y-3" noValidate>
                <FormField label="Unit Name" error={unitErrors.name?.message} required>
                  <ValidatedInput type="text" placeholder="e.g. Kilograms" hasError={!!unitErrors.name} {...registerUnit('name')} />
                </FormField>
                <FormField label="Short Code" error={unitErrors.shortCode?.message} required hint="e.g. KG, NOS, MTR">
                  <ValidatedInput type="text" placeholder="e.g. KG" className="uppercase font-mono" hasError={!!unitErrors.shortCode} {...registerUnit('shortCode')} />
                </FormField>
                {editingUnit && editingUnit.componentCount > 0 && (
                  <p className="text-[11px] text-[#716B64]">
                    {editingUnit.componentCount} component{editingUnit.componentCount === 1 ? '' : 's'} will show the new name and code. Documents already issued keep the code they were printed with.
                  </p>
                )}
                {saveButton(isUnitSubmitting, !!editingUnit, 'Unit')}
              </form>
            </div>
          )}

          <div className={`${tableSpan} enterprise-card overflow-hidden`}>
            <table className="min-w-full divide-y divide-[#E6E3DE]">
              <thead>
                <tr>
                  <th className="th-enterprise">Unit Name</th>
                  <th className="th-enterprise">Short Code</th>
                  <th className="th-enterprise text-right">Components</th>
                  {canManage && <th className="th-enterprise text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
                {loading ? (
                  <TableSkeleton rows={4} cols={canManage ? 4 : 3} />
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 4 : 3} className="py-8 text-center text-xs text-[#716B64]">
                      No units added yet
                    </td>
                  </tr>
                ) : (
                  unitsPagination.pageItems.map((u) => (
                    <tr key={u._id} className={rowClass(editingUnit?._id === u._id)}>
                      <td className="td-enterprise font-semibold text-[#171717]">{u.name}</td>
                      <td className="td-enterprise font-mono font-bold text-[#171717]">{u.shortCode}</td>
                      <td className="td-enterprise text-right"><InUse count={u.componentCount} /></td>
                      {canManage && (
                        <td className="td-enterprise text-right">
                          <RowActions
                            label={`unit ${u.name}`}
                            inUse={u.componentCount}
                            canEdit={canManage}
                            canDelete={isAdmin}
                            onEdit={() => startEditUnit(u)}
                            onDelete={() => setDeleteTarget({ id: u._id, type: 'unit', name: `${u.name} (${u.shortCode})` })}
                          />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePagination
              page={unitsPagination.page}
              pageSize={unitsPagination.pageSize}
              total={unitsPagination.total}
              onPageChange={unitsPagination.setPage}
              onPageSizeChange={unitsPagination.setPageSize}
              itemLabel="units"
            />
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE LOCATIONS */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {canManage && (
            <div ref={formCardRef} className={formCardClass(!!editingLoc)}>
              <FormHeading noun="Storage Location" editingName={editingLoc?.name} onCancel={cancelEditLocation} />
              <form onSubmit={handleSubmitLoc(handleSaveLocation)} className="space-y-3" noValidate>
                <FormField label="Rack / Bin Name" error={locErrors.name?.message} required>
                  <ValidatedInput type="text" placeholder="e.g. Rack D - Bin 04" hasError={!!locErrors.name} {...registerLoc('name')} />
                </FormField>
                <FormField label="Zone (Optional)" error={locErrors.zone?.message}>
                  <ValidatedInput type="text" placeholder="e.g. Zone D" hasError={!!locErrors.zone} {...registerLoc('zone')} />
                </FormField>
                <FormField label="Description" error={locErrors.description?.message}>
                  <ValidatedTextarea rows={2} placeholder="Notes..." hasError={!!locErrors.description} {...registerLoc('description')} />
                </FormField>
                {saveButton(isLocSubmitting, !!editingLoc, 'Location')}
              </form>
            </div>
          )}

          <div className={`${tableSpan} enterprise-card overflow-hidden`}>
            <table className="min-w-full divide-y divide-[#E6E3DE]">
              <thead>
                <tr>
                  <th className="th-enterprise">Location Name</th>
                  <th className="th-enterprise">Zone</th>
                  <th className="th-enterprise">Description</th>
                  <th className="th-enterprise text-right">Components</th>
                  {canManage && <th className="th-enterprise text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E4DE]/60 bg-white">
                {loading ? (
                  <TableSkeleton rows={4} cols={canManage ? 5 : 4} />
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="py-8 text-center text-xs text-[#716B64]">
                      No storage locations added yet
                    </td>
                  </tr>
                ) : (
                  locationsPagination.pageItems.map((l) => (
                    <tr key={l._id} className={rowClass(editingLoc?._id === l._id)}>
                      <td className="td-enterprise font-semibold text-[#171717]">{l.name}</td>
                      <td className="td-enterprise text-[#6B6863] text-xs">{l.zone || '-'}</td>
                      <td className="td-enterprise text-[#6B6863] text-xs">{l.description || '-'}</td>
                      <td className="td-enterprise text-right"><InUse count={l.componentCount} /></td>
                      {canManage && (
                        <td className="td-enterprise text-right">
                          <RowActions
                            label={`location ${l.name}`}
                            inUse={l.componentCount}
                            canEdit={canManage}
                            canDelete={isAdmin}
                            onEdit={() => startEditLocation(l)}
                            onDelete={() => setDeleteTarget({ id: l._id, type: 'location', name: l.name })}
                          />
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <TablePagination
              page={locationsPagination.page}
              pageSize={locationsPagination.pageSize}
              total={locationsPagination.total}
              onPageChange={locationsPagination.setPage}
              onPageSizeChange={locationsPagination.setPageSize}
              itemLabel="locations"
            />
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={executeDeleteTarget}
        title={`Delete ${deleteTarget?.type ? deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1) : ''}`}
        description={`Permanently delete ${deleteTarget?.type} '${deleteTarget?.name}'? This can't be undone. It's only allowed while no component uses it.`}
        confirmText={`Delete ${deleteTarget?.type ? deleteTarget.type.charAt(0).toUpperCase() + deleteTarget.type.slice(1) : ''}`}
        isLoading={deleteLoading}
        variant="danger"
      />
    </div>
  );
};
