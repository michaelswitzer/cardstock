import type { CardData } from '@cardmaker/shared';

interface DataTableProps {
  headers: string[];
  rows: CardData[];
  maxRows?: number;
}

export default function DataTable({ headers, rows, maxRows = 50 }: DataTableProps) {
  const displayRows = rows.slice(0, maxRows);

  return (
    <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i}>
              <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
              {headers.map((h) => (
                <td key={h}>{row[h] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>
          Showing {maxRows} of {rows.length} rows
        </p>
      )}
    </div>
  );
}
