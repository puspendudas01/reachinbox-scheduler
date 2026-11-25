import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { apiClient, apiErrorMessage, authApi, isUnauthorized } from '../api';
import type { User } from '../types';

type AuthState =
  | { status: 'loading' | 'anonymous' }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; user: User };

const AuthContext = createContext<{
  state: AuthState;
  retry: () => void;
  logout: () => Promise<void>;
  loggingOut: boolean;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const interceptor = apiClient.interceptors.response.use(undefined, (error: unknown) => {
      if (isUnauthorized(error)) setState({ status: 'anonymous' });
      return Promise.reject(error);
    });
    void authApi.getMe(controller.signal)
      .then((user) => {
        if (!controller.signal.aborted) setState({ status: 'authenticated', user });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isUnauthorized(error)) return;
        setState({
          status: 'error',
          message: apiErrorMessage(error, 'Could not check your session. Try again in a moment.'),
        });
      });
    return () => {
      controller.abort();
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [attempt]);

  function retry() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await authApi.logout();
      setState({ status: 'anonymous' });
    } catch (error) {
      if (!isUnauthorized(error)) toast.error(apiErrorMessage(error, 'Could not log out.'));
    } finally {
      setLoggingOut(false);
    }
  }

  return <AuthContext.Provider value={{ state, retry, logout, loggingOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth requires AuthProvider');
  return context;
}
