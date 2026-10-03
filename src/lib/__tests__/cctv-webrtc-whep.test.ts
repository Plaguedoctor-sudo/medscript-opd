import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveWhepUrl,
  applyPtzCommand,
  calculatePanTiltFromDrag,
  CctvWhepClient,
  HOSPITAL_PTZ_PRESETS,
} from '../cctv/webrtc-whep-client';
import { CctvCamera, CctvPtzState } from '@/types';

describe('CCTV WebRTC WHEP Client & Optical PTZ Control Subsystem', () => {
  const mockCamera: CctvCamera = {
    id: 42,
    name: 'ICU Bed 1 HD Camera',
    zone: 'ICU',
    location: 'Bed 1 - ICU Floor 2',
    streamUrl: 'rtsp://admin:Hospital123@192.168.1.101:554/live',
    status: 'ONLINE',
    resolution: '1080p',
    fps: 25,
    hasPtz: true,
    privacyMasking: false,
    motionDetectionEnabled: true,
    ipAddress: '192.168.1.101',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('resolveWhepUrl', () => {
    it('returns null for simulated camera feeds', () => {
      const simulatedCam: CctvCamera = {
        ...mockCamera,
        streamUrl: 'simulated:icu',
      };
      expect(resolveWhepUrl(simulatedCam)).toBeNull();
    });

    it('returns custom WHEP endpoint directly if provided in streamUrl', () => {
      const customCam: CctvCamera = {
        ...mockCamera,
        streamUrl: 'http://192.168.1.200:1984/api/webrtc?src=custom_icu',
      };
      expect(resolveWhepUrl(customCam)).toBe('http://192.168.1.200:1984/api/webrtc?src=custom_icu');
    });

    it('formats go2rtc WHEP endpoint correctly by default', () => {
      const url = resolveWhepUrl(mockCamera, 'http://127.0.0.1:1984', 'go2rtc');
      expect(url).toBe('http://127.0.0.1:1984/api/webrtc?src=cam_42');
    });

    it('formats MediaMTX WHEP endpoint correctly', () => {
      const url = resolveWhepUrl(mockCamera, 'http://127.0.0.1:8889', 'mediamtx');
      expect(url).toBe('http://127.0.0.1:8889/cam_42/whep');
    });

    it('handles trailing slashes on bridge URLs gracefully', () => {
      const url = resolveWhepUrl(mockCamera, 'http://127.0.0.1:1984/', 'go2rtc');
      expect(url).toBe('http://127.0.0.1:1984/api/webrtc?src=cam_42');
    });
  });

  describe('applyPtzCommand', () => {
    const initialPtz: CctvPtzState = {
      pan: 0,
      tilt: 0,
      zoom: 1.0,
      presetName: 'Home',
    };

    it('adjusts pan correctly within -180 to 180 degrees', () => {
      let state = applyPtzCommand(initialPtz, 'RIGHT');
      expect(state.pan).toBe(10);
      expect(state.presetName).toBeUndefined();

      state = applyPtzCommand(state, 'LEFT');
      expect(state.pan).toBe(0);

      // Boundary clamp test
      const maxRight: CctvPtzState = { pan: 180, tilt: 0, zoom: 1.0 };
      expect(applyPtzCommand(maxRight, 'RIGHT').pan).toBe(180);

      const maxLeft: CctvPtzState = { pan: -180, tilt: 0, zoom: 1.0 };
      expect(applyPtzCommand(maxLeft, 'LEFT').pan).toBe(-180);
    });

    it('adjusts tilt correctly within -90 to 90 degrees', () => {
      let state = applyPtzCommand(initialPtz, 'UP');
      expect(state.tilt).toBe(5);

      state = applyPtzCommand(state, 'DOWN');
      expect(state.tilt).toBe(0);

      // Boundary clamp test
      const maxUp: CctvPtzState = { pan: 0, tilt: 90, zoom: 1.0 };
      expect(applyPtzCommand(maxUp, 'UP').tilt).toBe(90);

      const maxDown: CctvPtzState = { pan: 0, tilt: -90, zoom: 1.0 };
      expect(applyPtzCommand(maxDown, 'DOWN').tilt).toBe(-90);
    });

    it('adjusts optical zoom factor correctly within 1.0x to 30.0x', () => {
      let state = applyPtzCommand(initialPtz, 'ZOOM_IN');
      expect(state.zoom).toBe(1.5);

      state = applyPtzCommand(state, 'ZOOM_OUT');
      expect(state.zoom).toBe(1.0);

      // Boundary clamp test
      const minZoom: CctvPtzState = { pan: 0, tilt: 0, zoom: 1.0 };
      expect(applyPtzCommand(minZoom, 'ZOOM_OUT').zoom).toBe(1.0);

      const maxZoom: CctvPtzState = { pan: 0, tilt: 0, zoom: 30.0 };
      expect(applyPtzCommand(maxZoom, 'ZOOM_IN').zoom).toBe(30.0);
    });

    it('resets to home position', () => {
      const moved: CctvPtzState = { pan: 45, tilt: -20, zoom: 5.5 };
      const reset = applyPtzCommand(moved, 'RESET');
      expect(reset).toEqual({
        pan: 0,
        tilt: 0,
        zoom: 1.0,
        presetName: 'Home',
      });
    });

    it('recalls hospital clinical surveillance presets correctly', () => {
      const p1 = applyPtzCommand(initialPtz, 'PRESET_1');
      expect(p1.presetName).toBe(HOSPITAL_PTZ_PRESETS.PRESET_1.presetName);
      expect(p1.pan).toBe(HOSPITAL_PTZ_PRESETS.PRESET_1.pan);
      expect(p1.tilt).toBe(HOSPITAL_PTZ_PRESETS.PRESET_1.tilt);
      expect(p1.zoom).toBe(HOSPITAL_PTZ_PRESETS.PRESET_1.zoom);

      const p2 = applyPtzCommand(initialPtz, 'PRESET_2');
      expect(p2.presetName).toBe('Ward Doorway / Access');

      const p3 = applyPtzCommand(initialPtz, 'PRESET_3');
      expect(p3.presetName).toBe('Medical Equipment & Infusion Rack');
    });
  });

  describe('calculatePanTiltFromDrag', () => {
    it('calculates smooth proportional pan and tilt adjustments from drag gestures', () => {
      const initial: CctvPtzState = { pan: 0, tilt: 0, zoom: 1.0 };
      const updated = calculatePanTiltFromDrag(initial, 50, 25, 0.2);

      // deltaX = 50 * 0.2 = +10 pan
      // deltaY = 25 * 0.2 = -5 tilt (dragging down tilts camera down)
      expect(updated.pan).toBe(10);
      expect(updated.tilt).toBe(-5);
      expect(updated.presetName).toBeUndefined();
    });

    it('clamps drag adjustments to legal optical angles', () => {
      const initial: CctvPtzState = { pan: 175, tilt: 88, zoom: 1.0 };
      const updated = calculatePanTiltFromDrag(initial, 100, -100, 0.2);

      expect(updated.pan).toBe(180);
      expect(updated.tilt).toBe(90);
    });
  });

  describe('CctvWhepClient lifecycle and error handling', () => {
    it('initializes with idle metrics state', () => {
      const client = new CctvWhepClient();
      const metrics = client.getMetrics();
      expect(metrics.connectionState).toBe('idle');
      expect(metrics.protocol).toBe('WHEP');
      expect(metrics.latencyMs).toBe(0);
      expect(metrics.bitrateKbps).toBe(0);
    });

    it('cleanly disconnects and tears down active session without throwing', () => {
      const client = new CctvWhepClient();
      expect(() => client.disconnect()).not.toThrow();
      expect(client.getMetrics().connectionState).toBe('idle');
    });
  });
});
