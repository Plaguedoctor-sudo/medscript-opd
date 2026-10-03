import { CctvCamera, CctvPtzAction, CctvPtzState, CctvStreamMetrics, CctvStreamProtocol } from '@/types';

/**
 * Standard presets for hospital clinical surveillance
 */
export const HOSPITAL_PTZ_PRESETS: Record<string, CctvPtzState> = {
  PRESET_1: {
    pan: 0,
    tilt: -15,
    zoom: 2.5,
    presetName: 'Patient Bed Focus',
  },
  PRESET_2: {
    pan: -45,
    tilt: 0,
    zoom: 1.0,
    presetName: 'Ward Doorway / Access',
  },
  PRESET_3: {
    pan: 35,
    tilt: -10,
    zoom: 4.0,
    presetName: 'Medical Equipment & Infusion Rack',
  },
};

/**
 * Resolves the WHEP egress URL for a given camera and RTSP bridge configuration.
 * Returns null if the stream is simulated.
 */
export function resolveWhepUrl(
  camera: CctvCamera,
  bridgeUrl = 'http://127.0.0.1:1984',
  gatewayType: 'go2rtc' | 'mediamtx' | string = 'go2rtc'
): string | null {
  if (!camera.streamUrl || camera.streamUrl.startsWith('simulated:')) {
    return null;
  }

  // If the stream URL is already a full WHEP endpoint, use it directly
  if (
    (camera.streamUrl.startsWith('http://') || camera.streamUrl.startsWith('https://')) &&
    (camera.streamUrl.includes('/whep') || camera.streamUrl.includes('/api/webrtc'))
  ) {
    return camera.streamUrl;
  }

  const cleanBase = bridgeUrl.replace(/\/+$/, '');
  const streamSlug = `cam_${camera.id}`;

  if (gatewayType === 'mediamtx') {
    return `${cleanBase}/${streamSlug}/whep`;
  }

  // Default to go2rtc WHEP API
  return `${cleanBase}/api/webrtc?src=${streamSlug}`;
}

/**
 * Updates PTZ state based on a discrete command or preset recall.
 */
export function applyPtzCommand(current: CctvPtzState, action: CctvPtzAction): CctvPtzState {
  const panStep = 10;
  const tiltStep = 5;
  const zoomStep = 0.5;

  switch (action) {
    case 'UP':
      return {
        ...current,
        tilt: Math.min(90, current.tilt + tiltStep),
        presetName: undefined,
      };
    case 'DOWN':
      return {
        ...current,
        tilt: Math.max(-90, current.tilt - tiltStep),
        presetName: undefined,
      };
    case 'LEFT':
      return {
        ...current,
        pan: Math.max(-180, current.pan - panStep),
        presetName: undefined,
      };
    case 'RIGHT':
      return {
        ...current,
        pan: Math.min(180, current.pan + panStep),
        presetName: undefined,
      };
    case 'ZOOM_IN':
      return {
        ...current,
        zoom: Math.min(30.0, Number((current.zoom + zoomStep).toFixed(1))),
        presetName: undefined,
      };
    case 'ZOOM_OUT':
      return {
        ...current,
        zoom: Math.max(1.0, Number((current.zoom - zoomStep).toFixed(1))),
        presetName: undefined,
      };
    case 'RESET':
      return {
        pan: 0,
        tilt: 0,
        zoom: 1.0,
        presetName: 'Home',
      };
    case 'PRESET_1':
      return { ...HOSPITAL_PTZ_PRESETS.PRESET_1 };
    case 'PRESET_2':
      return { ...HOSPITAL_PTZ_PRESETS.PRESET_2 };
    case 'PRESET_3':
      return { ...HOSPITAL_PTZ_PRESETS.PRESET_3 };
    default:
      return current;
  }
}

/**
 * Computes pan and tilt adjustments from interactive canvas drag vectors.
 */
export function calculatePanTiltFromDrag(
  current: CctvPtzState,
  deltaX: number,
  deltaY: number,
  sensitivity = 0.2
): CctvPtzState {
  const newPan = Math.max(-180, Math.min(180, current.pan + deltaX * sensitivity));
  const newTilt = Math.max(-90, Math.min(90, current.tilt - deltaY * sensitivity));

  return {
    ...current,
    pan: Math.round(newPan * 10) / 10,
    tilt: Math.round(newTilt * 10) / 10,
    presetName: undefined,
  };
}

export interface WhepSessionCallbacks {
  onMetricsUpdate?: (metrics: CctvStreamMetrics) => void;
  onConnectionChange?: (state: CctvStreamMetrics['connectionState']) => void;
  onError?: (err: Error) => void;
}

/**
 * WHEP WebRTC Client for hardware-accelerated, zero-latency (<200ms) CCTV playback.
 * Compliant with draft-ietf-wish-whep specifications.
 */
