import dgram from 'dgram';
import net from 'net';
import { CctvCamera, CctvZone } from '@/types';

export interface OnvifDiscoveredDevice {
  ip: string;
  port: number;
  xaddrs: string;
  hardware?: string;
  name?: string;
  suggestedZone?: CctvZone;
  suggestedStreamUrl: string;
}

export interface RtspBridgeStatus {
  gatewayType: 'go2rtc' | 'mediamtx' | 'native_proxy' | 'offline_simulation';
  online: boolean;
  version?: string;
  activeStreams: number;
  bridgeUrl: string;
  webrtcPort: number;
  supportedProtocols: string[];
}

export interface RtspStreamProbeResult {
  valid: boolean;
  reachable: boolean;
  latencyMs?: number;
  scheme: string;
  host: string;
  port: number;
  sanitizedUrl: string;
  error?: string;
}

/**
 * Strips sensitive credentials from an RTSP URL for safe logging and UI display.
 */
export function sanitizeRtspUrl(url?: string | null): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      return `${parsed.protocol}//${parsed.username ? `${parsed.username}:***@` : ''}${parsed.host}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    // If not a standard URL, mask password regex
    return url.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  }
}

/**
 * Validates syntax and parses host/port from an RTSP stream URL.
 */
export function parseRtspStreamUrl(url: string): {
  isValid: boolean;
  scheme: string;
  host: string;
  port: number;
  sanitized: string;
  error?: string;
} {
  if (!url || typeof url !== 'string') {
    return { isValid: false, scheme: '', host: '', port: 554, sanitized: '', error: 'URL is required' };
  }

  const clean = url.trim();

  // Allow simulated internal streams
  if (clean.startsWith('simulated:')) {
    return { isValid: true, scheme: 'simulated', host: 'localhost', port: 0, sanitized: clean };
  }

  try {
    const parsed = new URL(clean);
    const scheme = parsed.protocol.replace(':', '').toLowerCase();

    if (!['rtsp', 'rtsps', 'http', 'https'].includes(scheme)) {
      return {
        isValid: false,
        scheme,
        host: parsed.hostname,
        port: Number(parsed.port) || 554,
        sanitized: sanitizeRtspUrl(clean),
        error: `Unsupported protocol '${scheme}://'. Expected rtsp:// or rtsps://`,
      };
    }

    const port = parsed.port ? Number(parsed.port) : scheme === 'rtsps' ? 322 : 554;

    return {
      isValid: true,
      scheme,
      host: parsed.hostname,
      port,
      sanitized: sanitizeRtspUrl(clean),
    };
  } catch {
    return {
      isValid: false,
      scheme: '',
      host: '',
      port: 554,
      sanitized: clean,
      error: 'Invalid RTSP stream URL format',
    };
  }
}

/**
 * Probes TCP connectivity to an RTSP camera stream endpoint.
 */
export async function probeRtspStream(streamUrl: string, timeoutMs = 3000): Promise<RtspStreamProbeResult> {
  const parsed = parseRtspStreamUrl(streamUrl);
  if (!parsed.isValid) {
    return {
      valid: false,
      reachable: false,
      scheme: parsed.scheme,
      host: parsed.host,
      port: parsed.port,
      sanitizedUrl: parsed.sanitized,
      error: parsed.error,
    };
  }

  if (parsed.scheme === 'simulated') {
    return {
      valid: true,
      reachable: true,
      latencyMs: 1,
      scheme: 'simulated',
      host: 'localhost',
      port: 0,
      sanitizedUrl: parsed.sanitized,
    };
  }

  const start = Date.now();

  return new Promise<RtspStreamProbeResult>((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (isResolved) return;
      isResolved = true;
      const latencyMs = Date.now() - start;
      cleanup();
      resolve({
        valid: true,
        reachable: true,
        latencyMs,
        scheme: parsed.scheme,
        host: parsed.host,
        port: parsed.port,
        sanitizedUrl: parsed.sanitized,
      });
    });

    socket.on('timeout', () => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve({
        valid: true,
        reachable: false,
        scheme: parsed.scheme,
        host: parsed.host,
        port: parsed.port,
        sanitizedUrl: parsed.sanitized,
        error: `Connection timed out after ${timeoutMs}ms`,
      });
    });

    socket.on('error', (err) => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      resolve({
        valid: true,
        reachable: false,
        scheme: parsed.scheme,
        host: parsed.host,
        port: parsed.port,
        sanitizedUrl: parsed.sanitized,
        error: err.message,
      });
    });

    socket.connect(parsed.port, parsed.host);
  });
}

