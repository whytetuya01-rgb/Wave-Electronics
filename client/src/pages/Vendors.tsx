import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { TableSkeleton, ButtonSpinner } from '../components/ui/Loading';
import {
  Truck,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  X,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Package,
  Layers,
} from 'lucide-react';

interface VendorItem {
  _id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  address?: string;
  city: string;
  state?: string;
  circuitsCanAssemble?: string[];
  defaultJobWorkRate: number;
  remarks?: string;
  isActive: boolean;
  openJobsCount: number;
  pendingFinishedQty: number;
  materialBalance: number;
  transactionCount: number;
  createdAt: string;
}

export const Vendors: React.FC = () => {
  const { isProduction, isAdmin } = useAuth();
  const canEdit = isAdmin || isProduction;

  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorItem | null>(null);
  const [detailedVendorData, setDetailedVendorData] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<VendorItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstNumber: '',
    address: '',
    city: '',
    state: 'Maharashtra',
    defaultJobWorkRate: 0,
    circuitsCanAssemble: '',
    remarks: '',
  });

  useEffect(() => {
    fetchVendors();
  }, [statusFilter]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const res = await api.get('/vendors', { params });
      setVendors(res.data.data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || 'Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      gstNumber: '',
      address: '',
      city: '',
      state: 'Maharashtra',
      defaultJobWorkRate: 0,
      circuitsCanAssemble: '',
      remarks: '',
    });
  };

  const handleOpenAdd = () => {
    resetForm();
    setErrorMsg('');
    setSuccessMsg('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (v: VendorItem) => {
    setSelectedVendor(v);
    setFormData({
      name: v.name,
      contactPerson: v.contactPerson,
      phone: v.phone,
      email: v.email || '',
      gstNumber: v.gstNumber || '',
      address: v.address || '',
      city: v.city,
      state: v.state || 'Maharashtra',
      defaultJobWorkRate: v.defaultJobWorkRate || 0,
      circuitsCanAssemble: (v.circuitsCanAssemble || []).join(', '),
      remarks: v.remarks || '',
    });
    setErrorMsg('');
    setSuccessMsg('');
    setShowEditModal(true);
  };

  const handleOpenDetails = async (v: VendorItem) => {
    setSelectedVendor(v);
    setShowDetailsModal(true);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/vendors/${v._id}`);
      setDetailedVendorData(res.data.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSaving(true);
    try {
      const circuitsArray = formData.circuitsCanAssemble
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.post('/vendors', {
        ...formData,
        circuitsCanAssemble: circuitsArray,
      });

      setSuccessMsg(`Vendor '${formData.name}' created successfully`);
      setShowAddModal(false);
      resetForm();
      fetchVendors();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor) return;
    setErrorMsg('');
    setIsSaving(true);
    try {
      const circuitsArray = formData.circuitsCanAssemble
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await api.put(`/vendors/${selectedVendor._id}`, {
        ...formData,
        circuitsCanAssemble: circuitsArray,
      });

      setSuccessMsg(`Vendor '${formData.name}' updated successfully`);
      setShowEditModal(false);
      fetchVendors();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to update vendor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (v: VendorItem) => {
    try {
      await api.patch(`/vendors/${v._id}/toggle-status`);
      setSuccessMsg(`Vendor '${v.name}' ${v.isActive ? 'deactivated' : 'activated'}`);
      fetchVendors();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to change vendor status');
    }
  };

  const handleDeleteVendor = (v: VendorItem) => {
    setVendorToDelete(v);
    setErrorMsg('');
  };

  const executeDeleteVendor = async () => {
    if (!vendorToDelete) return;
    setDeleteLoading(true);
    setErrorMsg('');
    try {
      await api.delete(`/vendors/${vendorToDelete._id}`);
      setSuccessMsg(`Vendor '${vendorToDelete.name}' deleted successfully`);
      setVendorToDelete(null);
      fetchVendors();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete vendor');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Contact Person', 'Phone', 'Email', 'City', 'GSTIN', 'Default Rate (INR)', 'Status'];
    const rows = filteredVendors.map((v) => [
      `"${v.name}"`,
      `"${v.contactPerson}"`,
      `"${v.phone}"`,
      `"${v.email || ''}"`,
      `"${v.city}"`,
      `"${v.gstNumber || ''}"`,
      v.defaultJobWorkRate,
      v.isActive ? 'Active' : 'Inactive',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `wave_vendors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredVendors = vendors.filter((v) => {
    const q = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.contactPerson.toLowerCase().includes(q) ||
      v.phone.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      (v.gstNumber && v.gstNumber.toLowerCase().includes(q))
    );
  });

  const totalVendors = vendors.length;
  const activeVendors = vendors.filter((v) => v.isActive).length;
  const totalMaterialLying = vendors.reduce((sum, v) => sum + (v.materialBalance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header (Minimalist Enterprise) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Vendors (Job Work Assemblers)</h1>
          <p className="body-text text-[#6B6863] mt-1 max-w-2xl">
            Assembly partners who assemble circuits from components we supply. Goods are provided for job-work; nothing is sold to vendors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            title="Export CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#807365]" />
            <span>Export</span>
          </button>
          {canEdit && (
            <button
              onClick={handleOpenAdd}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Assembler</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid (Black, White & Golden Grey) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Vendors"
          value={totalVendors}
          icon={Building2}
          subtitle="Registered assembly partners"
          loading={loading}
        />
        <StatCard
          title="Active Assemblers"
          value={activeVendors}
          icon={CheckCircle2}
          subtitle="Eligible for job issue"
          iconBgClass="bg-[#168060]/10"
          iconColorClass="text-[#168060]"
          badge={{ label: `${activeVendors} Active`, variant: 'success' }}
          loading={loading}
        />
        <StatCard
          title="Material With Vendors"
          value={`${totalMaterialLying.toLocaleString()} pcs`}
          icon={Package}
          subtitle="Components in assembly"
          iconBgClass="bg-[#A69B8D]/15"
          iconColorClass="text-[#807365]"
          loading={loading}
        />
        <StatCard
          title="Open Jobs Pipeline"
          value="0"
          icon={Layers}
          subtitle="Active job challans"
          iconBgClass="bg-[#F7F6F3]"
          iconColorClass="text-[#303030]"
          loading={loading}
        />
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-[#C2413A]/10 border border-[#C2413A]/25 rounded-[10px] text-sm text-[#C2413A] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C2413A] shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-[#C2413A]/70 hover:text-[#C2413A] p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-[#168060]/10 border border-[#168060]/25 rounded-[10px] text-sm text-[#168060] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#168060] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-[#168060]/70 hover:text-[#168060] p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table Toolbar: Search & Segmented Filter Control */}
      <div className="enterprise-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#807365] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search vendor, contact, city, GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-enterprise !pl-9"
          />
        </div>

        {/* Minimalist Segmented Status Toggle */}
        <div className="inline-flex rounded-[9px] border border-[#E6E3DE] p-1 bg-[#F7F6F3] text-xs w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-white text-[#171717] shadow-xs border border-[#E6E3DE]'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            All ({vendors.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all ${
              statusFilter === 'active'
                ? 'bg-white text-[#168060] shadow-xs border border-[#E6E3DE] font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            Active ({vendors.filter((v) => v.isActive).length})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`flex-1 sm:flex-none px-3 py-1 rounded-[7px] text-[13px] font-medium transition-all ${
              statusFilter === 'inactive'
                ? 'bg-white text-[#171717] shadow-xs border border-[#E6E3DE] font-semibold'
                : 'text-[#6B6863] hover:text-[#171717]'
            }`}
          >
            Inactive ({vendors.filter((v) => !v.isActive).length})
          </button>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="th-enterprise">Assembler Company</th>
                <th className="th-enterprise">Contact Info</th>
                <th className="th-enterprise">Location</th>
                <th className="th-enterprise">GSTIN</th>
                <th className="th-enterprise text-right">Job-Work Rate</th>
                <th className="th-enterprise">Circuits / Capabilities</th>
                <th className="th-enterprise text-center">Status</th>
                <th className="th-enterprise text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E3DE]/60">
              {loading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState
                      icon={Truck}
                      title={search ? 'No matching vendors found' : 'No assembler vendors onboarded'}
                      description={
                        search
                          ? 'Try adjusting your search criteria or resetting filters.'
                          : 'Get started by registering your first PCB assembly or job-work partner.'
                      }
                      action={
                        canEdit && !search
                          ? {
                              label: 'Add Assembler Vendor',
                              onClick: handleOpenAdd,
                              icon: Plus,
                            }
                          : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor) => (
                  <tr key={vendor._id} className="tr-enterprise group">
                    <td className="td-enterprise">
                      <div className="font-semibold text-[#171717] group-hover:text-[#807365] transition-colors">
                        {vendor.name}
                      </div>
                      {vendor.remarks && (
                        <p className="text-[12px] text-[#6B6863] truncate max-w-xs mt-0.5">{vendor.remarks}</p>
                      )}
                    </td>

                    <td className="td-enterprise">
                      <div className="font-medium text-[#171717]">{vendor.contactPerson}</div>
                      <div className="flex items-center gap-2.5 text-[12px] text-[#6B6863] mt-0.5">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-[#A69B8D]" />
                          {vendor.phone}
                        </span>
                        {vendor.email && (
                          <span className="flex items-center gap-1 text-[#6B6863] truncate max-w-[140px]" title={vendor.email}>
                            <Mail className="w-3 h-3 text-[#A69B8D]" />
                            {vendor.email}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="td-enterprise">
                      <div className="flex items-center gap-1 text-[#171717]">
                        <MapPin className="w-3.5 h-3.5 text-[#A69B8D]" />
                        <span>{vendor.city}</span>
                      </div>
                      {vendor.state && <div className="text-[12px] text-[#6B6863] mt-0.5">{vendor.state}</div>}
                    </td>

                    <td className="td-enterprise font-mono text-[12px] text-[#303030]">
                      {vendor.gstNumber ? (
                        <span className="tracking-wide">{vendor.gstNumber}</span>
                      ) : (
                        <span className="text-[#A69B8D] italic">Unregistered</span>
                      )}
                    </td>

                    <td className="td-enterprise text-right font-mono">
                      {vendor.defaultJobWorkRate > 0 ? (
                        <div>
                          <span className="font-semibold text-[#171717]">
                            ₹{vendor.defaultJobWorkRate.toFixed(2)}
                          </span>
                          <span className="text-[11px] text-[#6B6863] block">/ unit</span>
                        </div>
                      ) : (
                        <span className="text-[#A69B8D]">—</span>
                      )}
                    </td>

                    <td className="td-enterprise">
                      {vendor.circuitsCanAssemble && vendor.circuitsCanAssemble.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {vendor.circuitsCanAssemble.slice(0, 2).map((c, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F7F6F3] text-[#383531] border border-[#E6E3DE]"
                            >
                              {c}
                            </span>
                          ))}
                          {vendor.circuitsCanAssemble.length > 2 && (
                            <span className="text-[11px] text-[#6B6863] self-center">
                              +{vendor.circuitsCanAssemble.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#A69B8D] text-[12px]">All circuits</span>
                      )}
                    </td>

                    <td className="td-enterprise text-center">
                      <Badge variant={vendor.isActive ? 'success' : 'neutral'} dot>
                        {vendor.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    <td className="td-enterprise text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDetails(vendor)}
                          title="View Details & Ledger"
                          className="btn-ghost p-1.5 rounded-[8px]"
                        >
                          <Eye className="w-4 h-4 text-[#6B6863] hover:text-[#171717]" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(vendor)}
                              title="Edit Vendor"
                              className="btn-ghost p-1.5 rounded-[8px]"
                            >
                              <Edit2 className="w-4 h-4 text-[#6B6863] hover:text-[#171717]" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(vendor)}
                              title={vendor.isActive ? 'Deactivate' : 'Activate'}
                              className="btn-ghost p-1.5 rounded-[8px]"
                            >
                              {vendor.isActive ? (
                                <XCircle className="w-4 h-4 text-[#A69B8D] hover:text-[#B7791F]" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-[#A69B8D] hover:text-[#168060]" />
                              )}
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteVendor(vendor)}
                                title="Delete"
                                className="btn-ghost p-1.5 rounded-[8px]"
                              >
                                <Trash2 className="w-4 h-4 text-[#A69B8D] hover:text-[#C2413A]" />
                              </button>
                            )}
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

      {/* ADD / EDIT VENDOR DIALOG */}
      <Modal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
        }}
        size="lg"
        icon={<Truck className="w-5 h-5 text-[#807365]" />}
        title={showAddModal ? 'Add Assembler Vendor' : `Edit Assembler: ${selectedVendor?.name}`}
        subtitle="Configure company profile, contact details, tax ID, and standard job-work assembly rate."
        onSubmit={showAddModal ? handleCreateVendor : handleUpdateVendor}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving && <ButtonSpinner />}
              <span>{isSaving ? 'Saving...' : (showAddModal ? 'Save Assembler' : 'Save Changes')}</span>
            </button>
          </>
        }
      >
        <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label-text block mb-1.5">
                    Company / Vendor Name <span className="text-[#C2413A]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex EMS Solutions Pvt Ltd"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">
                    Contact Person <span className="text-[#C2413A]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunil Sharma"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">
                    Phone Number <span className="text-[#C2413A]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 98220 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="input-enterprise font-mono"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. contact@apexems.in"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AABCA1234F1Z5"
                    value={formData.gstNumber}
                    onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value.toUpperCase() })}
                    className="input-enterprise font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">
                    City <span className="text-[#C2413A]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label-text block mb-1.5">Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Plot 42, Bhosari MIDC Industrial Area"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div>
                  <label className="label-text block mb-1.5">
                    Default Job-Work Rate (₹ per unit)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-[#807365] font-bold">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.defaultJobWorkRate}
                      onChange={(e) =>
                        setFormData({ ...formData, defaultJobWorkRate: parseFloat(e.target.value) || 0 })
                      }
                      className="input-enterprise !pl-7 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="label-text block mb-1.5">
                    Circuits Handled (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PWM Motor Controller, LED Driver"
                    value={formData.circuitsCanAssemble}
                    onChange={(e) => setFormData({ ...formData, circuitsCanAssemble: e.target.value })}
                    className="input-enterprise"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label-text block mb-1.5">Remarks & Tooling Capabilities</label>
                  <textarea
                    rows={2}
                    placeholder="Specialized capabilities, machine tooling, lead times..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-[9px] border border-[#E6E3DE] text-sm focus:outline-none focus:ring-2 focus:ring-[#807365]/20 focus:border-[#807365] transition-all"
                  />
                </div>
              </div>
        </div>
      </Modal>

      {/* VENDOR DETAILS & MATERIAL LEDGER MODAL */}
      {selectedVendor && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          size="2xl"
          icon={<Truck className="w-5 h-5 text-[#807365]" />}
          title={
            <div className="flex items-center gap-2">
              <span>{selectedVendor.name}</span>
              <Badge variant={selectedVendor.isActive ? 'success' : 'neutral'} dot>
                {selectedVendor.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          }
          subtitle={`${selectedVendor.contactPerson} • ${selectedVendor.city}, ${selectedVendor.state || 'Maharashtra'}`}
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
            {/* Profile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-xl border border-[#E6E3DE]">
                <span className="helper-text font-medium block text-[#6B6863]">Contact Details</span>
                <div className="mt-1.5 text-sm font-semibold text-[#171717] flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-[#807365]" />
                  {selectedVendor.phone}
                </div>
                {selectedVendor.email && (
                  <div className="mt-1 text-xs text-[#6B6863] flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-[#807365] shrink-0" />
                    <span className="truncate">{selectedVendor.email}</span>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#E6E3DE]">
                <span className="helper-text font-medium block text-[#6B6863]">GSTIN Identification</span>
                <div className="mt-1.5 text-sm font-mono font-semibold text-[#171717]">
                  {selectedVendor.gstNumber || 'Not Registered'}
                </div>
                <span className="text-[11px] text-[#A69B8D] mt-0.5 block">Job-work challan tax profile</span>
              </div>

              <div className="p-4 bg-white rounded-xl border border-[#E6E3DE]">
                <span className="helper-text font-medium block text-[#6B6863]">Assembly Labor Rate</span>
                <div className="mt-1.5 text-sm font-semibold text-[#171717] font-mono">
                  {selectedVendor.defaultJobWorkRate > 0
                    ? `₹${selectedVendor.defaultJobWorkRate.toFixed(2)} / unit`
                    : 'Not fixed'}
                </div>
                <span className="text-[11px] text-[#807365] mt-0.5 block">Standard cost tracking</span>
              </div>
            </div>

            {/* Material Balance Held by Vendor */}
            <div className="border border-[#E6E3DE] bg-white rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#807365]" />
                  <h4 className="text-sm font-semibold text-[#171717]">Material Balance Held By Vendor</h4>
                </div>
                <span className="text-xs font-semibold text-[#807365] font-mono">
                  Total: {selectedVendor.materialBalance || 0} units
                </span>
              </div>
              <p className="helper-text text-[#6B6863] mb-3">
                Components issued from store for job-work that have not yet been returned as finished circuits or returned unused parts.
              </p>

              {detailsLoading ? (
                <div className="py-4 text-center text-xs text-[#6B6863]">Loading holding balance...</div>
              ) : detailedVendorData?.materialHoldings?.length > 0 ? (
                <div className="bg-[#F7F6F3]/50 rounded-lg border border-[#E6E3DE] overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#E8E6E2]/50 text-[#6B6863] font-medium text-xs uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Part Code</th>
                        <th className="py-2.5 px-3">Component Description</th>
                        <th className="py-2.5 px-3 text-right">Qty Lying With Vendor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E3DE]">
                      {detailedVendorData.materialHoldings.map((m: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-3 font-mono font-semibold text-[#171717]">{m.partCode}</td>
                          <td className="py-2.5 px-3 text-[#383531]">{m.name}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-[#807365]">{m.netBalance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-3 text-center text-xs text-[#6B6863] bg-[#F7F6F3] rounded-lg border border-dashed border-[#E6E3DE]">
                  No components currently lying with this vendor.
                </div>
              )}
            </div>

            {/* Remarks */}
            {selectedVendor.remarks && (
              <div className="p-4 bg-white rounded-xl border border-[#E6E3DE] text-sm">
                <span className="font-medium text-[#171717] block mb-0.5">Remarks / Capabilities:</span>
                <p className="text-[#6B6863] leading-relaxed text-xs">{selectedVendor.remarks}</p>
              </div>
            )}

            {/* Recent Movement History */}
            <div>
              <h4 className="text-sm font-semibold text-[#171717] mb-2.5">Recent Material Movements & Challans</h4>
              {detailsLoading ? (
                <div className="text-center py-4 text-xs text-[#6B6863]">Loading ledger movements...</div>
              ) : detailedVendorData?.recentTransactions?.length > 0 ? (
                <div className="enterprise-card overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="th-enterprise">Date</th>
                        <th className="th-enterprise">Type</th>
                        <th className="th-enterprise">Component</th>
                        <th className="th-enterprise text-right">Qty</th>
                        <th className="th-enterprise">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E3DE]/60">
                      {detailedVendorData.recentTransactions.map((tx: any) => (
                        <tr key={tx._id} className="tr-enterprise">
                          <td className="td-enterprise text-[#6B6863] font-mono text-xs">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </td>
                          <td className="td-enterprise">
                            <Badge
                              variant={tx.type === 'ISSUE_TO_VENDOR' ? 'gold' : 'success'}
                            >
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="td-enterprise font-mono font-medium text-[#171717]">{tx.componentId?.partCode || '—'}</td>
                          <td className="td-enterprise text-right font-mono font-semibold text-[#171717]">{tx.qtyChange}</td>
                          <td className="td-enterprise text-[#6B6863] text-xs font-mono">{tx.referenceNo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[#A69B8D] italic">No job-work challans or material movements recorded yet.</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={!!vendorToDelete}
        onClose={() => setVendorToDelete(null)}
        onConfirm={executeDeleteVendor}
        title="Delete Vendor"
        description={`Are you sure you want to delete assembler '${vendorToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Assembler"
        isLoading={deleteLoading}
        variant="danger"
      />
    </div>
  );
};
