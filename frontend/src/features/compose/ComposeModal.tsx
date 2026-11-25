import { CalendarClock, FileText, MailPlus, Upload, X } from 'lucide-react';
import { useId, useRef, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { apiErrorMessage, campaignsApi, isUnauthorized } from '../../api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { Textarea } from '../../components/ui/Textarea';
import type { ParseEmailsResult } from '../../types';
import { getDefaultScheduleTime, getMinDateTimeLocal, parseEmailList } from '../../utils';

interface ComposeModalProps {
  onClose: () => void;
  onScheduled: () => void;
}

type FormErrors = Partial<Record<'subject' | 'body' | 'emails' | 'startTime' | 'delay' | 'limit', string>>;

export function ComposeModal({ onClose, onScheduled }: ComposeModalProps) {
  const formId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const fileRead = useRef(0);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState(() => getDefaultScheduleTime());
  const [delay, setDelay] = useState('1');
  const [limit, setLimit] = useState('60');
  const [file, setFile] = useState<{ name: string; result: ParseEmailsResult }>();
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  async function readFile(next: File) {
    const sequence = ++fileRead.current;
    setFile(undefined);
    setFileError('');
    setErrors((previous) => ({ ...previous, emails: undefined }));
    if (!/\.(csv|txt)$/i.test(next.name)) {
      setReading(false);
      setFileError('Choose a CSV or TXT file.');
      return;
    }

    setReading(true);
    try {
      const result = parseEmailList(await next.text());
      if (sequence !== fileRead.current) return;
      setFile({ name: next.name, result });
      if (!result.validEmails.length) setFileError('This file contains no valid email addresses.');
    } catch {
      if (sequence === fileRead.current) setFileError('Could not read this file. Try another CSV or TXT file.');
    } finally {
      if (sequence === fileRead.current) setReading(false);
    }
  }

  function removeFile() {
    fileRead.current += 1;
    setFile(undefined);
    setFileError('');
    setReading(false);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || reading) return;
    const nextErrors: FormErrors = {};
    const emails = file?.result.validEmails ?? [];
    const date = new Date(startTime);
    const delayMs = Math.round(Number(delay) * 1_000);
    const hourlyLimit = Number(limit);

    if (!subject.trim()) nextErrors.subject = 'Enter a subject.';
    if (!body.trim()) nextErrors.body = 'Enter a message.';
    if (!emails.length) nextErrors.emails = 'Upload a list with at least one valid email.';
    if (!startTime || !Number.isFinite(date.getTime()) || date.getTime() < Date.now()) nextErrors.startTime = 'Choose a future start time.';
    if (!/^\d+(?:\.\d{1,3})?$/.test(delay) || !Number.isSafeInteger(delayMs)) nextErrors.delay = 'Enter zero or more seconds, with up to three decimal places.';
    if (!limit.trim() || !Number.isSafeInteger(hourlyLimit) || hourlyLimit < 1) nextErrors.limit = 'Enter a whole number of at least 1.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const result = await campaignsApi.schedule({ subject: subject.trim(), body, emails, startTime: date.toISOString(), delayMs, hourlyLimit });
      const count = result?.scheduledCount ?? emails.length;
      toast.success(`${count} ${count === 1 ? 'email' : 'emails'} scheduled.`);
      onScheduled();
    } catch (error) {
      if (!isUnauthorized(error)) toast.error(apiErrorMessage(error, 'Could not schedule emails. Try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const result = file?.result;
  const recipientError = fileError || errors.emails;

  return (
    <Modal
      isOpen
      title="Compose New Email"
      icon={<MailPlus size={20} />}
      onClose={onClose}
      closeDisabled={submitting}
      footer={(
        <>
          <Button variant="outline" className="border-slate-200 bg-white" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button type="submit" form={formId} leftIcon={<CalendarClock size={16} />} isLoading={submitting} disabled={reading}>
            {submitting ? 'Scheduling…' : 'Schedule'}
          </Button>
        </>
      )}
    >
      <form id={formId} noValidate onSubmit={(event) => void submit(event)} className="space-y-4.5">
        <Input label="Email subject" placeholder="Enter a subject" value={subject} onChange={(event) => setSubject(event.target.value)} error={errors.subject} required disabled={submitting} />
        <Textarea label="Message" placeholder="Write your email…" rows={4} value={body} onChange={(event) => setBody(event.target.value)} error={errors.body} required disabled={submitting} />
        <div>
          <label htmlFor={`${formId}-file`} className="mb-1.5 block text-sm font-semibold text-slate-800">Recipients <span className="text-rose-500">*</span></label>
          <input
            ref={fileInput}
            id={`${formId}-file`}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            tabIndex={-1}
            disabled={submitting}
            onChange={(event) => {
              const next = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (next) void readFile(next);
            }}
          />
          <div
            className={`flex min-w-0 items-center gap-3 rounded-xl border border-dashed p-3 ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-200 bg-[#f9f8ff]'}`}
            onDragOver={(event) => { event.preventDefault(); if (!submitting) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const next = event.dataTransfer.files[0];
              if (next && !submitting) void readFile(next);
            }}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-indigo-600 ring-1 ring-indigo-100">
              {reading ? <Spinner size="sm" label="Reading recipients" /> : file ? <FileText size={17} /> : <Upload size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{reading ? 'Reading recipient list…' : (file?.name ?? 'Upload a recipient list')}</p>
              <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
                {result ? `${result.validEmails.length} emails detected` : 'CSV or TXT'}
              </p>
            </div>
            {file ? (
              <Button variant="ghost" size="sm" aria-label="Remove recipient list" className="shrink-0 p-1.5" onClick={removeFile} disabled={submitting}><X size={16} /></Button>
            ) : (
              <Button variant="outline" size="sm" className="shrink-0 bg-white" onClick={() => fileInput.current?.click()} disabled={submitting}>Browse</Button>
            )}
          </div>
          {recipientError && <p className="mt-1.5 text-xs font-medium text-rose-700" role="alert">{recipientError}</p>}
          {result && (result.duplicateCount > 0 || result.invalidCount > 0) && (
            <p className="mt-1.5 text-xs text-slate-600">
              {[result.duplicateCount > 0 ? `${result.duplicateCount} duplicate${result.duplicateCount === 1 ? '' : 's'}` : null, result.invalidCount > 0 ? `${result.invalidCount} invalid` : null].filter(Boolean).join(' and ')} skipped.
            </p>
          )}
        </div>
        <Input label="Start time" type="datetime-local" min={getMinDateTimeLocal()} value={startTime} onChange={(event) => setStartTime(event.target.value)} error={errors.startTime} required disabled={submitting} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Delay between emails" type="number" min={0} step={0.001} value={delay} onChange={(event) => setDelay(event.target.value)} error={errors.delay} rightIcon={<span className="pointer-events-none text-xs">sec</span>} required disabled={submitting} />
          <Input label="Hourly limit" type="number" min={1} step={1} value={limit} onChange={(event) => setLimit(event.target.value)} error={errors.limit} required disabled={submitting} />
        </div>
      </form>
    </Modal>
  );
}
