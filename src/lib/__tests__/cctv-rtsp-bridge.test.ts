import { describe, it, expect } from 'vitest';
import {
  sanitizeRtspUrl,
  parseRtspStreamUrl,
  probeRtspStream,
  checkRtspBridgeHealth,
  discoverOnvifCameras,
  generateGo2rtcYaml,
  generateMediaMtxYml,
} from '@/lib/cctv/rtsp-bridge';
import { CctvCamera } from '@/types';

describe('Hospital CCTV Native RTSP Bridge & ONVIF Discovery', () => {
  describe('sanitizeRtspUrl', () => {
    it('masks passwords in RTSP URLs for security and logging', () => {
      const url = 'rtsp://admin:SecretPass123@192.168.1.100:554/cam/realmonitor';
      const sanitized = sanitizeRtspUrl(url);
      expect(sanitized).toBe('rtsp://admin:***@192.168.1.100:554/cam/realmonitor');
      expect(sanitized).not.toContain('SecretPass123');
    });

    it('preserves URLs without credentials untouched', () => {
      const url = 'rtsp://192.168.1.100:554/live';
      expect(sanitizeRtspUrl(url)).toBe(url);
    });

    it('handles simulated stream identifiers gracefully', () => {
      expect(sanitizeRtspUrl('simulated:icu')).toBe('simulated:icu');
    });
  });

  describe('parseRtspStreamUrl', () => {
    it('parses valid RTSP URLs and extracts host and port', () => {
      const res = parseRtspStreamUrl('rtsp://192.168.1.120:554/h264/ch1');
      expect(res.isValid).toBe(true);
      expect(res.scheme).toBe('rtsp');
      expect(res.host).toBe('192.168.1.120');
      expect(res.port).toBe(554);
    });

    it('defaults standard port 554 when port is omitted', () => {
      const res = parseRtspStreamUrl('rtsp://camera.local/live');
      expect(res.isValid).toBe(true);
      expect(res.port).toBe(554);
    });

    it('accepts simulated stream identifiers', () => {
      const res = parseRtspStreamUrl('simulated:ot');
      expect(res.isValid).toBe(true);
      expect(res.scheme).toBe('simulated');
    });

    it('rejects unsupported protocols', () => {
      const res = parseRtspStreamUrl('ftp://192.168.1.50/stream');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("Unsupported protocol 'ftp://'");
    });

    it('rejects invalid or empty inputs', () => {
      expect(parseRtspStreamUrl('').isValid).toBe(false);
      expect(parseRtspStreamUrl('not-a-url').isValid).toBe(false);
    });
  });

  describe('probeRtspStream', () => {
    it('successfully validates simulated stream', async () => {
      const result = await probeRtspStream('simulated:emergency');
      expect(result.valid).toBe(true);
      expect(result.reachable).toBe(true);
      expect(result.scheme).toBe('simulated');
    });

    it('reports error on invalid stream URL syntax', async () => {
      const result = await probeRtspStream('invalid-protocol://foo');
      expect(result.valid).toBe(false);
      expect(result.reachable).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('checkRtspBridgeHealth', () => {
    it('returns bridge status object with supported protocols', async () => {
      const status = await checkRtspBridgeHealth();
      expect(status).toBeDefined();
      expect(status.supportedProtocols.length).toBeGreaterThan(0);
      expect(['go2rtc', 'mediamtx', 'native_proxy', 'offline_simulation']).toContain(status.gatewayType);
    });
  });

  describe('discoverOnvifCameras', () => {
    it('discovers cameras with zone mapping and suggested RTSP URLs', async () => {
      const cameras = await discoverOnvifCameras(50);
      expect(Array.isArray(cameras)).toBe(true);
      expect(cameras.length).toBeGreaterThan(0);

      const first = cameras[0];
      expect(first.ip).toBeDefined();
      expect(first.port).toBeGreaterThan(0);
      expect(first.suggestedStreamUrl).toContain('rtsp://');
      expect(first.hardware).toBeDefined();
    });
  });

  describe('Configuration Generators', () => {
    const mockCameras: CctvCamera[] = [
      {
        id: 1,
        name: 'ICU Bed 1',
        zone: 'ICU',
        location: 'ICU Bay A',
        streamUrl: 'rtsp://admin:pass@192.168.1.101:554/ch1',
        status: 'ONLINE',
        resolution: '1080p',
        fps: 25,
        hasPtz: true,
        privacyMasking: false,
        motionDetectionEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: 'OT Main Dome',
        zone: 'OT',
        location: 'Operation Theatre 1',
        streamUrl: 'simulated:ot',
        status: 'ONLINE',
        resolution: '1080p',
        fps: 30,
        hasPtz: false,
        privacyMasking: false,
        motionDetectionEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('generates go2rtc.yaml with streams mapped', () => {
      const yaml = generateGo2rtcYaml(mockCameras);
      expect(yaml).toContain('api:');
      expect(yaml).toContain('webrtc:');
      expect(yaml).toContain('streams:');
      expect(yaml).toContain('cam_1: "rtsp://admin:pass@192.168.1.101:554/ch1"');
      expect(yaml).toContain('cam_2:');
    });

    it('generates mediamtx.yml with WebRTC WHEP enabled', () => {
      const yaml = generateMediaMtxYml(mockCameras);
      expect(yaml).toContain('webrtc: yes');
      expect(yaml).toContain('cam_1:');
      expect(yaml).toContain('cam_2:');
    });
  });
});
