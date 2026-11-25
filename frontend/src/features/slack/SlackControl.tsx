import { Check, Hash, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { apiErrorMessage, isUnauthorized, slackApi } from '../../api';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import type { SlackStatus } from '../../types';

export function SlackControl() {
  const [status, setStatus] = useState<SlackStatus | 'error'>();
  const [attempt, setAttempt] = useState(0);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void slackApi.getStatus(controller.signal)
      .then((connection) => {
        if (!controller.signal.aborted) setStatus(connection);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isUnauthorized(error)) return;
        setStatus('error');
        toast.error(apiErrorMessage(error, 'Could not check your Slack connection.'), { id: 'slack-status' });
      });
    return () => controller.abort();
  }, [attempt]);

  async function disconnect() {
    setDisconnecting(true);
    try {
      await slackApi.disconnect();
      setStatus({ connected: false });
      toast.success('Slack disconnected.');
    } catch (error) {
      if (!isUnauthorized(error)) toast.error(apiErrorMessage(error, 'Could not disconnect Slack.'));
    } finally {
      setDisconnecting(false);
    }
  }

  if (!status) {
    return <span className="flex items-center gap-2 text-xs text-slate-500"><Spinner size="sm" label="Checking Slack connection" /> Slack</span>;
  }
  if (status === 'error') {
    return (
      <Button variant="outline" size="sm" onClick={() => { setStatus(undefined); setAttempt((value) => value + 1); }}>
        Retry Slack
      </Button>
    );
  }
  if (!status.connected) {
    return (
      <Button variant="outline" className="whitespace-nowrap border-slate-200 bg-white" leftIcon={<Hash size={16} className="text-[#611f69]" />} onClick={() => window.location.assign(slackApi.getConnectUrl())}>
        Connect Slack
      </Button>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-[10px] border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-800">
      <span className="flex items-center gap-1.5 whitespace-nowrap px-0.5 text-xs font-semibold" title={status.teamName}>
        <Check size={15} aria-hidden="true" /> Slack connected
      </span>
      <Button variant="ghost" size="sm" aria-label="Disconnect Slack" title="Disconnect Slack" className="min-h-7 p-1 text-emerald-800 hover:bg-emerald-100" isLoading={disconnecting} onClick={() => void disconnect()}>
        <span className="hidden xl:inline">{disconnecting ? 'Disconnecting…' : 'Disconnect'}</span>
        {!disconnecting && <X size={15} aria-hidden="true" className="xl:hidden" />}
      </Button>
    </div>
  );
}
