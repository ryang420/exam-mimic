import { useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthContext } from '@/contexts/authContext';

type Theme = 'light' | 'dark';

export function useTheme() {
  const { currentUser } = useContext(AuthContext);
  const [theme, setTheme] = useState<Theme>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    let isMounted = true;

    const loadTheme = async () => {
      const userId = currentUser?.id;
      if (!userId) {
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', userId)
        .maybeSingle();

      if (!isMounted) return;
      if (!error && data?.theme) {
        setTheme(data.theme as Theme);
      }
    };

    loadTheme();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => {
      const nextTheme = prevTheme === 'light' ? 'dark' : 'light';

      if (currentUser?.id) {
        supabase
          .from('profiles')
          .update({ theme: nextTheme })
          .eq('id', currentUser.id)
          .throwOnError()
          .catch((error) => {
            console.warn('Failed to persist theme', error);
          });
      }

      return nextTheme;
    });
  };

  return {
    theme,
    toggleTheme,
    isDark: theme === 'dark'
  };
} 