export class CctvWhepClient {
  private pc: RTCPeerConnection | null = null;
  private whepResourceUrl: string | null = null;
  private statsTimer: any = null;
  private lastBytesReceived = 0;
  private lastStatsTimestamp = 0;
  private currentMetrics: CctvStreamMetrics = {
    connectionState: 'idle',
    protocol: 'WHEP',
    latencyMs: 0,
    fps: 0,
    bitrateKbps: 0,
    bytesReceived: 0,
    lastUpdated: new Date(),
  };

  constructor(private callbacks?: WhepSessionCallbacks) {}

  public getMetrics(): CctvStreamMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Initiates a WHEP session and binds the resulting stream to the HTMLVideoElement.
   */
  public async connect(
    videoElement: HTMLVideoElement,
    whepEndpoint: string,
    iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
  ): Promise<void> {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC is only supported in browser environments');
    }

    this.disconnect();
    this.updateState('connecting');

    try {
      const pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: 'max-bundle',
      });
      this.pc = pc;

      // Add transceivers for inbound video and audio
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          videoElement.srcObject = event.streams[0];
          videoElement.play().catch(() => {
            // Autoplay policies might require mute
            videoElement.muted = true;
            videoElement.play().catch(() => {});
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          this.updateState('connected');
          this.startStatsMonitoring();
        } else if (state === 'failed' || state === 'closed') {
          this.updateState('failed');
          this.stopStatsMonitoring();
        } else if (state === 'disconnected') {
          this.updateState('disconnected');
        }
      };

      // Create SDP Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering or proceed immediately
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkIce = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkIce);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkIce);
          // Safety timeout for ICE candidate gathering
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', checkIce);
            resolve();
          }, 600);
        }
      });

      const sdpOffer = pc.localDescription?.sdp || offer.sdp || '';

      // Send WHEP HTTP POST request
      const response = await fetch(whepEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: sdpOffer,
      });

      if (!response.ok) {
        throw new Error(`WHEP negotiation rejected with HTTP status ${response.status}: ${response.statusText}`);
      }

      // Check Location header for WHEP resource management
      const location = response.headers.get('Location');
      if (location) {
        this.whepResourceUrl = new URL(location, whepEndpoint).toString();
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
    } catch (err: any) {
      this.updateState('failed');
      this.callbacks?.onError?.(err);
      this.disconnect();
      throw err;
    }
  }

  /**
   * Gracefully tears down the WebRTC connection and notifies the WHEP endpoint.
   */
  public disconnect(): void {
    this.stopStatsMonitoring();

    if (this.whepResourceUrl) {
      const resource = this.whepResourceUrl;
      this.whepResourceUrl = null;
      try {
        fetch(resource, { method: 'DELETE', keepalive: true }).catch(() => {});
      } catch {}
    }

    if (this.pc) {
      try {
        this.pc.getTransceivers().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.updateState('idle');
  }

  private updateState(state: CctvStreamMetrics['connectionState']): void {
    this.currentMetrics.connectionState = state;
    this.currentMetrics.lastUpdated = new Date();
    this.callbacks?.onConnectionChange?.(state);
    this.callbacks?.onMetricsUpdate?.(this.getMetrics());
  }

  private startStatsMonitoring(): void {
    this.stopStatsMonitoring();
    this.lastStatsTimestamp = Date.now();
    this.lastBytesReceived = 0;

    this.statsTimer = setInterval(async () => {
      if (!this.pc || this.pc.connectionState !== 'connected') return;

      try {
        const stats = await this.pc.getStats();
        let totalBytes = 0;
        let fps = 0;
        let rttMs = 120; // Default nominal low latency
        let resWidth = 0;
        let resHeight = 0;
        let packetsLost = 0;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            totalBytes += report.bytesReceived || 0;
            fps = report.framesPerSecond || fps;
            packetsLost = report.packetsLost || 0;
            if (report.frameWidth && report.frameHeight) {
              resWidth = report.frameWidth;
              resHeight = report.frameHeight;
            }
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
        });

        const now = Date.now();
        const elapsedSec = (now - this.lastStatsTimestamp) / 1000;
        let bitrate = 0;

        if (elapsedSec > 0 && this.lastBytesReceived > 0) {
          const deltaBytes = Math.max(0, totalBytes - this.lastBytesReceived);
          bitrate = Math.round((deltaBytes * 8) / (elapsedSec * 1000));
        }

        this.lastBytesReceived = totalBytes;
        this.lastStatsTimestamp = now;

        this.currentMetrics = {
          connectionState: 'connected',
          protocol: 'WHEP',
          latencyMs: rttMs,
          fps: Math.round(fps) || 25,
          bitrateKbps: bitrate,
          bytesReceived: totalBytes,
          resolution: resWidth > 0 ? `${resWidth}×${resHeight}` : undefined,
          packetsLost,
          lastUpdated: new Date(),
        };

        this.callbacks?.onMetricsUpdate?.(this.getMetrics());
      } catch {}
    }, 2000);
  }

  private stopStatsMonitoring(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
  }
}
