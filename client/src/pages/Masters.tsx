import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FolderTree, Ruler, MapPin, Plus, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';

export const Masters: React.FC = () => {
  const { isStoreKeeper, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'categories' | 'units' | 'locations'>('categories');

  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  const [unitName, setUnitName] = useState('');
  const [unitShortCode, setUnitShortCode] = useState('');

  const [locName, setLocName] = useState('');
  const [locZone, setLocZone] = useState('');
  const [locDesc, setLocDesc] = useState('');

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
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.post('/masters/categories', { name: categoryName, description: categoryDesc });
      setCategoryName('');
      setCategoryDesc('');
      setSuccessMsg('Category created successfully');
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add category');
    }
  };

  const handleDeleteCategory = (cat: any) => {
    setDeleteTarget({ id: cat._id, type: 'category', name: cat.name });
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.post('/masters/units', { name: unitName, shortCode: unitShortCode });
      setUnitName('');
      setUnitShortCode('');
      setSuccessMsg('Unit created successfully');
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add unit');
    }
  };

  const handleDeleteUnit = (u: any) => {
    setDeleteTarget({ id: u._id, type: 'unit', name: `${u.name} (${u.shortCode})` });
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await api.post('/masters/locations', { name: locName, zone: locZone, description: locDesc });
      setLocName('');
      setLocZone('');
      setLocDesc('');
      setSuccessMsg('Storage location created successfully');
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add location');
    }
  };

  const handleDeleteLocation = (l: any) => {
    setDeleteTarget({ id: l._id, type: 'location', name: l.name });
  };

  const executeDeleteTarget = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setErrorMsg('');
    try {
      if (deleteTarget.type === 'category') {
        await api.delete(`/masters/categories/${deleteTarget.id}`);
        setSuccessMsg(`Category '${deleteTarget.name}' deleted successfully`);
      } else if (deleteTarget.type === 'unit') {
        await api.delete(`/masters/units/${deleteTarget.id}`);
        setSuccessMsg(`Unit '${deleteTarget.name}' deleted successfully`);
      } else if (deleteTarget.type === 'location') {
        await api.delete(`/masters/locations/${deleteTarget.id}`);
        setSuccessMsg(`Location '${deleteTarget.name}' deleted successfully`);
      }
      setDeleteTarget(null);
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || `Failed to delete ${deleteTarget.type}`);
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

      {errorMsg && (
        <div className="p-3 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/25 text-[#C2413A] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#C2413A]" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-[#C2413A]/60 hover:text-[#C2413A]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-[10px] bg-[#168060]/10 border border-[#168060]/25 text-[#168060] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#168060]" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#168060]/60 hover:text-[#168060]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#E6E3DE]">
        <button
          onClick={() => {
            setActiveTab('categories');
            setErrorMsg('');
          }}
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
          onClick={() => {
            setActiveTab('units');
            setErrorMsg('');
          }}
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
          onClick={() => {
            setActiveTab('locations');
            setErrorMsg('');
          }}
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
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="label-text block mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optocouplers"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="input-enterprise !h-9 text-xs"
                />
              </div>
              <div>
                <label className="label-text block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Description..."
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  className="textarea-enterprise !p-2.5 text-xs"
                ></textarea>
              </div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Create Category
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
            <form onSubmit={handleAddUnit} className="space-y-3">
              <div>
                <label className="label-text block mb-1">Unit Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kilograms"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="input-enterprise !h-9 text-xs"
                />
              </div>
              <div>
                <label className="label-text block mb-1">Short Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KG"
                  value={unitShortCode}
                  onChange={(e) => setUnitShortCode(e.target.value.toUpperCase())}
                  className="input-enterprise !h-9 text-xs uppercase font-mono"
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Create Unit
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
            <form onSubmit={handleAddLocation} className="space-y-3">
              <div>
                <label className="label-text block mb-1">Rack / Bin Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack D - Bin 04"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="input-enterprise !h-9 text-xs"
                />
              </div>
              <div>
                <label className="label-text block mb-1">Zone (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Zone D"
                  value={locZone}
                  onChange={(e) => setLocZone(e.target.value)}
                  className="input-enterprise !h-9 text-xs"
                />
              </div>
              <div>
                <label className="label-text block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Notes..."
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  className="textarea-enterprise !p-2.5 text-xs"
                ></textarea>
              </div>
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Create Location
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