/**
 * Checks if a native RTSP gateway (go2rtc or MediaMTX) is running locally.
 */
export async function checkRtspBridgeHealth(bridgeUrl = 'http://127.0.0.1:1984'): Promise<RtspBridgeStatus> {
  const cleanUrl = bridgeUrl.replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    // Test go2rtc API
    const res = await fetch(`${cleanUrl}/api/version`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      const version = await res.text();
      return {
        gatewayType: 'go2rtc',
        online: true,
        version: version.trim(),
        activeStreams: 0,
        bridgeUrl: cleanUrl,
        webrtcPort: 8555,
        supportedProtocols: ['WebRTC (WHEP)', 'MSE (WebSocket)', 'HLS', 'MJPEG', 'RTSP'],
      };
    }
  } catch {
    // Continue to check MediaMTX
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    // Test MediaMTX API (default port 9997)
    const mtxRes = await fetch('http://127.0.0.1:9997/v3/paths/list', {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (mtxRes && mtxRes.ok) {
      return {
        gatewayType: 'mediamtx',
        online: true,
        version: 'MediaMTX v1.x',
        activeStreams: 0,
        bridgeUrl: 'http://127.0.0.1:8889',
        webrtcPort: 8889,
        supportedProtocols: ['WebRTC (WHEP)', 'HLS', 'RTSP', 'RTMP'],
      };
    }
  } catch {
    // Offline simulation
  }

  return {
    gatewayType: 'offline_simulation',
    online: false,
    bridgeUrl: cleanUrl,
    activeStreams: 0,
    webrtcPort: 1984,
    supportedProtocols: ['Simulated Canvas HUD', 'Direct RTSP Handoff'],
  };
}

/**
 * Scans the local network for ONVIF Profile S/T cameras via WS-Discovery probe.
 * Falls back to simulated discovery if physical cameras or UDP multicast are restricted.
 */
export async function discoverOnvifCameras(timeoutMs = 2500): Promise<OnvifDiscoveredDevice[]> {
  const discovered: OnvifDiscoveredDevice[] = [];

  const wsDiscoveryProbe = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<Envelope xmlns:dn="http://www.onvif.org/ver10/network/wsdl" xmlns="http://www.w3.org/2003/05/soap-envelope">',
    '  <Header>',
    '    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">uuid:cctv-onvif-probe-' + Date.now() + '</wsa:MessageID>',
    '    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>',
    '    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>',
    '  </Header>',
    '  <Body>',
    '    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">',
    '      <Types>dn:NetworkVideoTransmitter</Types>',
    '    </Probe>',
    '  </Body>',
    '</Envelope>',
  ].join('');

  try {
    const socket = dgram.createSocket('udp4');

    await new Promise<void>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { socket.close(); } catch {}
          resolve();
        }
      }, timeoutMs);

      socket.on('message', (msg) => {
        const text = msg.toString();
        const xaddrsMatch = text.match(/<d:XAddrs>(.*?)<\/d:XAddrs>/i) || text.match(/<XAddrs>(.*?)<\/XAddrs>/i);
        if (xaddrsMatch && xaddrsMatch[1]) {
          const addrs = xaddrsMatch[1].split(/\s+/).filter(Boolean);
          for (const addr of addrs) {
            try {
              const u = new URL(addr);
              discovered.push({
                ip: u.hostname,
                port: Number(u.port) || 80,
                xaddrs: addr,
                hardware: 'ONVIF IP Camera',
                name: `Camera @ ${u.hostname}`,
                suggestedStreamUrl: `rtsp://admin:password@${u.hostname}:554/live`,
              });
            } catch {}
          }
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try { socket.close(); } catch {}
          resolve();
        }
      });

      try {
        socket.bind(() => {
          try {
            socket.addMembership('239.255.255.250');
            const buf = Buffer.from(wsDiscoveryProbe);
            socket.send(buf, 0, buf.length, 3702, '239.255.255.250');
          } catch {
            // Multicast restricted
          }
        });
      } catch {
        resolve();
      }
    });
  } catch {
    // Ignore UDP socket setup errors
  }

  // If no physical cameras discovered on local LAN, provide simulated discovery templates
  if (discovered.length === 0) {
    return [
      {
        ip: '192.168.1.101',
        port: 80,
        xaddrs: 'http://192.168.1.101/onvif/device_service',
        hardware: 'Hikvision DS-2CD2043G2-I (4MP Dome)',
        name: 'ICU Critical Care Ward Camera',
        suggestedZone: 'ICU',
        suggestedStreamUrl: 'rtsp://admin:Hospital123@192.168.1.101:554/Streaming/Channels/101',
      },
      {
        ip: '192.168.1.102',
        port: 80,
        xaddrs: 'http://192.168.1.102/onvif/device_service',
        hardware: 'Dahua IPC-HFW2431S-S (4MP Bullet)',
        name: 'Operation Theatre Sterile Field',
        suggestedZone: 'OT',
        suggestedStreamUrl: 'rtsp://admin:Hospital123@192.168.1.102:554/cam/realmonitor?channel=1&subtype=0',
      },
      {
        ip: '192.168.1.103',
        port: 80,
        xaddrs: 'http://192.168.1.103/onvif/device_service',
        hardware: 'Uniview IPC2122LR3-PF40M-D',
        name: 'Trauma Emergency Resuscitation',
        suggestedZone: 'EMERGENCY',
        suggestedStreamUrl: 'rtsp://admin:Hospital123@192.168.1.103:554/unicast/c1/s0/live',
      },
      {
        ip: '192.168.1.104',
        port: 80,
        xaddrs: 'http://192.168.1.104/onvif/device_service',
        hardware: 'CP PLUS CP-UNC-T41PL3',
        name: 'Pharmacy Drug Vault & Schedule H',
        suggestedZone: 'PHARMACY',
        suggestedStreamUrl: 'rtsp://admin:Hospital123@192.168.1.104:554/cam/realmonitor?channel=1&subtype=0',
      },
      {
        ip: '192.168.1.105',
        port: 80,
        xaddrs: 'http://192.168.1.105/onvif/device_service',
        hardware: 'Hikvision DS-2DE4425IW-DE (PTZ Speed Dome)',
        name: 'OPD Reception Token Triage Area',
        suggestedZone: 'OPD_RECEPTION',
        suggestedStreamUrl: 'rtsp://admin:Hospital123@192.168.1.105:554/Streaming/Channels/101',
      },
    ];
  }

  return discovered;
}

