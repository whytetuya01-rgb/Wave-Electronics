import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { Layers, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, Factory } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.token, response.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sign in. Check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const setDemoCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#A69B8D]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#141414]/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex w-13 h-13 rounded-xl bg-[#141414] border border-[#303030] items-center justify-center text-[#A69B8D] shadow-md mb-4 p-3 transition-transform duration-180 hover:scale-105">
            <Layers className="w-7 h-7" />
          </div>
          <h1 className="text-[26px] font-semibold text-[#171717] tracking-tight">Wave Electronics</h1>
          <p className="text-sm text-[#6B6863] mt-1 font-normal">Component Stock & Job Management Enterprise SaaS</p>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E6E3DE] rounded-2xl shadow-sm p-8 transition-shadow duration-180 hover:shadow-card">
          {error && (
            <div className="mb-6 p-3.5 rounded-[10px] bg-[#C2413A]/10 border border-[#C2413A]/30 text-[#C2413A] text-xs font-medium animate-in fade-in duration-180">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[#171717] mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#6B6863] absolute left-3.5 top-3 transition-colors duration-180" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@wave.com"
                  className="input-enterprise !h-10 !pl-10 !pr-3.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#171717] mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#6B6863] absolute left-3.5 top-3 transition-colors duration-180" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="input-enterprise !h-10 !pl-10 !pr-3.5 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full !h-10 py-2.5 text-sm mt-2"
            >
              {submitting ? 'Authenticating...' : 'Sign In to Workspace'}
              <ArrowRight className="w-4 h-4 text-[#A69B8D] transition-transform duration-180 group-hover:translate-x-0.5" />
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
