'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CctvCamera,
  CctvPtzAction,
  CctvPtzState,
  CctvStreamMetrics,
} from '@/types';
import {
  CctvWhepClient,
  resolveWhepUrl,
  applyPtzCommand,
  calculatePanTiltFromDrag,
  HOSPITAL_PTZ_PRESETS,
} from '@/lib/cctv/webrtc-whep-client';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Sliders,
  ShieldCheck,
  Radio,
  Zap,
  RefreshCw,
  Camera,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CctvWebRtcPlayerProps {
  camera: CctvCamera;
  isExpanded?: boolean;
  privacyMasking?: boolean;
  showPtzOverlay?: boolean;
  bridgeUrl?: string;
  gatewayType?: 'go2rtc' | 'mediamtx' | string;
  onSnapshot?: (dataUrl: string) => void;
  onPtzChange?: (ptz: CctvPtzState) => void;
  className?: string;
}

export function CctvWebRtcPlayer({
  camera,
  isExpanded = false,
  privacyMasking = false,
  showPtzOverlay = true,
  bridgeUrl = 'http://127.0.0.1:1984',
  gatewayType = 'go2rtc',
  onSnapshot,
  onPtzChange,
  className = '',
}: CctvWebRtcPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [metrics, setMetrics] = useState<CctvStreamMetrics>({
    connectionState: 'idle',
    protocol: camera.streamUrl.startsWith('simulated:') ? 'SIMULATED' : 'WHEP',
    latencyMs: 0,
    fps: camera.fps || 25,
    bitrateKbps: 0,
    bytesReceived: 0,
    lastUpdated: new Date(),
  });

  const [ptzState, setPtzState] = useState<CctvPtzState>({
    pan: 0,
    tilt: 0,
    zoom: 1.0,
    presetName: 'Home',
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [showPtzControls, setShowPtzControls] = useState(isExpanded);
  const [ptzFeedback, setPtzFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<any>(null);

  // Trigger feedback banner
  const triggerPtzBanner = useCallback((msg: string) => {
    setPtzFeedback(msg);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      setPtzFeedback(null);
    }, 2000);
  }, []);

  // PTZ command handler
  const handlePtzAction = useCallback(
    (action: CctvPtzAction) => {
      setPtzState((prev) => {
        const next = applyPtzCommand(prev, action);
        onPtzChange?.(next);
        const name = next.presetName ? `Preset: ${next.presetName}` : `${action} (P:${next.pan}° T:${next.tilt}° Z:${next.zoom}x)`;
        triggerPtzBanner(name);
        return next;
      });
    },
    [onPtzChange, triggerPtzBanner]
  );

  // Mouse drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!camera.hasPtz && !isExpanded) return;
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      setPtzState((prev) => {
        const next = calculatePanTiltFromDrag(prev, deltaX, deltaY);
        onPtzChange?.(next);
        return next;
      });
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Attempt WebRTC WHEP connection
  const whepClientRef = useRef<CctvWhepClient | null>(null);

  const startWhepConnection = useCallback(async () => {
    const whepUrl = resolveWhepUrl(camera, bridgeUrl, gatewayType);
    if (!whepUrl || !videoRef.current) {
      setMetrics((prev) => ({
        ...prev,
        connectionState: 'idle',
        protocol: 'SIMULATED',
        fps: camera.fps || 25,
      }));
      return;
    }

    if (whepClientRef.current) {
      whepClientRef.current.disconnect();
    }

    const client = new CctvWhepClient({
      onMetricsUpdate: (m) => setMetrics(m),
      onConnectionChange: (state) => {
        setMetrics((prev) => ({
          ...prev,
          connectionState: state,
        }));
      },
      onError: () => {
        // Gracefully fall back to simulated/canvas renderer
        setMetrics((prev) => ({
          ...prev,
          connectionState: 'failed',
          protocol: 'SIMULATED',
        }));
      },
    });

    whepClientRef.current = client;

    try {
      await client.connect(videoRef.current, whepUrl);
    } catch {
      // Fallback is handled in onError
    }
  }, [camera, bridgeUrl, gatewayType]);

  useEffect(() => {
    startWhepConnection();

    return () => {
      if (whepClientRef.current) {
        whepClientRef.current.disconnect();
        whepClientRef.current = null;
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [startWhepConnection]);

  // Canvas HUD animator for simulated feed or during WebRTC connection / fallback
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Dark clinical room background with scanlines
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, w, h);

      // Grid perspective lines responding to PTZ Pan/Tilt
      const offsetX = (ptzState.pan / 180) * 80;
      const offsetY = (ptzState.tilt / 90) * 40;

      ctx.save();
      ctx.translate(offsetX, offsetY);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = -80; x < w + 80; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, -40);
        ctx.lineTo(x, h + 40);
        ctx.stroke();
      }
      for (let y = -40; y < h + 40; y += 30) {
        ctx.beginPath();
        ctx.moveTo(-80, y);
        ctx.lineTo(w + 80, y);
        ctx.stroke();
      }

      // Zone-specific clinical HUD graphics
      if (camera.zone === 'ICU') {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.25, h * 0.35, w * 0.5, h * 0.45);

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const startX = w * 0.05;
        const waveY = h * 0.85;
        for (let i = 0; i < w * 0.4; i++) {
          const px = startX + i;
          const offset = (i + tick * 2) % 60;
          let py = waveY;
          if (offset > 25 && offset < 35) {
            py = waveY - (offset === 30 ? 18 : 6);
          }
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = '10px monospace';
        ctx.fillText('ECG LEAD II: 74 BPM  •  SpO2 99%', w * 0.05, h * 0.94);
      } else if (camera.zone === 'OT') {
        const gradient = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, h * 0.4);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.45, h * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(w * 0.3, h * 0.28, w * 0.4, h * 0.45);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '9px monospace';
        ctx.fillText('STERILE FIELD A-1 • LAMINAR FLOW ACTIVE', w * 0.3, h * 0.25);
      } else if (camera.zone === 'PHARMACY') {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
        ctx.fillStyle = '#059669';
        ctx.font = '9px monospace';
        ctx.fillText('SCHEDULE H NARCOTIC VAULT • BIOMETRIC LOCK ACTIVE', w * 0.2, h * 0.17);
      } else if (camera.zone === 'EMERGENCY') {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.strokeRect(w * 0.15, h * 0.25, w * 0.7, h * 0.5);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '9px monospace';
        ctx.fillText('TRAUMA RESUSCITATION BAY • TRIAGE RED', w * 0.15, h * 0.22);
      }

      // Simulated motion tracking box
      const driftX = Math.sin(tick * 0.02) * 15;
      const driftY = Math.cos(tick * 0.02) * 8;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(w * 0.4 + driftX, h * 0.4 + driftY, 80, 60);
      ctx.setLineDash([]);

      ctx.restore();

      // On-screen timecode (IST)
      const now = new Date();
      const timeStr = `${now.toISOString().split('T')[0]}  ${now.toTimeString().split(' ')[0]} IST`;
      ctx.fillStyle = '#ffffff';
      ctx.font = isExpanded ? '12px monospace' : '10px monospace';
      ctx.fillText(timeStr, 12, 20);

      // Camera title & IP
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = isExpanded ? '11px monospace' : '9px monospace';
      ctx.fillText(
        `CAM-${camera.id.toString().padStart(2, '0')} [${camera.ipAddress || 'LAN-ONVIF'}]  PTZ:${ptzState.pan}°/${ptzState.tilt}° ${ptzState.zoom}x`,
        12,
        h - 12
      );

      // Scanline overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < h; i += 4) {
        ctx.fillRect(0, i, w, 1);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [camera, isExpanded, ptzState]);

  // Capture current video or canvas frame
  const handleCaptureSnapshot = () => {
    let dataUrl = '';
    if (metrics.connectionState === 'connected' && videoRef.current) {
      const v = videoRef.current;
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = v.videoWidth || 1280;
      snapCanvas.height = v.videoHeight || 720;
      const ctx = snapCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, snapCanvas.width, snapCanvas.height);
        dataUrl = snapCanvas.toDataURL('image/jpeg', 0.9);
      }
    } else if (canvasRef.current) {
      dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    }

    if (dataUrl) {
      onSnapshot?.(dataUrl);
      triggerPtzBanner('📸 Snapshot Captured');
    }
  };

  const isWebRtcLive = metrics.connectionState === 'connected';

  // Apply optical/digital PTZ zoom and translate
  const ptzTransformStyle: React.CSSProperties = {
    transform: `scale(${ptzState.zoom}) translate(${-(ptzState.pan / 180) * 15}%, ${-(ptzState.tilt / 90) * 15}%)`,
    transformOrigin: 'center center',
    transition: isDragging ? 'none' : 'transform 200ms ease-out',
    willChange: 'transform',
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`relative w-full h-full bg-black overflow-hidden select-none group ${
        isDragging ? 'cursor-grabbing' : camera.hasPtz || isExpanded ? 'cursor-grab' : 'cursor-default'
      } ${className}`}
    >
      {/* Real Hardware-Accelerated Video Layer (WHEP) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        style={ptzTransformStyle}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          isWebRtcLive ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } ${privacyMasking ? 'filter blur-md' : ''}`}
      />

      {/* Simulated / Fallback Canvas HUD Layer */}
      <canvas
        ref={canvasRef}
        width={isExpanded ? 800 : 400}
        height={isExpanded ? 450 : 225}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isWebRtcLive ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${privacyMasking ? 'filter blur-md' : ''}`}
      />

      {/* HIPAA Privacy Mask Banner */}
      {privacyMasking && (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center text-center p-3 pointer-events-none z-10">
          <ShieldCheck className="w-8 h-8 text-cyan-400 mb-1" />
          <span className="text-xs font-bold text-cyan-200">HIPAA PRIVACY MASK ACTIVE</span>
          <span className="text-[10px] text-slate-400 mt-0.5">Patient examination area masked</span>
        </div>
      )}

      {/* Live Stream Telemetry HUD Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-20 pointer-events-none">
        {isWebRtcLive ? (
          <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold flex items-center gap-0.5">
              <Zap className="w-3 h-3 text-emerald-400" />
              WHEP ({metrics.latencyMs || '<150'}ms)
            </span>
            <span className="text-slate-400 font-semibold">{metrics.fps} FPS</span>
          </div>
        ) : metrics.connectionState === 'connecting' ? (
          <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-indigo-500/40 text-[10px] font-mono text-indigo-300">
            <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
            <span>Connecting WHEP...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-2 py-0.5 rounded-md border border-amber-500/40 text-[10px] font-mono text-amber-300">
            <Radio className="w-2.5 h-2.5 text-amber-400" />
            <span>SYNTHETIC HUD</span>
            <span className="text-slate-400">{camera.fps} FPS</span>
          </div>
        )}
      </div>

      {/* Dynamic Feedback Banner */}
      {ptzFeedback && (
        <div className="absolute top-2 right-2 bg-indigo-950/90 text-indigo-200 border border-indigo-500/50 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold shadow-lg z-20 animate-in fade-in zoom-in-95 pointer-events-none">
          {ptzFeedback}
        </div>
      )}

      {/* Interactive PTZ Directional Overlay Controls */}
      {showPtzOverlay && (camera.hasPtz || isExpanded) && (
        <div className="absolute bottom-2 right-2 z-20 flex flex-col items-end gap-1.5">
          {/* Collapsible Control Panel */}
          {showPtzControls && (
            <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/80 p-2 rounded-2xl shadow-2xl flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2">
              <div className="w-full flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                <span className="flex items-center gap-1">
                  <Sliders className="w-2.5 h-2.5 text-indigo-400" /> Optical PTZ
                </span>
                <span className="font-mono text-indigo-300">{ptzState.zoom}×</span>
              </div>

              {/* D-Pad Buttons */}
              <div className="grid grid-cols-3 gap-0.5">
                <div />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('UP')}
                  className="w-7 h-7 text-white hover:bg-indigo-600 rounded-md"
                  title="Tilt Up"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <div />

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('LEFT')}
                  className="w-7 h-7 text-white hover:bg-indigo-600 rounded-md"
                  title="Pan Left"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('RESET')}
                  className="w-7 h-7 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md"
                  title="Reset to Home Position"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('RIGHT')}
                  className="w-7 h-7 text-white hover:bg-indigo-600 rounded-md"
                  title="Pan Right"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>

                <div />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('DOWN')}
                  className="w-7 h-7 text-white hover:bg-indigo-600 rounded-md"
                  title="Tilt Down"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <div />
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 pt-1 border-t border-slate-800 w-full justify-center">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('ZOOM_OUT')}
                  disabled={ptzState.zoom <= 1.0}
                  className="w-6 h-6 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3 h-3" />
                </Button>
                <span className="font-mono text-[9px] text-slate-300 w-8 text-center">{ptzState.zoom}x</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handlePtzAction('ZOOM_IN')}
                  disabled={ptzState.zoom >= 30.0}
                  className="w-6 h-6 text-slate-300 hover:text-white hover:bg-slate-800 rounded"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3 h-3" />
                </Button>
              </div>

              {/* Clinical Presets */}
              <div className="flex items-center gap-1 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handlePtzAction('PRESET_1')}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-indigo-600 text-[9px] font-bold text-slate-200 rounded border border-slate-800"
                  title={HOSPITAL_PTZ_PRESETS.PRESET_1.presetName}
                >
                  P1:Bed
                </button>
                <button
                  type="button"
                  onClick={() => handlePtzAction('PRESET_2')}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-indigo-600 text-[9px] font-bold text-slate-200 rounded border border-slate-800"
                  title={HOSPITAL_PTZ_PRESETS.PRESET_2.presetName}
                >
                  P2:Door
                </button>
                <button
                  type="button"
                  onClick={() => handlePtzAction('PRESET_3')}
                  className="px-1.5 py-0.5 bg-slate-900 hover:bg-indigo-600 text-[9px] font-bold text-slate-200 rounded border border-slate-800"
                  title={HOSPITAL_PTZ_PRESETS.PRESET_3.presetName}
                >
                  P3:Rack
                </button>
              </div>
            </div>
          )}

          {/* Toggle Overlay Button & Bottom Quick Actions */}
          <div className="flex items-center gap-1 bg-slate-950/80 backdrop-blur-md p-1 rounded-xl border border-slate-800">
            {isWebRtcLive && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsMuted(!isMuted)}
                className="w-6 h-6 text-slate-300 hover:text-white rounded"
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={handleCaptureSnapshot}
              className="w-6 h-6 text-slate-300 hover:text-white rounded"
              title="Snapshot Frame"
            >
              <Camera className="w-3 h-3" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowPtzControls(!showPtzControls)}
              className={`w-6 h-6 rounded ${
                showPtzControls ? 'text-indigo-400 bg-indigo-950/50' : 'text-slate-400 hover:text-white'
              }`}
              title={showPtzControls ? 'Hide PTZ Controls' : 'Show PTZ Controls'}
            >
              <Sliders className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
