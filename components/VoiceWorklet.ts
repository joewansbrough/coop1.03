/**
 * VoiceWorklet.ts
 * Dedicated audio processing thread for the Co-op Oracle.
 * Handles PCM 16-bit conversion and volume metering off the main thread.
 */

class VoiceWorklet extends (globalThis as any).AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0][0]; // Get the first channel of the first input

    if (input && input.length > 0) {
      // 1. Calculate Volume Level (RMS) for UI feedback
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);
      (this as any).port.postMessage({ type: 'volume', volume: rms });

      // 2. Convert Float32 to Int16 PCM for Gemini API
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        // Clamp values to [-1.0, 1.0] before scaling to 16-bit range
        const s = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Send the PCM data back to the main thread
      // We use the buffer directly for performance
      (this as any).port.postMessage({ type: 'audio', data: pcm.buffer }, [pcm.buffer]);
    }

    return true; // Keep the processor alive
  }
}

(globalThis as any).registerProcessor('voice-worklet', VoiceWorklet);

export {}; // Ensure it's treated as a module
