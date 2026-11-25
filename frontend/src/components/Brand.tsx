import { Send } from 'lucide-react';

export function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="grid size-10 place-items-center rounded-[13px] bg-indigo-600 text-white shadow-sm shadow-indigo-300">
        <Send aria-hidden="true" size={19} strokeWidth={2.3} />
      </span>
      <span className="text-lg font-extrabold tracking-[-0.045em] text-slate-900">ReachInbox<span className="text-indigo-600">.</span></span>
    </div>
  );
}
