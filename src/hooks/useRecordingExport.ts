import { useEffect, useRef, useState } from 'react';
import { exportRecording } from '../audio/recording-export';
import type { RecordingExportFormat } from '../audio/recording-encoder';
import type { Recording } from '../audio/recordings';
import { downloadFile, fileSlug } from '../domain/storage';

export function useRecordingExport(notify: (message: string) => void) {
  const pending = useRef<AbortController | null>(null);
  const [active, setActive] = useState<{ id: string; progress: number | null } | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function download(recording: Recording, format: RecordingExportFormat) {
    // Serialize exports so several long takes cannot allocate decoded PCM at once.
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setActive({ id: recording.id, progress: null });
    try {
      const result = await exportRecording(recording, format, controller.signal, (progress) => {
        if (!controller.signal.aborted) setActive({ id: recording.id, progress });
      });
      if (!controller.signal.aborted)
        downloadFile(
          result.blob,
          `${fileSlug(recording.name)}-${recording.id.slice(0, 6)}.${result.extension}`,
        );
    } catch {
      if (!controller.signal.aborted)
        notify('This take could not be converted. Choose Original to download the saved audio.');
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setActive(null);
    }
  }

  return { active, download };
}
