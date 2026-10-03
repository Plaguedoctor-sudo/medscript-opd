'use client';

import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  CctvCamera,
  CctvIncident,
  CctvZone,
  CctvCameraStatus,
  UserRole,
} from '@/types';
import {
  addOrUpdateCamera,
  deleteCamera,
  flagCctvIncident,
  acknowledgeCctvIncident,
  togglePrivacyMask,
  sendPtzCommand,
  getRtspBridgeStatusAction,
  scanOnvifCamerasAction,
  testRtspStreamAction,
  exportBridgeConfigAction,
  CctvStats,
} from '@/app/cctv/actions';
import { OnvifDiscoveredDevice, RtspBridgeStatus, RtspStreamProbeResult } from '@/lib/cctv/rtsp-bridge';
import { CctvWebRtcPlayer } from './CctvWebRtcPlayer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Cctv,
  Video,
  Camera,
  Eye,
  EyeOff,
  Maximize2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Radio,
  Sliders,
  Plus,
  CheckCircle2,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LayoutGrid,
  Tv,
  Trash2,
  Edit,
  Loader2,
  Sparkles,
  Network,
  Download,
  Wifi,
  Check,
  HardDrive,
} from 'lucide-react';
import { CctvStorageManager } from './CctvStorageManager';

interface HospitalCctvCommandCenterProps {
  initialCameras: CctvCamera[];
  initialIncidents: CctvIncident[];
  stats: CctvStats;
  currentUserRole: UserRole;
  currentUserName?: string;
}

