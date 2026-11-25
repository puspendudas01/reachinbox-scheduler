import { LogOut, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types';
import { Brand } from './Brand';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Spinner } from './ui/Spinner';
import { SlackControl } from '../features/slack/SlackControl';

export interface DashboardOutlet {
  query: string;
  setQuery: (query: string) => void;
}

function Avatar({ user }: { user: User }) {
  const [failedUrl, setFailedUrl] = useState('');
  const initials = (user.name.trim() || user.email).split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  return user.avatar && user.avatar !== failedUrl ? (
    <img src={user.avatar} alt="" className="size-9 shrink-0 rounded-full border border-indigo-100 object-cover" onError={() => setFailedUrl(user.avatar ?? '')} />
  ) : (
    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-800">{initials}</span>
  );
}

export function ProtectedLayout() {
  const { state, logout, loggingOut } = useAuth();
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && search.current && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        search.current.focus();
      }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  if (state.status === 'loading') {
    return <main className="grid min-h-dvh place-items-center text-indigo-600"><Spinner size="lg" label="Checking your session" /></main>;
  }
  if (state.status !== 'authenticated') return <Navigate to="/login" replace />;

  const { user } = state;
  const outlet: DashboardOutlet = { query, setQuery };
  return (
    <>
      <header className="border-b border-[#e9eaf1] bg-white">
        <div className="page-width grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-3 py-3.5 lg:grid-cols-[auto_minmax(170px,400px)_minmax(0,1fr)_auto] lg:gap-x-6 lg:py-[17px]">
          <Brand />
          <div className="col-span-3 row-start-2 lg:col-span-1 lg:row-start-auto">
            <Input
              ref={search}
              type="search"
              aria-label="Search emails"
              placeholder="Search emails…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape') setQuery(''); }}
              leftIcon={<Search size={17} />}
              rightIcon={query ? (
                <button type="button" className="grid size-6 cursor-pointer place-items-center rounded text-slate-500 hover:bg-slate-100" aria-label="Clear search" onClick={() => { setQuery(''); search.current?.focus(); }}><X size={15} /></button>
              ) : (
                <kbd className="hidden whitespace-nowrap rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] text-slate-500 sm:block">{/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K'}</kbd>
              )}
              className="search-field"
            />
          </div>
          <div className="col-span-2 col-start-2 row-start-3 justify-self-end sm:col-span-1 sm:row-start-1 lg:col-start-3">
            <SlackControl />
          </div>
          <div className="col-start-3 row-start-1 flex items-center justify-end gap-2 lg:col-start-4 xl:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-3 xl:pl-4">
              <Avatar user={user} />
              <div className="hidden min-w-0 text-left md:block">
                <p className="max-w-32 truncate text-xs font-bold text-slate-900 xl:max-w-48" title={user.name}>{user.name}</p>
                <p className="max-w-32 truncate text-[11px] text-slate-500 xl:max-w-48" title={user.email}>{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" aria-label="Logout" title="Logout" isLoading={loggingOut} onClick={() => void logout()} leftIcon={<LogOut size={16} />} className="shrink-0 p-2">
              <span className="hidden xl:inline">Logout</span>
            </Button>
          </div>
          <div className="col-start-1 row-start-3 min-w-0 sm:col-span-3 md:hidden">
            <p className="truncate text-xs font-bold text-slate-900">{user.name}</p>
            <p className="truncate text-[11px] text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>
      <Outlet context={outlet} />
    </>
  );
}
