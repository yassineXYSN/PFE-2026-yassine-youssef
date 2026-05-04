/**
 * audioProcessor.js
 *
 * AudioWorklet code that buffers raw PCM samples from the microphone
 * and emits 3-second chunks to the main thread for audio emotion analysis.
 *
 * The AUDIO_WORKLET_CODE string is loaded as a Blob URL at runtime because
 * AudioWorklet modules must be loaded from a URL, not evaluated inline.
 */

export const AUDIO_WORKLET_NAME = 'humatiq-audio-chunk-processor';

export const AUDIO_WORKLET_CODE = `
class AudioChunkProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._targetSamples = Math.round(sampleRate * 3); // 3-second chunks
    this._buffer  = new Float32Array(this._targetSamples + 256);
    this._writePos = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    this._buffer.set(channel, this._writePos);
    this._writePos += channel.length;

    if (this._writePos >= this._targetSamples) {
      const chunk    = this._buffer.slice(0, this._targetSamples);
      const overflow = this._writePos - this._targetSamples;
      this.port.postMessage({ samples: chunk, sampleRate }, [chunk.buffer]);
      if (overflow > 0) this._buffer.copyWithin(0, this._targetSamples, this._writePos);
      this._writePos = overflow;
    }

    return true;
  }
}

registerProcessor('humatiq-audio-chunk-processor', AudioChunkProcessor);
`;
