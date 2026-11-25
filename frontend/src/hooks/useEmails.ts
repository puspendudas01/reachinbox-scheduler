import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiErrorMessage, emailsApi, isUnauthorized } from '../api';
import type { Email, EmailStatus } from '../types';

type LoadEmails = (signal: AbortSignal) => Promise<Email[]>;
const refreshInterval = 10_000;
const emptyEmails: Email[] = [];

function useEmailList(load: LoadEmails | null, source: string) {
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    load: LoadEmails;
    emails?: Email[];
    error?: string;
  }>();
  const lastError = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!load) return;
    let request: AbortController | undefined;

    async function fetchList() {
      if (request || !load) return;
      const controller = new AbortController();
      request = controller;
      try {
        const emails = await load(controller.signal);
        if (controller.signal.aborted) return;
        lastError.current = undefined;
        toast.dismiss(source);
        setSnapshot({ load, emails });
      } catch (error) {
        if (controller.signal.aborted || isUnauthorized(error)) return;
        const message = apiErrorMessage(error, `Could not load ${source}.`);
        if (lastError.current !== message) toast.error(message, { id: source });
        lastError.current = message;
        setSnapshot((current) => ({ load, emails: current?.load === load ? current.emails : undefined, error: message }));
      } finally {
        request = undefined;
      }
    }

    void fetchList();
    const timer = window.setInterval(() => void fetchList(), refreshInterval);
    return () => {
      clearInterval(timer);
      request?.abort();
    };
  }, [load, source, version]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const current = snapshot?.load === load ? snapshot : undefined;
  return {
    emails: current?.emails ?? emptyEmails,
    loading: !!load && !current,
    error: current?.error,
    refresh,
  };
}

export function useEmails(query: string, status?: EmailStatus) {
  const scheduled = useEmailList(emailsApi.getScheduled, 'scheduled emails');
  const sent = useEmailList(emailsApi.getSent, 'sent emails');
  const searchRequest = useCallback(
    (signal: AbortSignal) => emailsApi.search({ q: query, status }, signal),
    [query, status],
  );
  const search = useEmailList(query ? searchRequest : null, 'search results');
  const [cancelled, setCancelled] = useState<ReadonlySet<string>>(() => new Set());
  const [cancelling, setCancelling] = useState<ReadonlySet<string>>(() => new Set());
  const activeCancellations = useRef(new Set<string>());

  function refresh() {
    scheduled.refresh();
    sent.refresh();
    search.refresh();
  }

  async function cancel(id: string) {
    if (activeCancellations.current.has(id)) return;
    activeCancellations.current.add(id);
    setCancelling(new Set(activeCancellations.current));
    try {
      await emailsApi.cancel(id);
      setCancelled((previous) => new Set(previous).add(id));
      toast.success('Email cancelled.');
      refresh();
    } catch (error) {
      if (!isUnauthorized(error)) toast.error(apiErrorMessage(error, 'Could not cancel this email.'));
      refresh();
    } finally {
      activeCancellations.current.delete(id);
      setCancelling(new Set(activeCancellations.current));
    }
  }

  return {
    scheduled: { ...scheduled, emails: scheduled.emails.filter((email) => !cancelled.has(email.id)) },
    sent,
    search: {
      ...search,
      emails: search.emails
        .map((email): Email => cancelled.has(email.id) ? { ...email, status: 'cancelled' } : email)
        .filter((email) => !status || email.status === status),
    },
    cancelling,
    cancel,
    refresh,
  };
}
