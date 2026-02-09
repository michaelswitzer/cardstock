import type { ExportJob } from '@cardmaker/shared';

interface ExportProgressProps {
  job: ExportJob | null;
}

export default function ExportProgress({ job }: ExportProgressProps) {
  if (!job) return null;

  return (
    <div
      style={{
        padding: 16,
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>
          {job.status === 'queued' && 'Queued...'}
          {job.status === 'processing' && `Rendering card ${job.completed} of ${job.total}...`}
          {job.status === 'complete' && 'Export complete!'}
          {job.status === 'error' && `Error: ${job.error}`}
        </span>
        <span>{job.progress}%</span>
      </div>
      <div
        style={{
          height: 8,
          background: 'var(--surface-light)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${job.progress}%`,
            background:
              job.status === 'error' ? 'var(--primary)' : 'var(--success)',
            transition: 'width 0.3s',
            borderRadius: 4,
          }}
        />
      </div>
      {job.status === 'complete' && job.outputPath && (
        job.outputPath.startsWith('/output') ? (
          <a
            href={job.outputPath}
            download
            style={{
              display: 'inline-block',
              marginTop: 12,
              color: 'var(--primary)',
              textDecoration: 'underline',
            }}
          >
            Download
          </a>
        ) : (
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            Saved to: <code style={{ color: 'var(--text)' }}>{job.outputPath}</code>
          </div>
        )
      )}
    </div>
  );
}
