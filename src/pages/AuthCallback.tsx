import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const finalizeAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        let hasSession = false;

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
          hasSession = Boolean(data.session);
        } else {
          const { data } = await supabase.auth.getSession();
          hasSession = Boolean(data.session);
        }

        if (isMounted) {
          navigate(hasSession ? '/' : '/login', { replace: true });
        }
      } catch (error) {
        console.warn('Failed to complete auth callback', error);
        if (isMounted) {
          navigate('/login', { replace: true });
        }
      }
    };

    void finalizeAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
