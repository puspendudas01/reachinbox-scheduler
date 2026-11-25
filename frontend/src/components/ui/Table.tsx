import React from 'react';

interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  flush?: boolean;
}

export const Table: React.FC<TableProps> = ({
  className = '',
  flush,
  children,
  ...props
}) => (
  <div className={`w-full overflow-x-auto bg-white ${flush ? '' : 'rounded-xl border border-slate-200 shadow-xs'}`}>
    <table className={`w-full text-left text-sm text-slate-600 ${className}`} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <thead className={`bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider ${className}`} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <tbody className={`divide-y divide-slate-100 bg-white ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <tr className={`transition-colors hover:bg-slate-50/60 ${className}`} {...props}>
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <th className={`px-5 py-3.5 whitespace-nowrap ${className}`} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <td className={`px-5 py-4 whitespace-nowrap align-middle ${className}`} {...props}>
    {children}
  </td>
);
