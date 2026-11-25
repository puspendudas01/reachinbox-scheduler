import { CalendarClock, CircleAlert, CircleCheck, Clock3, Inbox, Plus, SearchX, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DashboardOutlet } from '../components/ProtectedLayout';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Tabs, type TabItem } from '../components/ui/Tabs';
import { ComposeModal } from '../features/compose/ComposeModal';
import { EmailTable } from '../features/emails/EmailTable';
import { useEmails } from '../hooks/useEmails';
import type { EmailStatus } from '../types';
import { debounce } from '../utils';

type DashboardTab = 'scheduled' | 'sent';
const panelId = 'email-list';
const tabs: TabItem<DashboardTab>[] = [
  { id: 'scheduled', label: 'Scheduled Emails', icon: <CalendarClock size={16} /> },
  { id: 'sent', label: 'Sent Emails', icon: <Send size={16} /> },
];
const statuses: EmailStatus[] = ['scheduled', 'sent', 'failed', 'cancelled'];
const dateHeading = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

export function DashboardPage() {
  const { query, setQuery } = useOutletContext<DashboardOutlet>();
  const trimmedQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(trimmedQuery);
  const [status, setStatus] = useState<EmailStatus>();
  const [tab, setTab] = useState<DashboardTab>('scheduled');
  const [composing, setComposing] = useState(false);
  const searching = !!trimmedQuery;
  const settling = searching && trimmedQuery !== debouncedQuery;
  const inbox = useEmails(settling ? '' : trimmedQuery, status);

  useEffect(() => {
    const update = debounce(setDebouncedQuery, 350);
    update(trimmedQuery);
    return update.cancel;
  }, [trimmedQuery]);

  const list = searching ? inbox.search : inbox[tab];
  const loading = settling || list.loading;
  const listError = settling ? undefined : list.error;
  const summary = [
    { name: 'Scheduled', count: inbox.scheduled.emails.length, state: inbox.scheduled, icon: Clock3, colors: 'bg-[#efedff] text-[#6350ea]' },
    { name: 'Sent', count: inbox.sent.emails.filter((email) => email.status === 'sent').length, state: inbox.sent, icon: CircleCheck, colors: 'bg-[#e7f7ef] text-[#19855c]' },
    { name: 'Failed', count: inbox.sent.emails.filter((email) => email.status === 'failed').length, state: inbox.sent, icon: CircleAlert, colors: 'bg-[#fff0f0] text-[#ca4b60]' },
  ];

  function scheduled() {
    setComposing(false);
    setQuery('');
    setTab('scheduled');
    inbox.refresh();
  }

  return (
    <main className="page-width pb-12 pt-6 sm:pt-9">
      <section className="dashboard-hero relative isolate flex flex-wrap items-center justify-between gap-5 overflow-hidden rounded-[22px] px-6 py-7 text-white sm:px-8 sm:py-8">
        <div className="hero-rings" aria-hidden="true" />
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#e4ddff]"><CalendarClock aria-hidden="true" size={16} /> {dateHeading.format(new Date())}</p>
          <h1 className="text-[32px] font-extrabold leading-tight tracking-[-0.055em] sm:text-[40px]">Email dashboard</h1>
        </div>
        <Button className="compose-button min-h-11 px-4.5 font-bold shadow-md" leftIcon={<Plus size={19} />} onClick={() => setComposing(true)}>
          Compose New Email
        </Button>
      </section>

      <section aria-label="Email totals" className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-4">
        {summary.map(({ name, count, state, icon: Icon, colors }) => (
          <div className="flex min-w-0 flex-col gap-2.5 rounded-[16px] border border-[#e8e8f1] bg-white px-3 py-3.5 shadow-[0_2px_8px_#2f2b6005] sm:flex-row sm:items-center sm:gap-4 sm:px-5 sm:py-[18px]" key={name}>
            <span className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-11 ${colors}`} aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>
            <div>
              <p className="text-xs font-semibold text-slate-600 sm:text-sm">{name}</p>
              {state.loading ? (
                <span className="skeleton mt-2 block h-6 w-10" aria-label={`Loading ${name.toLowerCase()} count`} />
              ) : (
                <p className="mt-0.5 text-[24px] leading-tight font-extrabold tracking-[-0.045em] text-slate-900 tabular-nums sm:text-[28px]">{state.error && !state.emails.length ? '—' : count}</p>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-5 overflow-hidden rounded-[18px] border border-[#e8e8f1] bg-white shadow-[0_2px_10px_#2f2b6005]" aria-label={searching ? 'Search results' : 'Emails'}>
        {searching ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-6">
            <h2 className="min-w-0 text-sm font-bold text-slate-900">Results for <span className="break-all text-indigo-700">“{trimmedQuery}”</span></h2>
            <select
              aria-label="Filter search results by status"
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800"
              value={status ?? ''}
              onChange={(event) => setStatus(statuses.find((item) => item === event.target.value))}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => <option value={item} key={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
            </select>
          </div>
        ) : (
          <Tabs tabs={tabs} activeTab={tab} onChange={setTab} panelId={panelId} className="px-4 sm:px-6" />
        )}
        <div id={panelId} role={searching ? undefined : 'tabpanel'} aria-labelledby={searching ? undefined : `${panelId}-${tab}`}>
          {listError && !list.emails.length ? (
            <EmptyState icon={<CircleAlert size={24} />} title="Could not load emails" description={listError} action={<Button variant="outline" onClick={list.refresh}>Try again</Button>} />
          ) : loading || list.emails.length ? (
            <div>
              {listError && <p role="status" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">Refresh failed. Showing the last loaded emails.</p>}
              <EmailTable emails={list.emails} loading={loading} mode={searching ? 'search' : tab} cancelling={inbox.cancelling} onCancel={(id) => void inbox.cancel(id)} />
            </div>
          ) : (
            <EmptyState
              icon={searching ? <SearchX size={25} /> : tab === 'scheduled' ? <Inbox size={25} /> : <Send size={25} />}
              title={searching ? 'No matching emails' : tab === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
              description={searching ? 'Try a different search or status filter.' : tab === 'scheduled' ? 'Choose recipients and a send time to schedule your first email.' : 'Completed deliveries and failures will appear here.'}
              action={searching ? <Button variant="outline" onClick={() => setQuery('')}>Clear search</Button> : tab === 'scheduled' ? <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" leftIcon={<Plus size={16} />} onClick={() => setComposing(true)}>Compose New Email</Button> : undefined}
            />
          )}
        </div>
      </section>
      {composing && <ComposeModal onClose={() => setComposing(false)} onScheduled={scheduled} />}
    </main>
  );
}
