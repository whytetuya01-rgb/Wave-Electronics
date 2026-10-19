import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { FolderTree, Ruler, MapPin, Plus, Trash2, X, AlertCircle, CheckCircle2 } from 'lucide-react';

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

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Delete this category?')) return;
    setErrorMsg('');
    try {
      await api.delete(`/masters/categories/${id}`);
      setSuccessMsg('Category deleted successfully');
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete category');
    }
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

  const handleDeleteUnit = async (id: string) => {
    if (!window.confirm('Delete this unit?')) return;
    setErrorMsg('');
    try {
      await api.delete(`/masters/units/${id}`);
      setSuccessMsg('Unit deleted successfully');
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete unit');
    }
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

  const handleDeleteLocation = async (id: string) => {
    if (!window.confirm('Delete this location?')) return;
    setErrorMsg('');
    try {
      await api.delete(`/masters/locations/${id}`);
      setSuccessMsg('Location deleted successfully');
      fetchMasters();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete location');
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Master Data Management</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Component categories, units of measurement, and physical warehouse bin locations.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('categories');
            setErrorMsg('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'categories'
              ? 'border-[#4F46E5] text-[#4F46E5]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
              ? 'border-[#4F46E5] text-[#4F46E5]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
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
              ? 'border-[#4F46E5] text-[#4F46E5]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Storage Locations ({locations.length})
        </button>
      </div>

      {/* TAB 1: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 shadcn-card p-4 h-fit">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Add Category</h3>
            <form onSubmit={handleAddCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Optocouplers"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Description..."
                  value={categoryDesc}
                  onChange={(e) => setCategoryDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                ></textarea>
              </div>
              <button
                type="submit"
                className="btn-linear-primary w-full"
              >
                Create Category
              </button>
            </form>
          </div>

          <div className="md:col-span-2 shadcn-card overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="table-compact-th">Category Name</th>
                  <th className="table-compact-th">Description</th>
                  {isAdmin && <th className="table-compact-th text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {categories.map((cat) => (
                  <tr key={cat._id} className="table-row-interactive">
                    <td className="table-compact-td font-semibold text-slate-900">{cat.name}</td>
                    <td className="table-compact-td text-slate-500 text-xs">{cat.description || '-'}</td>
                    {isAdmin && (
                      <td className="table-compact-td text-right">
                        <button
                          onClick={() => handleDeleteCategory(cat._id)}
                          title="Delete Category"
                          className="btn-linear-ghost p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: UNITS */}
      {activeTab === 'units' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 shadcn-card p-4 h-fit">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Add Unit</h3>
            <form onSubmit={handleAddUnit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Unit Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kilograms"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Short Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KG"
                  value={unitShortCode}
                  onChange={(e) => setUnitShortCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-xs uppercase font-mono bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>
              <button
                type="submit"
                className="btn-linear-primary w-full"
              >
                Create Unit
              </button>
            </form>
          </div>

          <div className="md:col-span-2 shadcn-card overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="table-compact-th">Unit Name</th>
                  <th className="table-compact-th">Short Code</th>
                  {isAdmin && <th className="table-compact-th text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {units.map((u) => (
                  <tr key={u._id} className="table-row-interactive">
                    <td className="table-compact-td font-semibold text-slate-900">{u.name}</td>
                    <td className="table-compact-td font-mono font-bold text-[#4F46E5]">{u.shortCode}</td>
                    {isAdmin && (
                      <td className="table-compact-td text-right">
                        <button
                          onClick={() => handleDeleteUnit(u._id)}
                          title="Delete Unit"
                          className="btn-linear-ghost p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STORAGE LOCATIONS */}
      {activeTab === 'locations' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 shadcn-card p-4 h-fit">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">Add Storage Location</h3>
            <form onSubmit={handleAddLocation} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Rack / Bin Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rack D - Bin 04"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Zone (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Zone D"
                  value={locZone}
                  onChange={(e) => setLocZone(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Notes..."
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#4F46E5]"
                ></textarea>
              </div>
              <button
                type="submit"
                className="btn-linear-primary w-full"
              >
                Create Location
              </button>
            </form>
          </div>

          <div className="md:col-span-2 shadcn-card overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr>
                  <th className="table-compact-th">Location Name</th>
                  <th className="table-compact-th">Zone</th>
                  <th className="table-compact-th">Description</th>
                  {isAdmin && <th className="table-compact-th text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {locations.map((l) => (
                  <tr key={l._id} className="table-row-interactive">
                    <td className="table-compact-td font-semibold text-slate-900">{l.name}</td>
                    <td className="table-compact-td text-slate-500 text-xs">{l.zone || '-'}</td>
                    <td className="table-compact-td text-slate-500 text-xs">{l.description || '-'}</td>
                    {isAdmin && (
                      <td className="table-compact-td text-right">
                        <button
                          onClick={() => handleDeleteLocation(l._id)}
                          title="Delete Location"
                          className="btn-linear-ghost p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
