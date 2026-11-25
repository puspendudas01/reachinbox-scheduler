import { Mail, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/Table';
import type { Email } from '../../types';
import { formatDateTime } from '../../utils';

interface EmailTableProps {
  emails: Email[];
  loading: boolean;
  mode: 'scheduled' | 'sent' | 'search';
  cancelling: ReadonlySet<string>;
  onCancel: (id: string) => void;
}

export function EmailTable({ emails, loading, mode, cancelling, onCancel }: EmailTableProps) {
  const showActions = mode === 'scheduled' || (mode === 'search' && emails.some((email) => email.status === 'scheduled'));
  const dateLabel = mode === 'scheduled' ? 'Scheduled time' : mode === 'sent' ? 'Sent time' : 'Scheduled / sent time';

  return (
    <div aria-busy={loading}>
      {loading && <span role="status" className="sr-only">Loading emails</span>}
      <Table flush aria-label={mode === 'search' ? 'Email search results' : `${mode} emails`} className="email-table min-w-[650px]">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Email</TableHead>
            <TableHead scope="col">Subject</TableHead>
            <TableHead scope="col">{dateLabel}</TableHead>
            <TableHead scope="col">Status</TableHead>
            {showActions && <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? Array.from({ length: 4 }, (_, index) => (
            <TableRow key={index} aria-hidden="true">
              {Array.from({ length: showActions ? 5 : 4 }, (_, column) => (
                <TableCell key={column}><span className={`skeleton block h-4 ${column < 2 ? 'w-32' : 'w-20'}`} /></TableCell>
              ))}
            </TableRow>
          )) : emails.map((email) => {
            const date = mode === 'sent' ? email.sentAt : mode === 'scheduled' ? email.scheduledAt : email.sentAt ?? email.scheduledAt;
            return (
              <TableRow key={email.id}>
                <TableCell className="font-semibold text-slate-800">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f0efff] text-indigo-600"><Mail size={15} /></span>
                    <span className="max-w-60 truncate" title={email.toEmail}>{email.toEmail}</span>
                  </div>
                </TableCell>
                <TableCell><span className="block max-w-64 truncate" title={email.subject}>{email.subject}</span></TableCell>
                <TableCell>{date ? <time dateTime={date}>{formatDateTime(date)}</time> : '—'}</TableCell>
                <TableCell>
                  <Badge status={email.status} />
                  {email.error && email.status === 'failed' && <span className="mt-1 block max-w-36 truncate text-xs text-rose-700" title={email.error}>{email.error}</span>}
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    {email.status === 'scheduled' && (
                      <Button variant="ghost" size="sm" className="text-rose-700 hover:bg-rose-50" leftIcon={<X size={14} />} isLoading={cancelling.has(email.id)} aria-label={`Cancel email to ${email.toEmail}`} onClick={() => onCancel(email.id)}>
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
