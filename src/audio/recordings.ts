export interface Recording {
  id: string;
  name: string;
  createdAt: string;
  duration: number;
  blob: Blob;
  extension: string;
}

/** Blob storage belongs in IndexedDB, not localStorage (which has a small text quota). */
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('patchwork-recordings', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('recordings', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecording(recording: Recording): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('recordings', 'readwrite');
      transaction.objectStore('recordings').put(recording);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function loadRecordings(): Promise<Recording[]> {
  const db = await database();
  try {
    return await new Promise<Recording[]>((resolve, reject) => {
      const request = db.transaction('recordings').objectStore('recordings').getAll();
      request.onsuccess = () =>
        resolve(
          (request.result as Recording[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        );
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('recordings', 'readwrite');
      transaction.objectStore('recordings').delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function preferredRecordingType(): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === 'undefined')
    throw new Error(
      'Recording is unavailable in this browser. Try a current Chrome, Edge, Firefox, or Safari.',
    );
  for (const [mimeType, extension] of [
    ['audio/webm;codecs=opus', 'webm'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['audio/mp4', 'm4a'],
  ]) {
    if (MediaRecorder.isTypeSupported(mimeType)) return { mimeType, extension };
  }
  throw new Error('This browser does not support an audio recording format.');
}
