# Implementation Plan: Oracle Live Voice Chat Refinement

## Objective
Transition the Oracle's Live Voice Chat from a prototype to a production-grade multimodal experience. This refinement focuses on three pillars: **Latency**, **Fluidity**, and **Interactivity**.

## Key Files & Context
- `Oracle/CoopOracle.tsx`: Main UI and audio orchestration component.
- `Oracle/geminiService.ts`: Gemini Multimodal Live API integration.
- `Oracle/VoiceWorklet.ts` (New): Dedicated audio processing thread.

## Implementation Steps

### Phase 1: Low-Latency Audio Infrastructure
1. **AudioWorklet Implementation**: Create a `VoiceWorklet.ts` to handle PCM conversion and Volume Metering off the main thread. This prevents "crackling" during React re-renders.
2. **Context Migration**: Update `CoopOracle.tsx` to initialize the `AudioWorkletNode` instead of the deprecated `ScriptProcessorNode`.

### Phase 2: Fluid Playback (Gapless Speech)
1. **PlaybackScheduler Class**: Implement a look-ahead scheduler to manage the `audioQueue`. 
   - Use `audioContext.currentTime` to schedule the *exact* start time of the next buffer.
   - Maintain a `nextStartTime` variable to ensure zero-gap transitions between 24kHz audio chunks.
2. **Buffering Strategy**: Implement a small initial buffer (e.g., 2-3 chunks) before starting playback to account for network jitter.

### Phase 3: Interactive "Barge-In" (Interruption)
1. **Active Track Tracking**: Maintain a reference to the currently playing `AudioBufferSourceNode`.
2. **Barge-In Logic**: 
   - Trigger a "stop" on the active source node the moment `onInterrupted` is received from the Gemini API.
   - Automatically pause playback when the user's local volume meter exceeds a "speech threshold."

### Phase 4: Visual Feedback & UI
1. **Canvas Visualizer**: Add a real-time frequency visualizer using the `AnalyserNode`.
2. **Status Indicators**: Implement clear states for "Listening" (Green pulse), "Oracle Thinking" (Teal wave), and "Oracle Speaking" (Teal pulse).

## Proposed Code Structure (Conceptual)

### 1. Gapless Scheduler (Inside `CoopOracle.tsx`)
```typescript
const schedulePlayback = (samples: Int16Array) => {
  const ctx = audioContextRef.current!;
  const buffer = ctx.createBuffer(1, samples.length, 24000);
  buffer.getChannelData(0).set(samples.map(s => s / 32768.0));

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  // Calculate start time: either now or right after the last scheduled buffer
  const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
  source.start(startTime);
  
  activeSourceRef.current = source;
  nextStartTimeRef.current = startTime + buffer.duration;
};
```

### 2. AudioWorklet (Conceptual `VoiceWorklet.ts`)
```javascript
class VoiceWorklet extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0][0];
    if (input) {
      // Convert to Int16 and send to main thread
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
      }
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor('voice-worklet', VoiceWorklet);
```

## Verification & Testing
1. **Latency Test**: Verify that the delay between user finishing a sentence and the Oracle starting is < 1.5 seconds.
2. **Interrupt Test**: Confirm that saying "Stop" or "Wait" immediately halts the Oracle's audio output.
3. **Stress Test**: Ensure audio remains smooth while navigating between the Oracle and Maintenance pages.
4. **Mobile Check**: Verify microphone permissions and AudioContext resume behavior on mobile browsers.
