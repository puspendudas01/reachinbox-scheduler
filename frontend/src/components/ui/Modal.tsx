import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeDisabled?: boolean;
}

export function Modal({ isOpen, onClose, title, description, icon, children, footer, closeDisabled }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!isOpen || !element) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[600px] overflow-hidden rounded-2xl border border-[#e9e9f3] bg-white p-0 text-slate-900 shadow-[0_24px_100px_#15163540] backdrop:bg-[#17152c]/55"
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
    >
      {isOpen && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">{icon}</span>}
            <div className="min-w-0 flex-1 self-center">
              <h2 id={titleId} className="text-xl font-extrabold tracking-tight">{title}</h2>
              {description && <p id={descriptionId} className="mt-1 text-sm text-slate-500">{description}</p>}
            </div>
            <button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Close dialog" className="grid size-8 cursor-pointer place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
              <X size={19} />
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer && <footer className="flex shrink-0 justify-end gap-2.5 border-t border-slate-100 bg-[#fafafe] px-5 py-4 sm:px-6">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
