import {
  encodeRecording,
  type RecordingEncodeRequest,
  type RecordingEncodeResponse,
} from './recording-encoder';

declare const self: DedicatedWorkerGlobalScope;

const respond = (response: RecordingEncodeResponse) => self.postMessage(response);
self.onmessage = (event: MessageEvent<RecordingEncodeRequest>) => {
  try {
    const blob = encodeRecording(event.data, (progress) => respond({ type: 'progress', progress }));
    respond({ type: 'complete', blob });
  } catch (error) {
    respond({
      type: 'error',
      message: error instanceof Error ? error.message : 'Audio conversion failed.',
    });
  }
};
