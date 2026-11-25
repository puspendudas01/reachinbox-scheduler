import { ArrowRight, CalendarClock, Mail, Send } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { authApi } from '../api';
import { Brand } from '../components/Brand';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

function GoogleMark() {
  return <span aria-hidden="true" className="google-mark">G</span>;
}

export function LoginPage() {
  const { state, retry } = useAuth();
  if (state.status === 'authenticated') return <Navigate to="/dashboard" replace />;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8 sm:p-8">
      <div className="grid w-full max-w-[960px] overflow-hidden rounded-[26px] border border-[#e8e9f2] bg-white shadow-[0_20px_70px_#22326913] md:grid-cols-[1fr_0.96fr]">
        <section className="flex min-h-[455px] flex-col p-8 sm:p-12">
          <Brand />
          <div className="my-auto py-12">
            <h1 className="text-4xl font-extrabold leading-tight tracking-[-0.055em] text-slate-900 sm:text-[44px]">Sign in to ReachInbox</h1>
            <p className="mt-3 max-w-xs text-[15px] leading-6 text-slate-600">Use your Google account to schedule emails and see their delivery status.</p>
            <Button
              variant="outline"
              size="lg"
              className="mt-7 w-full justify-start gap-3 border-slate-200 bg-white text-sm sm:max-w-[310px]"
              leftIcon={<GoogleMark />}
              rightIcon={<ArrowRight size={16} className="ml-2 text-slate-400" />}
              isLoading={state.status === 'loading'}
              onClick={() => window.location.assign(authApi.getGoogleLoginUrl())}
            >
              Continue with Google
            </Button>
            {state.status === 'error' && (
              <div className="mt-4 text-sm text-slate-600">
                <p role="alert">{state.message}</p>
                <Button variant="ghost" size="sm" className="mt-1 -ml-2.5 text-indigo-700" onClick={retry}>Try again</Button>
              </div>
            )}
          </div>
        </section>
        <div className="login-art relative hidden items-center justify-center overflow-hidden md:flex" aria-hidden="true">
          <div className="login-orbit login-orbit-outer" />
          <div className="login-orbit login-orbit-inner" />
          <div className="relative grid size-40 -rotate-12 place-items-center rounded-[38px] border border-white/45 bg-white/93 text-indigo-600 shadow-[0_24px_48px_#241b8166]">
            <Mail size={74} strokeWidth={1.25} />
          </div>
          <div className="absolute top-[27%] right-[16%] grid size-14 rotate-12 place-items-center rounded-2xl border border-white/20 bg-[#8e80ff] text-white shadow-xl"><Send size={26} /></div>
          <div className="absolute bottom-[24%] left-[17%] grid size-14 -rotate-6 place-items-center rounded-2xl border border-white/20 bg-[#b8adff] text-[#3b30a9] shadow-lg"><CalendarClock size={25} /></div>
        </div>
      </div>
    </main>
  );
}
