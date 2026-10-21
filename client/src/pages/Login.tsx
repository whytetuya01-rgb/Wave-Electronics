import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { toast } from '../utils/toast';
import { loginSchema, LoginFormData } from '../utils/validationSchemas';
import { FormField } from '../components/ui/FormField';
import { ValidatedInput } from '../components/ui/ValidatedInput';
import { ButtonSpinner } from '../components/ui/Loading';
import { Layers, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Factory } from 'lucide-react';

export const Login: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');
    setSubmitting(true);

    try {
      const response = await api.post('/auth/login', {
        email: data.email.trim(),
        password: data.password,
      });

      const { token, user } = response.data;
      login(token, user);
      toast.success(`Welcome back, ${user.name || 'User'}!`);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to sign in. Check credentials.';
      setServerError(msg);
      toast.error(msg);

      if (err.response?.status === 401) {
        setError('password', {
          type: 'server',
          message: 'Invalid email or password',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const setDemoCredentials = (roleEmail: string, rolePass: string) => {
    setValue('email', roleEmail, { shouldValidate: true });
    setValue('password', rolePass, { shouldValidate: true });
    clearErrors();
    setServerError('');
  };

  const isPending = submitting || isSubmitting;

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#A69B8D]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#141414]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex w-13 h-13 rounded-xl bg-[#141414] border border-[#303030] items-center justify-center text-[#A69B8D] shadow-md mb-4 p-3 transition-transform duration-180 hover:scale-105">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] font-semibold text-[#171717] tracking-tight">Wave Electronics</h1>
          <p className="text-sm text-[#6B6863] mt-1 font-normal">Component Stock & Job Management Enterprise SaaS</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6E3DE] rounded-2xl shadow-sm p-8 transition-shadow duration-180 hover:shadow-card">
          {serverError && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/30 text-[#C2413A] text-xs font-medium animate-in fade-in duration-180"
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              label="Email Address"
              required
              error={errors.email?.message}
              id="email"
            >
              <ValidatedInput
                id="email"
                type="email"
                placeholder="name@wave.com"
                autoComplete="email"
                leftIcon={<Mail className="w-4 h-4 text-[#6B6863]" />}
                hasError={Boolean(errors.email)}
                {...register('email')}
              />
            </FormField>

            <FormField
              label="Password"
              required
              error={errors.password?.message}
              id="password"
            >
              <ValidatedInput
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                leftIcon={<Lock className="w-4 h-4 text-[#6B6863]" />}
                hasError={Boolean(errors.password)}
                {...register('password')}
              />
            </FormField>

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary w-full !h-10 py-2.5 text-sm mt-3"
            >
              {isPending && <ButtonSpinner />}
              <span>{isPending ? 'Authenticating...' : 'Sign In to Workspace'}</span>
              {!isPending && (
                <ArrowRight className="w-4 h-4 text-[#A69B8D] transition-transform duration-180 group-hover:translate-x-0.5" />
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-7 pt-6 border-t border-[#E6E3DE]">
            <p className="text-[11px] font-semibold text-[#6B6863] uppercase tracking-wider mb-3 text-center">
              Quick Role Switch (Demo)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('admin@wave.com', 'admin123')}
                className="btn-secondary !h-auto flex-col !p-2.5 text-[11px]"
              >
                <ShieldCheck className="w-4 h-4 mb-1 text-[#807365]" />
                Admin
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('store@wave.com', 'store123')}
                className="btn-secondary !h-auto flex-col !p-2.5 text-[11px]"
              >
                <UserCheck className="w-4 h-4 mb-1 text-[#807365]" />
                Store Keeper
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('prod@wave.com', 'prod123')}
                className="btn-secondary !h-auto flex-col !p-2.5 text-[11px]"
              >
                <Factory className="w-4 h-4 mb-1 text-[#807365]" />
                Production
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
