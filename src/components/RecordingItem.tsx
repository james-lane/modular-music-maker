import { Download, Headphones, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Recording } from '../audio/recordings';
import type { RecordingExportFormat } from '../audio/recording-encoder';

export function RecordingItem({
  recording,
  onDelete,
  onDownload,
  exportActive,
  exportError,
  progress,
}: {
  recording: Recording;
  onDelete: () => void;
  onDownload: (format: RecordingExportFormat) => void;
  exportActive: boolean;
  exportError: string | null;
  // undefined: another/no export; null: decoding this take; number: encoding.
  progress: number | null | undefined;
}) {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<RecordingExportFormat>('wav');
  useEffect(() => {
    const next = URL.createObjectURL(recording.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [recording.blob]);
  const formatName = format === 'original' ? 'original' : format.toUpperCase();
  return (
    <div className="recording-item">
      <div className="recording-title">
        <Headphones size={19} />
        <div>
          <strong>{recording.name}</strong>
          <small>
            {Math.floor(recording.duration / 60)}:
            {String(Math.floor(recording.duration % 60)).padStart(2, '0')} ·{' '}
            {new Date(recording.createdAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </small>
        </div>
        <button
          className="icon-button"
          title="Delete recording"
          aria-label={`Delete ${recording.name} recording`}
          disabled={progress !== undefined}
          onClick={onDelete}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <audio src={url || undefined} controls preload="metadata" />
      <div className="recording-download">
        <label>
          Save as
          <select
            aria-label={`Download format for ${recording.name}`}
            value={format}
            disabled={exportActive}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'wav' || value === 'mp3' || value === 'original') setFormat(value);
            }}
          >
            <option value="wav">WAV · uncompressed</option>
            <option value="mp3">MP3 · smaller file</option>
            <option value="original">Original (.{recording.extension})</option>
          </select>
        </label>
        <button
          className="button"
          aria-label={`Download ${recording.name} recording as ${formatName}`}
          disabled={exportActive}
          onClick={() => onDownload(format)}
        >
          <Download size={15} /> Download {formatName}
        </button>
      </div>
      {progress !== undefined && (
        <p className="recording-progress" role="status">
          {progress === null ? 'Preparing audio…' : `Converting audio… ${progress}%`}
        </p>
      )}
      {exportError && (
        <p className="recording-progress" role="alert">
          {exportError}
        </p>
      )}
    </div>
  );
}