export function HospitalCctvCommandCenter({
  initialCameras,
  initialIncidents,
  stats: initialStats,
  currentUserRole,
  currentUserName,
}: HospitalCctvCommandCenterProps) {
  const [cameras, setCameras] = useState<CctvCamera[]>(initialCameras);
  const [incidents, setIncidents] = useState<CctvIncident[]>(initialIncidents);
  const [stats, setStats] = useState<CctvStats>(initialStats);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [gridLayout, setGridLayout] = useState<'1x1' | '2x2' | '3x3' | 'ALL'>('2x2');
  const [activeTab, setActiveTab] = useState<'live' | 'incidents' | 'storage' | 'settings'>('live');

  // PTZ & Focus Modal
  const [focusedCamera, setFocusedCamera] = useState<CctvCamera | null>(null);
  const [ptzMessage, setPtzMessage] = useState<string | null>(null);

  // Add / Edit Camera Modal
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CctvCamera | null>(null);
  const [camName, setCamName] = useState('');
  const [camZone, setCamZone] = useState<CctvZone>('ICU');
  const [camLocation, setCamLocation] = useState('');
  const [camStreamUrl, setCamStreamUrl] = useState('simulated:icu');
  const [camStatus, setCamStatus] = useState<CctvCameraStatus>('ONLINE');
  const [camResolution, setCamResolution] = useState('1080p');
  const [camFps, setCamFps] = useState(25);
  const [camHasPtz, setCamHasPtz] = useState(false);
  const [camPrivacy, setCamPrivacy] = useState(false);
  const [camIp, setCamIp] = useState('');

  // Acknowledge Incident Modal
  const [ackIncident, setAckIncident] = useState<CctvIncident | null>(null);
  const [ackNotes, setAckNotes] = useState('');

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // RTSP Bridge & ONVIF Modal
  const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<RtspBridgeStatus | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<OnvifDiscoveredDevice[]>([]);
  const [isScanningOnvif, setIsScanningOnvif] = useState(false);
  const [probeResult, setProbeResult] = useState<RtspStreamProbeResult | null>(null);
  const [isProbingStream, setIsProbingStream] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      try {
        const status = await getRtspBridgeStatusAction();
        setBridgeStatus(status);
      } catch {}
    });
  }, []);

  const canManage = currentUserRole === 'admin_doctor' || currentUserRole === 'doctor' || currentUserRole === 'manager';

  const handleOpenBridgeModal = () => {
    setIsBridgeModalOpen(true);
    startTransition(async () => {
      const status = await getRtspBridgeStatusAction();
      setBridgeStatus(status);
    });
  };

  const handleScanOnvif = () => {
    setIsScanningOnvif(true);
    startTransition(async () => {
      const res = await scanOnvifCamerasAction();
      if (res.success) {
        setDiscoveredDevices(res.devices);
      }
      setIsScanningOnvif(false);
    });
  };

  const handleSelectDiscoveredCamera = (device: OnvifDiscoveredDevice) => {
    setEditingCamera(null);
    setCamName(device.name || `Camera @ ${device.ip}`);
    setCamZone(device.suggestedZone || 'IPD_WARD');
    setCamLocation(`LAN Host ${device.ip}`);
    setCamStreamUrl(device.suggestedStreamUrl);
    setCamIp(device.ip);
    setCamStatus('ONLINE');
    setCamResolution('1080p');
    setCamFps(25);
    setCamHasPtz(true);
    setCamPrivacy(false);
    setIsBridgeModalOpen(false);
    setIsCameraModalOpen(true);
  };

  const handleTestStream = (url: string) => {
    setIsProbingStream(true);
    setProbeResult(null);
    startTransition(async () => {
      const res = await testRtspStreamAction(url);
      setProbeResult(res);
      setIsProbingStream(false);
    });
  };

  const handleDownloadBridgeConfig = async (type: 'go2rtc' | 'mediamtx') => {
    const res = await exportBridgeConfigAction(type);
    const blob = new Blob([res.content], { type: res.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter cameras by zone
  const filteredCameras = cameras.filter((cam) => {
    if (selectedZone === 'ALL') return true;
    return cam.zone === selectedZone;
  });

  const handleOpenAddCamera = () => {
    setEditingCamera(null);
    setCamName('');
    setCamZone('ICU');
    setCamLocation('Floor 2 - Critical Care Tower');
    setCamStreamUrl('simulated:icu');
    setCamStatus('ONLINE');
    setCamResolution('1080p');
    setCamFps(25);
    setCamHasPtz(true);
    setCamPrivacy(false);
    setCamIp('192.168.1.' + Math.floor(Math.random() * 50 + 200));
    setIsCameraModalOpen(true);
  };

  const handleOpenEditCamera = (cam: CctvCamera) => {
    setEditingCamera(cam);
    setCamName(cam.name);
    setCamZone(cam.zone);
    setCamLocation(cam.location || '');
    setCamStreamUrl(cam.streamUrl);
    setCamStatus(cam.status);
    setCamResolution(cam.resolution);
    setCamFps(cam.fps);
    setCamHasPtz(cam.hasPtz);
    setCamPrivacy(cam.privacyMasking);
    setCamIp(cam.ipAddress || '');
    setIsCameraModalOpen(true);
  };

  const handleSaveCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (!camName.trim()) {
      setFeedback({ type: 'error', message: 'Camera name is required.' });
      return;
    }

    startTransition(async () => {
      const res = await addOrUpdateCamera({
        id: editingCamera ? editingCamera.id : undefined,
        name: camName,
        zone: camZone,
        location: camLocation,
        streamUrl: camStreamUrl,
        status: camStatus,
        resolution: camResolution,
        fps: Number(camFps) || 25,
        hasPtz: camHasPtz,
        privacyMasking: camPrivacy,
        motionDetectionEnabled: true,
        ipAddress: camIp,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `Camera '${camName}' saved successfully.` });
        setIsCameraModalOpen(false);
        // Refresh local state
        setCameras((prev) => {
          if (editingCamera) {
            return prev.map((c) =>
              c.id === editingCamera.id
                ? {
                    ...c,
                    name: camName,
                    zone: camZone,
                    location: camLocation,
                    streamUrl: camStreamUrl,
                    status: camStatus,
                    resolution: camResolution,
                    fps: camFps,
                    hasPtz: camHasPtz,
                    privacyMasking: camPrivacy,
                    ipAddress: camIp,
                  }
                : c
            );
          } else {
            return [
              ...prev,
              {
                id: Date.now(),
                name: camName,
                zone: camZone,
                location: camLocation,
                streamUrl: camStreamUrl,
                status: camStatus,
                resolution: camResolution,
                fps: camFps,
                hasPtz: camHasPtz,
                privacyMasking: camPrivacy,
                motionDetectionEnabled: true,
                ipAddress: camIp,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ];
          }
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to save camera.' });
      }
    });
  };

  const handleDeleteCamera = (id: number) => {
    if (!confirm('Are you sure you want to decommission this CCTV camera?')) return;

    startTransition(async () => {
      const res = await deleteCamera(id);
      if (res.success) {
        setCameras((prev) => prev.filter((c) => c.id !== id));
        if (focusedCamera?.id === id) setFocusedCamera(null);
        setFeedback({ type: 'success', message: 'CCTV camera decommissioned.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to delete camera.' });
      }
    });
  };

  const handleTogglePrivacy = (cam: CctvCamera) => {
    const nextState = !cam.privacyMasking;
    startTransition(async () => {
      await togglePrivacyMask(cam.id, nextState);
      setCameras((prev) =>
        prev.map((c) => (c.id === cam.id ? { ...c, privacyMasking: nextState } : c))
      );
      if (focusedCamera?.id === cam.id) {
        setFocusedCamera((prev) => (prev ? { ...prev, privacyMasking: nextState } : null));
      }
    });
  };

  const handleCaptureSnapshot = (cam: CctvCamera) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cctv-snapshot-${cam.zone.toLowerCase()}-${cam.id}-${timestamp}.png`;

    // Attempt canvas screenshot
    const canvas = document.getElementById(`cctv-canvas-${cam.id}`) as HTMLCanvasElement | null;
    let dataUrl = '';
    if (canvas) {
      try {
        dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
      } catch {
        // cross-origin canvas fallback
      }
    }

    startTransition(async () => {
      const res = await flagCctvIncident({
        cameraId: cam.id,
        cameraName: cam.name,
        zone: cam.zone,
        incidentType: 'MANUAL_SECURITY_FLAG',
        severity: 'LOW',
        description: `Manual security snapshot recorded at ${cam.name}. Verified by staff.`,
        snapshotUrl: dataUrl ? dataUrl.slice(0, 500) : undefined,
      });

      if (res.success) {
        setFeedback({ type: 'success', message: `Snapshot saved and logged as evidence #${res.incidentId}.` });
        setIncidents((prev) => [
          {
            id: res.incidentId || Date.now(),
            cameraId: cam.id,
            cameraName: cam.name,
            zone: cam.zone,
            incidentType: 'MANUAL_SECURITY_FLAG',
            severity: 'LOW',
            description: `Manual security snapshot recorded at ${cam.name}.`,
            snapshotUrl: null,
            acknowledged: true,
            acknowledgedBy: currentUserName || currentUserRole,
            acknowledgedAt: new Date(),
            notes: 'Captured by operator.',
            createdAt: new Date(),
          },
          ...prev,
        ]);
      }
    });
  };

  const handleSimulateAlert = (cam: CctvCamera, type: 'PATIENT_FALL_RISK' | 'UNAUTHORIZED_ENTRY') => {
    startTransition(async () => {
      const desc =
        type === 'PATIENT_FALL_RISK'
          ? `AI Vision Sentinel: Rapid posture change & fall risk detected in ${cam.location || cam.name}.`
          : `Restricted Access Sentinel: Motion threshold exceeded in restricted perimeter zone (${cam.name}).`;

      const res = await flagCctvIncident({
        cameraId: cam.id,
        cameraName: cam.name,
        zone: cam.zone,
        incidentType: type,
        severity: type === 'PATIENT_FALL_RISK' ? 'CRITICAL' : 'HIGH',
        description: desc,
      });

      if (res.success) {
        setFeedback({
          type: 'error',
          message: `🚨 ALERT FLAGGED: ${type === 'PATIENT_FALL_RISK' ? 'Critical Patient Fall Alarm' : 'Security Breach Alert'}!`,
        });
        setIncidents((prev) => [
          {
            id: res.incidentId || Date.now(),
            cameraId: cam.id,
            cameraName: cam.name,
            zone: cam.zone,
            incidentType: type,
            severity: type === 'PATIENT_FALL_RISK' ? 'CRITICAL' : 'HIGH',
            description: desc,
            acknowledged: false,
            createdAt: new Date(),
          },
          ...prev,
        ]);
        setStats((prev) => ({
          ...prev,
          unacknowledgedIncidents: prev.unacknowledgedIncidents + 1,
          criticalAlerts: prev.criticalAlerts + 1,
        }));
      }
    });
  };

  const handleAcknowledgeIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ackIncident) return;

    startTransition(async () => {
      const res = await acknowledgeCctvIncident(ackIncident.id, ackNotes);
      if (res.success) {
        setIncidents((prev) =>
          prev.map((inc) =>
            inc.id === ackIncident.id
              ? {
                  ...inc,
                  acknowledged: true,
                  acknowledgedBy: currentUserName ? `${currentUserName} (${currentUserRole})` : currentUserRole,
                  acknowledgedAt: new Date(),
                  notes: ackNotes,
                }
              : inc
          )
        );
        setStats((prev) => ({
          ...prev,
          unacknowledgedIncidents: Math.max(0, prev.unacknowledgedIncidents - 1),
          criticalAlerts: ackIncident.severity === 'CRITICAL' ? Math.max(0, prev.criticalAlerts - 1) : prev.criticalAlerts,
        }));
        setAckIncident(null);
        setFeedback({ type: 'success', message: 'Security incident acknowledged and closed.' });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Failed to acknowledge incident.' });
      }
    });
  };

  const handlePtz = (command: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'ZOOM_IN' | 'ZOOM_OUT' | 'RESET' | 'PRESET_1' | 'PRESET_2') => {
    if (!focusedCamera) return;
    setPtzMessage(`PTZ: ${command}`);
    setTimeout(() => setPtzMessage(null), 1500);

    startTransition(async () => {
      await sendPtzCommand(focusedCamera.id, command);
    });
  };

  const getZoneBadgeColor = (zone: string) => {
    switch (zone) {
      case 'ICU':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'EMERGENCY':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'OT':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'PHARMACY':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'IPD_WARD':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'OPD_RECEPTION':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'STORES_ASSETS':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Surveillance HUD */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Live CCTV Security & Patient Safety Grid
              </span>
              <span className="text-xs text-slate-400">Offline Hospital Command Terminal</span>
              {currentUserName && (
                <span className="text-xs text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  Operator: {currentUserName} ({currentUserRole})
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mt-1.5 flex items-center gap-2.5">
              <Cctv className="w-6 h-6 text-indigo-400" />
              Hospital CCTV Surveillance & Multi-Zone Command Center
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Real-time video surveillance for ICU beds, Emergency bay, Operation Theatres, Pharmacy vaults, and Inpatient corridors. Enforces HIPAA/DISHA patient privacy masking, fall detection monitoring, and PTZ camera control.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {canManage && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenBridgeModal}
                  className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700 text-xs font-semibold"
                >
                  <Network className="w-3.5 h-3.5 text-indigo-400" />
                  ONVIF & RTSP Bridge
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenAddCamera}
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add IP Camera
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab(activeTab === 'storage' ? 'live' : 'storage')}
              className={`gap-1.5 text-xs font-semibold ${
                activeTab === 'storage'
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              NVR Storage & Archive
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab(activeTab === 'incidents' ? 'live' : 'incidents')}
              className={`gap-1.5 text-xs relative ${
                activeTab === 'incidents'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-md'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Incidents
              {stats.unacknowledgedIncidents > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-black">
                  {stats.unacknowledgedIncidents}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Real-time Status KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800">
          <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Active Cameras</div>
              <div className="text-2xl font-mono font-black text-emerald-400 mt-0.5">
                {stats.onlineCameras} <span className="text-xs text-slate-500 font-normal">/ {stats.totalCameras} online</span>
              </div>
            </div>
            <Video className="w-6 h-6 text-emerald-400/50" />
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Surveillance Zones</div>
              <div className="text-2xl font-mono font-black text-indigo-400 mt-0.5">7 Units</div>
            </div>
            <Radio className="w-6 h-6 text-indigo-400/50" />
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Unresolved Alerts</div>
              <div className="text-2xl font-mono font-black text-amber-400 mt-0.5">{stats.unacknowledgedIncidents}</div>
            </div>
            <Clock className="w-6 h-6 text-amber-400/50" />
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Patient Dignity Masking</div>
              <div className="text-2xl font-mono font-black text-cyan-400 mt-0.5">HIPAA Active</div>
            </div>
            <ShieldCheck className="w-6 h-6 text-cyan-400/50" />
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
      )}

      {/* Live Stream Surveillance Grid & Control Strip */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          {/* Control Strip: Layout Selector & Zone Chips */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Radio className="w-3.5 h-3.5" /> Zone:
              </span>
              {[
                { id: 'ALL', label: 'All Zones' },
                { id: 'ICU', label: 'ICU & Critical' },
                { id: 'EMERGENCY', label: 'Emergency' },
                { id: 'OT', label: 'OT Complex' },
                { id: 'IPD_WARD', label: 'IPD Wards' },
                { id: 'PHARMACY', label: 'Pharmacy Vault' },
                { id: 'OPD_RECEPTION', label: 'Reception & Queue' },
                { id: 'STORES_ASSETS', label: 'Stores' },
              ].map((z) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedZone(z.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    selectedZone === z.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {z.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5" /> Layout:
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setGridLayout('1x1')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    gridLayout === '1x1' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="1x1 Solo Focus"
                >
                  1×1
                </button>
                <button
                  onClick={() => setGridLayout('2x2')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    gridLayout === '2x2' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="2x2 Quad View"
                >
                  2×2
                </button>
                <button
                  onClick={() => setGridLayout('3x3')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    gridLayout === '3x3' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="3x3 Multi-View"
                >
                  3×3
                </button>
                <button
                  onClick={() => setGridLayout('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    gridLayout === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="All Feeds Wall"
                >
                  Wall
                </button>
              </div>
            </div>
          </div>

          {/* Camera Grid Tiles */}
        <div>
          {filteredCameras.length === 0 ? (
            <div className="bg-slate-900 rounded-3xl p-12 text-center text-slate-400 border border-slate-800">
              <Cctv className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Cameras in Selected Zone</h3>
              <p className="text-xs text-slate-400 mt-1">Select &apos;All Zones&apos; or add a new IP camera to start streaming.</p>
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                gridLayout === '1x1'
                  ? 'grid-cols-1'
                  : gridLayout === '2x2'
                  ? 'grid-cols-1 md:grid-cols-2'
                  : gridLayout === '3x3'
                  ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              }`}
            >
              {filteredCameras.map((cam) => (
                <CctvCameraTile
                  key={cam.id}
                  camera={cam}
                  onFocus={() => setFocusedCamera(cam)}
                  onTogglePrivacy={() => handleTogglePrivacy(cam)}
                  onSnapshot={() => handleCaptureSnapshot(cam)}
                  onSimulateAlert={(type) => handleSimulateAlert(cam, type)}
                  onEdit={() => handleOpenEditCamera(cam)}
                  onDelete={() => handleDeleteCamera(cam.id)}
                  canManage={canManage}
                  getZoneBadgeColor={getZoneBadgeColor}
                  bridgeUrl={bridgeStatus?.bridgeUrl}
                  gatewayType={bridgeStatus?.gatewayType}
                />
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {/* Security Incidents & Alert Logs Tab */}
      {activeTab === 'incidents' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                CCTV Security, Fall Detection & Patient Safety Incidents
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Timestamped incident logs triggered automatically by AI video sentinel rules or manual staff observation.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('live')}
              className="text-xs gap-1.5"
            >
              <Tv className="w-3.5 h-3.5" /> Return to Live Grid
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {incidents.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">All Clear</p>
                <p className="text-xs text-slate-500">No CCTV incidents or patient safety alerts recorded.</p>
              </div>
            ) : (
              incidents.map((inc) => (
                <div
                  key={inc.id}
                  className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !inc.acknowledged ? 'bg-amber-50/50 -mx-4 px-4 rounded-xl' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : inc.severity === 'HIGH'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{inc.cameraName}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getZoneBadgeColor(inc.zone)}`}>
                        {inc.zone}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {inc.createdAt ? new Date(inc.createdAt).toLocaleString('en-IN') : 'Just now'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium">{inc.description}</p>

                    {inc.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-white/80 p-1.5 rounded border border-slate-200 inline-block">
                        Resolution: {inc.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {inc.acknowledged ? (
                      <div className="text-right">
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged
                        </span>
                        {inc.acknowledgedBy && (
                          <span className="text-[10px] text-slate-400 block">{inc.acknowledgedBy}</span>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAckIncident(inc);
                          setAckNotes('');
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" /> Acknowledge Alert
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* NVR Storage, Footage Archive & Evidence Vault Tab */}
      {activeTab === 'storage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('live')}
              className="text-xs gap-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700"
            >
              <Tv className="w-3.5 h-3.5" /> Return to Live Camera Grid
            </Button>
          </div>
          <CctvStorageManager
            currentUserRole={currentUserRole}
            currentUserName={currentUserName}
            getZoneBadgeColor={getZoneBadgeColor}
          />
        </div>
      )}

      {/* Focus & PTZ Controller Modal */}
      {focusedCamera && (
        <Dialog open={Boolean(focusedCamera)} onOpenChange={(open) => !open && setFocusedCamera(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-950 text-white border-slate-800">
            <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between">
              <div>
                <DialogTitle className="text-base font-black text-white flex items-center gap-2">
                  <Cctv className="w-5 h-5 text-indigo-400" />
                  {focusedCamera.name} • Live Focus Inspector
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {focusedCamera.location} • {focusedCamera.resolution} @ {focusedCamera.fps} FPS • Zone: {focusedCamera.zone}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTogglePrivacy(focusedCamera)}
                  className={`text-xs gap-1.5 border-slate-700 ${
                    focusedCamera.privacyMasking
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-slate-800 text-slate-200'
                  }`}
                >
                  {focusedCamera.privacyMasking ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {focusedCamera.privacyMasking ? 'Privacy Active' : 'Enable Privacy'}
                </Button>
              </div>
            </DialogHeader>

            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden rounded-2xl">
              <CctvWebRtcPlayer
                camera={focusedCamera}
                isExpanded={true}
                privacyMasking={focusedCamera.privacyMasking}
                showPtzOverlay={true}
                bridgeUrl={bridgeStatus?.bridgeUrl}
                gatewayType={bridgeStatus?.gatewayType}
                onSnapshot={() => handleCaptureSnapshot(focusedCamera)}
                onPtzChange={(ptz) => {
                  if (ptz.presetName) {
                    setPtzMessage(`Preset: ${ptz.presetName}`);
                  }
                }}
              />

              {ptzMessage && (
                <div className="absolute top-4 left-4 bg-black/80 px-3 py-1.5 rounded-lg border border-indigo-500/50 text-indigo-300 font-mono text-xs font-bold pointer-events-none z-30">
                  {ptzMessage}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCaptureSnapshot(focusedCamera)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> Capture Forensic Snapshot
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulateAlert(focusedCamera, 'PATIENT_FALL_RISK')}
                  className="bg-rose-950/50 text-rose-300 border-rose-800 hover:bg-rose-900 gap-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Test Fall Alarm
                </Button>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setFocusedCamera(null)} className="text-slate-400">
                Close Inspector
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add / Edit Camera Dialog */}
      {isCameraModalOpen && (
        <Dialog open={isCameraModalOpen} onOpenChange={setIsCameraModalOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleSaveCamera}>
              <DialogHeader>
                <DialogTitle className="text-sm font-bold flex items-center gap-2">
                  <Cctv className="w-4 h-4 text-indigo-600" />
                  {editingCamera ? 'Edit IP Camera Settings' : 'Add New Hospital CCTV Camera'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Configure RTSP, HLS, or simulated ONVIF clinical stream coordinates.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Camera Display Name *</Label>
                  <Input
                    value={camName}
                    onChange={(e) => setCamName(e.target.value)}
                    placeholder="e.g. ICU Bed 1-4 Bay"
                    required
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Hospital Zone *</Label>
                    <select
                      value={camZone}
                      onChange={(e) => setCamZone(e.target.value as CctvZone)}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                    >
                      <option value="ICU">ICU & Critical Care</option>
                      <option value="EMERGENCY">Emergency / Trauma</option>
                      <option value="OT">Operation Theatre (OT)</option>
                      <option value="IPD_WARD">Inpatient (IPD) Ward</option>
                      <option value="PHARMACY">Pharmacy & Drug Vault</option>
                      <option value="OPD_RECEPTION">OPD Main Reception</option>
                      <option value="STORES_ASSETS">Equipment & Stores</option>
                      <option value="PERIMETER">Perimeter & Gate</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Resolution</Label>
                    <select
                      value={camResolution}
                      onChange={(e) => setCamResolution(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                    >
                      <option value="4K">4K Ultra HD (3840×2160)</option>
                      <option value="1080p">1080p Full HD (1920×1080)</option>
                      <option value="720p">720p HD (1280×720)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Physical Location / Room</Label>
                  <Input
                    value={camLocation}
                    onChange={(e) => setCamLocation(e.target.value)}
                    placeholder="e.g. Floor 2 - Critical Care Tower"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">IP Address (LAN)</Label>
                    <Input
                      value={camIp}
                      onChange={(e) => setCamIp(e.target.value)}
                      placeholder="192.168.1.200"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Frame Rate (FPS)</Label>
                    <Input
                      type="number"
                      min={10}
                      max={60}
                      value={camFps}
                      onChange={(e) => setCamFps(Number(e.target.value))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Stream Protocol / Endpoint</Label>
                    <button
                      type="button"
                      onClick={() => handleTestStream(camStreamUrl)}
                      disabled={isProbingStream || !camStreamUrl}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                    >
                      {isProbingStream ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radio className="w-3 h-3" />}
                      Test RTSP Connection
                    </button>
                  </div>
                  <Input
                    value={camStreamUrl}
                    onChange={(e) => {
                      setCamStreamUrl(e.target.value);
                      setProbeResult(null);
                    }}
                    placeholder="rtsp://... or simulated:icu"
                    className="h-8 text-xs font-mono"
                  />
                  {probeResult && (
                    <div className={`p-2 rounded text-[11px] font-medium flex items-center justify-between ${
                      probeResult.reachable
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      <span>
                        {probeResult.reachable
                          ? `✓ Stream Reachable (${probeResult.latencyMs}ms)`
                          : `✗ Failed: ${probeResult.error || 'Connection refused'}`}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{probeResult.sanitizedUrl}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500">
                    Use `simulated:icu`, `simulated:ot`, `simulated:emergency`, or real RTSP/HLS URL.
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={camHasPtz}
                      onChange={(e) => setCamHasPtz(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">PTZ Optical Controls</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={camPrivacy}
                      onChange={(e) => setCamPrivacy(e.target.checked)}
                      className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">Privacy Mask Default</span>
                  </label>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Camera'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Acknowledge Alert Dialog */}
      {ackIncident && (
        <Dialog open={Boolean(ackIncident)} onOpenChange={(open) => !open && setAckIncident(null)}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleAcknowledgeIncident}>
              <DialogHeader>
                <DialogTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Acknowledge Incident Alert #{ackIncident.id}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {ackIncident.cameraName} ({ackIncident.zone}) • {ackIncident.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Action Taken / Resolution Notes *</Label>
                  <textarea
                    value={ackNotes}
                    onChange={(e) => setAckNotes(e.target.value)}
                    placeholder="e.g. Attended patient immediately. Assisted back to bed, vitals stable."
                    required
                    rows={3}
                    className="w-full p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAckIncident(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sign Off & Close Alert'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* RTSP Bridge & ONVIF Gateway Dialog */}
      {isBridgeModalOpen && (
        <Dialog open={isBridgeModalOpen} onOpenChange={setIsBridgeModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Network className="w-5 h-5 text-indigo-600" />
                Hospital RTSP Bridge & ONVIF Discovery
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Lightweight native RTSP gateway integration (go2rtc / MediaMTX) and local subnet camera discovery.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {/* Bridge Gateway Status */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${bridgeStatus?.online ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-xs font-bold text-slate-800">
                      Gateway Engine:{' '}
                      <span className="uppercase text-indigo-600 font-mono">
                        {bridgeStatus?.gatewayType || 'Detecting...'}
                      </span>
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    bridgeStatus?.online
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {bridgeStatus?.online ? 'ACTIVE & STREAMING' : 'OFFLINE SIMULATION'}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Bridge API Endpoint:</span>
                    <span className="font-mono text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {bridgeStatus?.bridgeUrl || 'http://127.0.0.1:1984'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">WebRTC Port:</span>
                    <span className="font-mono text-[11px] text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      UDP/TCP {bridgeStatus?.webrtcPort || 8555}
                    </span>
                  </div>
                </div>

                {/* Configuration Exporters */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-500">Auto-Generated Bridge Configs:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadBridgeConfig('go2rtc')}
                      className="text-xs gap-1.5 h-7 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                    >
                      <Download className="w-3 h-3" /> go2rtc.yaml
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadBridgeConfig('mediamtx')}
                      className="text-xs gap-1.5 h-7 text-slate-700 hover:bg-slate-100"
                    >
                      <Download className="w-3 h-3" /> mediamtx.yml
                    </Button>
                  </div>
                </div>
              </div>

              {/* ONVIF LAN Scanner */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                      ONVIF Auto-Discovery (Hospital LAN)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Probes local subnet via WS-Discovery for IP cameras and RTSP streams.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleScanOnvif}
                    disabled={isScanningOnvif}
                    className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-8"
                  >
                    {isScanningOnvif ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Radio className="w-3.5 h-3.5" />
                    )}
                    {isScanningOnvif ? 'Scanning Subnet...' : 'Scan Subnet Now'}
                  </Button>
                </div>

                {discoveredDevices.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {discoveredDevices.map((dev, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-300 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 truncate">
                              {dev.name}
                            </span>
                            {dev.suggestedZone && (
                              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${getZoneBadgeColor(dev.suggestedZone)}`}>
                                {dev.suggestedZone}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            {dev.hardware} • IP: <span className="font-mono text-slate-700">{dev.ip}:{dev.port}</span>
                          </p>
                          <p className="font-mono text-[10px] text-indigo-600 truncate">
                            {dev.suggestedStreamUrl}
                          </p>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSelectDiscoveredCamera(dev)}
                          className="shrink-0 text-xs bg-slate-900 hover:bg-indigo-600 text-white font-semibold h-7"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add to Station
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50/50">
                    Click <strong>&quot;Scan Subnet Now&quot;</strong> to discover hospital cameras on your clinic LAN.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsBridgeModalOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Sub-Component: Individual Camera Tile ────────────────────────────────────

interface CctvCameraTileProps {
  camera: CctvCamera;
  onFocus: () => void;
  onTogglePrivacy: () => void;
  onSnapshot: () => void;
  onSimulateAlert: (type: 'PATIENT_FALL_RISK' | 'UNAUTHORIZED_ENTRY') => void;
  onEdit: () => void;
  onDelete: () => void;
  canManage: boolean;
  getZoneBadgeColor: (zone: string) => string;
  bridgeUrl?: string;
  gatewayType?: 'go2rtc' | 'mediamtx' | string;
}

function CctvCameraTile({
  camera,
  onFocus,
  onTogglePrivacy,
  onSnapshot,
  onSimulateAlert,
  onEdit,
  onDelete,
  canManage,
  getZoneBadgeColor,
  bridgeUrl,
  gatewayType,
}: CctvCameraTileProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl group relative transition-all hover:border-indigo-500/60">
      {/* Tile Top HUD Header */}
      <div className="p-2.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between text-white text-xs">
        <div className="flex items-center gap-2 truncate">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-emerald-400">REC</span>
          </div>
          <span className="font-bold text-xs truncate max-w-[160px] text-slate-100" title={camera.name}>
            {camera.name}
          </span>
          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${getZoneBadgeColor(camera.zone)}`}>
            {camera.zone}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-mono text-slate-400 font-semibold">{camera.resolution}</span>
          <Button
            size="icon"
            variant="ghost"
            onClick={onFocus}
            className="w-6 h-6 text-slate-400 hover:text-white rounded"
            title="Expand / PTZ Focus"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Video Feed Canvas / WebRTC Player */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        <CctvWebRtcPlayer
          camera={camera}
          isExpanded={false}
          privacyMasking={camera.privacyMasking}
          showPtzOverlay={false}
          bridgeUrl={bridgeUrl}
          gatewayType={gatewayType}
          onSnapshot={onSnapshot}
        />

        {/* Privacy Mask Active Banner */}
        {camera.privacyMasking && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center text-center p-3 pointer-events-none">
            <ShieldCheck className="w-8 h-8 text-cyan-400 mb-1" />
            <span className="text-xs font-bold text-cyan-200">HIPAA PRIVACY MASK ACTIVE</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Patient examination area masked</span>
          </div>
        )}

        {/* Quick Action Overlay on Hover */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onTogglePrivacy}
              className={`w-7 h-7 rounded-lg ${
                camera.privacyMasking ? 'text-rose-400 hover:bg-rose-950/60' : 'text-slate-300 hover:text-white'
              }`}
              title={camera.privacyMasking ? 'Disable Privacy Mask' : 'Enable Privacy Mask'}
            >
              {camera.privacyMasking ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSnapshot}
              className="w-7 h-7 text-slate-300 hover:text-white rounded-lg"
              title="Capture Snapshot Evidence"
            >
              <Camera className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onSimulateAlert(camera.zone === 'ICU' ? 'PATIENT_FALL_RISK' : 'UNAUTHORIZED_ENTRY')}
              className="w-7 h-7 text-amber-400 hover:text-amber-300 rounded-lg"
              title="Simulate Motion / Fall Alarm"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            {canManage && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onEdit}
                  className="w-7 h-7 text-slate-400 hover:text-indigo-400 rounded-lg"
                  title="Configure Camera"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onDelete}
                  className="w-7 h-7 text-slate-400 hover:text-rose-400 rounded-lg"
                  title="Decommission Camera"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sub-bar */}
      <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate max-w-[180px]">{camera.location || 'Clinical Area'}</span>
        <div className="flex items-center gap-2 font-mono">
          <span>{camera.fps} FPS</span>
          {camera.hasPtz && <span className="text-indigo-400 font-bold">PTZ</span>}
        </div>
      </div>
    </div>
  );
}

// ── Sub-Component: Canvas Live Feed Animator ─────────────────────────────────

interface CctvFeedCanvasProps {
  camera: CctvCamera;
  isExpanded: boolean;
  privacyMasking: boolean;
}

function CctvFeedCanvas({ camera, isExpanded, privacyMasking }: CctvFeedCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let tick = 0;

    const render = () => {
      tick++;
      const w = canvas.width;
      const h = canvas.height;

      // Dark medical room background with scanlines
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, w, h);

      // Grid perspective lines
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Zone-specific clinical HUD graphics
      if (camera.zone === 'ICU') {
        // Patient bed simulated wireframe
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.25, h * 0.35, w * 0.5, h * 0.45);

        // ECG Waveform running in corner
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
        // Surgical light spotlight circle
        const gradient = ctx.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.45, h * 0.4);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
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
        // Drug vault bounding box
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
        ctx.fillStyle = '#059669';
        ctx.font = '9px monospace';
        ctx.fillText('NARCOTIC SCHEDULE H VAULT • ACCESS RESTRICTED', w * 0.2, h * 0.17);
      } else if (camera.zone === 'EMERGENCY') {
        // Triage trauma bay indicator
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.strokeRect(w * 0.15, h * 0.25, w * 0.7, h * 0.5);
        ctx.fillStyle = '#f59e0b';
        ctx.font = '9px monospace';
        ctx.fillText('TRAUMA BAY 1 • AMBULANCE ACCESS G-01', w * 0.15, h * 0.22);
      }

      // Simulated motion detection tracking box (slight drift to simulate camera)
      const driftX = Math.sin(tick * 0.02) * 15;
      const driftY = Math.cos(tick * 0.02) * 8;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(w * 0.4 + driftX, h * 0.4 + driftY, 80, 60);
      ctx.setLineDash([]);

      // On-screen live timestamp
      const now = new Date();
      const timeStr = `${now.toISOString().split('T')[0]}  ${now.toTimeString().split(' ')[0]} IST`;
      ctx.fillStyle = '#ffffff';
      ctx.font = isExpanded ? '12px monospace' : '10px monospace';
      ctx.fillText(timeStr, 12, 20);

      // Camera title & IP on feed
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = isExpanded ? '11px monospace' : '9px monospace';
      ctx.fillText(`CAM-${camera.id.toString().padStart(2, '0')} [${camera.ipAddress || 'LAN-ONVIF'}]`, 12, h - 12);

      // Scanline overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
      for (let i = 0; i < h; i += 4) {
        ctx.fillRect(0, i, w, 1);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [camera, isExpanded]);

  return (
    <canvas
      id={`cctv-canvas-${camera.id}`}
      ref={canvasRef}
      width={isExpanded ? 800 : 400}
      height={isExpanded ? 450 : 225}
      className={`w-full h-full object-cover transition-all ${
        privacyMasking ? 'filter blur-md' : ''
      }`}
    />
  );
}
