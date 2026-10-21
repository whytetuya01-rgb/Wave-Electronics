import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../api/client';
import { FormField } from '../components/ui/FormField';
import { ValidatedInput } from '../components/ui/ValidatedInput';
import { ButtonSpinner } from '../components/ui/Loading';
import { toast } from '../utils/toast';
import { handleApiError } from '../utils/apiErrors';
import { Settings as SettingsIcon, Building2, MapPin, Phone, Mail, FileText, Image, Save } from 'lucide-react';

interface SettingsFormData {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  logoPath: string;
}

export const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const form = useForm<SettingsFormData>({
    defaultValues: { companyName: '', address: '', phone: '', email: '', gstin: '', logoPath: '' },
  });

  useEffect(() => {
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      const s = res.data.data;
      form.reset({
        companyName: s.companyName || '',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        gstin: s.gstin || '',
        logoPath: s.logoPath || '',
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    setFormError('');
    setIsSaving(true);
    try {
      await api.put('/settings', data);
      toast.success('Company settings updated successfully.');
    } catch (err: any) {
      const msg = handleApiError(err, form.setError, 'Failed to update settings');
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-[#6B6863]">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="body-text text-[#6B6863] mt-1">
          Company identity used on generated PDFs (delivery challans and job receipts).
        </p>
      </div>

      {formError && (
        <div className="p-3 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/30 text-[#C2413A] text-xs font-medium">
          {formError}
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="enterprise-card p-6 space-y-4">
        <FormField label="Company Name" required error={form.formState.errors.companyName?.message} id="s-name">
          <ValidatedInput
            id="s-name"
            leftIcon={<Building2 />}
            placeholder="Wave Electronics"
            {...form.register('companyName', { required: 'Company name is required' })}
          />
        </FormField>

        <FormField label="Address" optional error={form.formState.errors.address?.message} id="s-address">
          <ValidatedInput id="s-address" leftIcon={<MapPin />} placeholder="Factory / registered address" {...form.register('address')} />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone" optional error={form.formState.errors.phone?.message} id="s-phone">
            <ValidatedInput id="s-phone" leftIcon={<Phone />} placeholder="+91 XXXXXXXXXX" {...form.register('phone')} />
          </FormField>
          <FormField label="Email" optional error={form.formState.errors.email?.message} id="s-email">
            <ValidatedInput id="s-email" type="email" leftIcon={<Mail />} placeholder="ops@wave.com" {...form.register('email')} />
          </FormField>
        </div>

        <FormField label="GSTIN" optional error={form.formState.errors.gstin?.message} id="s-gstin" helperText="Printed on challans and receipts.">
          <ValidatedInput id="s-gstin" leftIcon={<FileText />} placeholder="27AAAAA0000A1Z5" {...form.register('gstin')} />
        </FormField>

        <FormField
          label="Logo File Path"
          optional
          error={form.formState.errors.logoPath?.message}
          id="s-logo"
          helperText="Absolute path on the server to a logo image file; left blank shows text-only header."
        >
          <ValidatedInput id="s-logo" leftIcon={<Image />} placeholder="/srv/wave/assets/logo.png" {...form.register('logoPath')} />
        </FormField>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={isSaving} className="btn-primary">
            {isSaving ? <ButtonSpinner /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
