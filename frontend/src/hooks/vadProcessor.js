/**
 * vadProcessor.js
 *
 * AudioWorklet that runs a small RMS-based Voice Activity Detector on the
 * microphone stream and emits one PCM Float32Array per detected utterance.
 *
 * State machine (per ~10 ms frame):
 *   idle              -> speech         when RMS > startThreshold for >= speechHangFrames
 *   speech            -> trailingSilence when RMS < stopThreshold
 *   trailingSilence   -> idle (flush)   when silence persists for >= silenceHangFrames
 *
 * Hard limits:
 *   - utterances shorter than minUtteranceFrames are dropped (clicks, taps)
 *   - utterances longer than maxUtteranceFrames are force-flushed mid-speech
 *
 * The first ambientCalibFrames frames calibrate the noise floor so the
 * thresholds adapt to the user's environment.
 *
 * Posts to main thread:
 *   { type: 'utterance', samples, sampleRate, durationMs }
 *   { type: 'state', state }   // 'idle' | 'speech'
 */

export const VAD_WORKLET_NAME = 'humatiq-vad-processor';

export const VAD_WORKLET_CODE = `
class VadProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // ── Tunable parameters (frame = 128 samples ≈ 2.7 ms @ 48 kHz) ───────
    this.frameMs            = (128 / sampleRate) * 1000;
    this.speechHangFrames   = Math.ceil(100 / this.frameMs);    // 100 ms above threshold to enter speech (was 220)
    this.silenceHangFrames  = Math.ceil(400 / this.frameMs);    // 400 ms of silence to flush (was 600)
    this.minUtteranceFrames = Math.ceil(300 / this.frameMs);    // drop < 300 ms utterances (was 600)
    this.maxUtteranceFrames = Math.ceil(4000 / this.frameMs);   // force-flush at 4 s (was 15s)
    this.ambientCalibFrames = Math.ceil(500 / this.frameMs);    // first 500 ms = ambient baseline

    // ── State ─────────────────────────────────────────────────────────────
    this.state          = 'idle';     // 'idle' | 'speech' | 'trailingSilence'
    this.aboveCount     = 0;
    this.belowCount     = 0;
    this.utterFrames    = 0;
    this.utterPeak      = 0;          // max abs sample seen in current utterance
    this.calibFrames    = 0;
    this.calibSum       = 0;
    this.startThreshold = 0.015;      // slightly more sensitive (was 0.020)
    this.stopThreshold  = 0.010;      // slightly more sensitive (was 0.012)
    this.minPeakAbs     = 0.02;       // min peak amplitude (was 0.05)

    // Rolling buffer for the current utterance. Pre-allocate enough room
    // for maxUtterance + a small lead-in (so we capture the first phoneme
    // that triggered detection, which would otherwise be lost).
    this.leadInFrames   = Math.ceil(300 / this.frameMs); // was 120ms
    this.bufferCapacity = (this.maxUtteranceFrames + this.leadInFrames) * 128;
    this.buffer         = new Float32Array(this.bufferCapacity);
    this.bufferLen      = 0;

    // Lead-in ring buffer (always retains the last leadInFrames worth of audio
    // so when we transition to 'speech' we can prepend the recent past).
    this.leadIn         = new Float32Array(this.leadInFrames * 128);
    this.leadInPos      = 0;
    this.leadInFilled   = false;

    this.enabled = true;
    this.port.onmessage = (e) => {
      if (e.data?.type === 'set-enabled') {
        this.enabled = !!e.data.value;
        if (!this.enabled) this.reset();
      }
    };
  }

  reset() {
    this.state       = 'idle';
    this.aboveCount  = 0;
    this.belowCount  = 0;
    this.utterFrames = 0;
    this.utterPeak   = 0;
    this.bufferLen   = 0;
    this.leadInPos   = 0;
    this.leadInFilled = false;
  }

  appendToBuffer(samples) {
    if (this.bufferLen + samples.length > this.bufferCapacity) return;
    this.buffer.set(samples, this.bufferLen);
    this.bufferLen += samples.length;
  }

  pushLeadIn(samples) {
    // Ring-buffer write
    const len = samples.length;
    const remaining = this.leadIn.length - this.leadInPos;
    if (len <= remaining) {
      this.leadIn.set(samples, this.leadInPos);
      this.leadInPos += len;
      if (this.leadInPos === this.leadIn.length) { this.leadInPos = 0; this.leadInFilled = true; }
    } else {
      this.leadIn.set(samples.subarray(0, remaining), this.leadInPos);
      this.leadIn.set(samples.subarray(remaining), 0);
      this.leadInPos = len - remaining;
      this.leadInFilled = true;
    }
  }

  flushLeadInTo(target) {
    // Linearize the ring buffer into the utterance buffer.
    if (this.leadInFilled) {
      target.set(this.leadIn.subarray(this.leadInPos, this.leadIn.length), this.bufferLen);
      this.bufferLen += this.leadIn.length - this.leadInPos;
      target.set(this.leadIn.subarray(0, this.leadInPos), this.bufferLen);
      this.bufferLen += this.leadInPos;
    } else {
      target.set(this.leadIn.subarray(0, this.leadInPos), this.bufferLen);
      this.bufferLen += this.leadInPos;
    }
  }

  emitUtterance() {
    // Guard 1: too short → almost certainly noise / lip smack / breath
    // Guard 2: low peak amplitude → constant low-level hum that just barely
    //          beats the start threshold. Whisper hallucinates badly on these.
    if (
      this.utterFrames < this.minUtteranceFrames ||
      this.utterPeak < this.minPeakAbs
    ) {
      this.reset();
      this.port.postMessage({ type: 'state', state: 'idle' });
      return;
    }
    const samples = this.buffer.slice(0, this.bufferLen);
    const durationMs = (this.bufferLen / sampleRate) * 1000;
    this.port.postMessage(
      { type: 'utterance', samples, sampleRate, durationMs },
      [samples.buffer]
    );
    this.reset();
    this.port.postMessage({ type: 'state', state: 'idle' });
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel || !this.enabled) return true;

    // RMS energy + peak abs amplitude of this frame
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < channel.length; i++) {
      const v = channel[i];
      sum += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sum / channel.length);

    // Ambient calibration during first ~500 ms
    if (this.calibFrames < this.ambientCalibFrames) {
      this.calibSum += rms;
      this.calibFrames += 1;
      if (this.calibFrames === this.ambientCalibFrames) {
        const ambient = this.calibSum / this.ambientCalibFrames;
        // Speech is typically 6–10x ambient; we use 4x start, 2.5x stop with sane mins.
        this.startThreshold = Math.max(0.012, ambient * 4.0);
        this.stopThreshold  = Math.max(0.008, ambient * 2.5);
      }
    }

    // Always feed the lead-in ring (so the first phoneme isn't truncated)
    this.pushLeadIn(channel);

    if (this.state === 'idle') {
      if (rms > this.startThreshold) {
        this.aboveCount += 1;
        if (this.aboveCount >= this.speechHangFrames) {
          this.state = 'speech';
          this.aboveCount = 0;
          this.belowCount = 0;
          this.utterPeak  = peak;
          this.flushLeadInTo(this.buffer);
          this.appendToBuffer(channel);
          this.utterFrames = Math.ceil(this.bufferLen / 128);
          this.port.postMessage({ type: 'state', state: 'speech' });
        }
      } else {
        this.aboveCount = 0;
      }
    } else {
      // We're recording an utterance
      this.appendToBuffer(channel);
      this.utterFrames += 1;
      if (peak > this.utterPeak) this.utterPeak = peak;

      if (this.utterFrames >= this.maxUtteranceFrames) {
        this.emitUtterance();
        return true;
      }

      if (rms < this.stopThreshold) {
        this.belowCount += 1;
        if (this.belowCount >= this.silenceHangFrames) {
          this.emitUtterance();
        }
      } else {
        this.belowCount = 0;
      }
    }

    return true;
  }
}

registerProcessor('humatiq-vad-processor', VadProcessor);
`;
