import React, { useRef } from 'react';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  panelId?: string;
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  panelId,
}: TabsProps<T>): React.ReactElement {
  const buttons = useRef(new Map<T, HTMLButtonElement>());

  return (
    <div className={`border-b border-slate-200 ${className}`}>
      <div className="-mb-px flex gap-4 sm:gap-6" role="tablist" aria-label="Email categories">
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={panelId ? `${panelId}-${tab.id}` : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId}
              tabIndex={isActive ? 0 : -1}
              ref={(element) => {
                if (element) buttons.current.set(tab.id, element);
                else buttons.current.delete(tab.id);
              }}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => {
                const positions: Record<string, number> = {
                  ArrowLeft: (index - 1 + tabs.length) % tabs.length,
                  ArrowRight: (index + 1) % tabs.length,
                  Home: 0,
                  End: tabs.length - 1,
                };
                const next = tabs[positions[event.key]];
                if (!next) return;
                event.preventDefault();
                onChange(next.id);
                buttons.current.get(next.id)?.focus();
              }}
              className={`group inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-0.5 py-4 text-sm font-medium transition-colors sm:gap-2 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.icon && (
                <span
                  className={`transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
                    isActive
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
