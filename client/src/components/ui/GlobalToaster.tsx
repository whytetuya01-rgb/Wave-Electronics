import React from 'react';
import { Toaster as SonnerToaster } from 'sonner';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

export const GlobalToaster: React.FC = () => {
  return (
    <SonnerToaster
      position="top-right"
      expand={true}
      richColors={false}
      closeButton={true}
      toastOptions={{
        className: 'wave-toast-item',
        style: {
          background: '#FFFFFF',
          border: '1px solid #E7E4DE',
          color: '#171717',
          borderRadius: '12px',
          boxShadow: '0 12px 30px -4px rgba(23, 23, 23, 0.12), 0 4px 6px -2px rgba(23, 23, 23, 0.04)',
          fontSize: '13px',
          padding: '12px 14px',
          fontFamily: 'var(--font-sans)',
        },
      }}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-[#168060] shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-[#C2413A] shrink-0" />,
        warning: <AlertTriangle className="w-4 h-4 text-[#B7791F] shrink-0" />,
        info: <Info className="w-4 h-4 text-[#807365] shrink-0" />,
        loading: <Loader2 className="w-4 h-4 text-[#807365] animate-spin shrink-0" />,
      }}
    />
  );
};

export default GlobalToaster;