/**
 * Generates production-ready `go2rtc.yaml` configuration mapping all clinic CCTV cameras.
 */
export function generateGo2rtcYaml(cameras: CctvCamera[]): string {
  const lines: string[] = [
    '# MedScript Hospital CCTV Gateway — go2rtc Configuration',
    '# Generated automatically for ultra-low-latency WebRTC and MSE streaming',
    '',
    'api:',
    '  listen: ":1984"',
    '',
    'webrtc:',
    '  listen: ":8555"',
    '',
    'streams:',
  ];

  for (const cam of cameras) {
    const slug = `cam_${cam.id}`;
    const comment = `# [${cam.zone}] ${cam.name} (${cam.location || 'Hospital Area'})`;
    lines.push(`  ${comment}`);
    if (cam.streamUrl.startsWith('simulated:')) {
      lines.push(`  ${slug}: "exec:ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=25 -vcodec libx264 -preset ultrafast -tune zerolatency -f rtsp rtsp://localhost:8554/${slug}"`);
    } else {
      lines.push(`  ${slug}: "${cam.streamUrl}"`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generates production-ready `mediamtx.yml` configuration mapping all clinic CCTV cameras.
 */
export function generateMediaMtxYml(cameras: CctvCamera[]): string {
  const lines: string[] = [
    '# MedScript Hospital CCTV Gateway — MediaMTX Configuration',
    '# Low-latency WebRTC (WHEP) & HLS camera streaming server',
    '',
    'webrtc: yes',
    'webrtcAddress: ":8889"',
    'hls: yes',
    'hlsAddress: ":8888"',
    'rtsp: yes',
    'rtspAddress: ":8554"',
    '',
    'paths:',
  ];

  for (const cam of cameras) {
    const slug = `cam_${cam.id}`;
    lines.push(`  ${slug}:`);
    if (cam.streamUrl.startsWith('simulated:')) {
      lines.push(`    source: publisher`);
    } else {
      lines.push(`    source: "${cam.streamUrl}"`);
      lines.push(`    sourceOnDemand: yes`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
