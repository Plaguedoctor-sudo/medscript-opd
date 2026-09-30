'use client';

import React, { useEffect, useRef } from 'react';

interface BedsideMonitorWaveformProps {
  heartRate?: number | null;
  spo2?: number | null;
  respiratoryRate?: number | null;
  isAlarm?: boolean;
  compact?: boolean;
}

export function BedsideMonitorWaveform({
  heartRate = 75,
  spo2 = 98,
  respiratoryRate = 16,
  isAlarm = false,
  compact = false,
}: BedsideMonitorWaveformProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Handle High-DPI (Retina / 4K) displays
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = container.getBoundingClientRect();
    const displayWidth = Math.max(300, Math.floor(rect.width || (compact ? 340 : 540)));
    const displayHeight = compact ? 120 : 180;

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    ctx.scale(dpr, dpr);

    const width = displayWidth;
    const height = displayHeight;

    const ecgMidY = compact ? height * 0.45 : height * 0.36;
    const plethMidY = compact ? height * 0.85 : height * 0.74;

    let x = 0;
    const sweepSpeed = 2.2;
    const lastBeatTime = performance.now();

    // Clear background
    ctx.fillStyle = '#060c14';
    ctx.fillRect(0, 0, width, height);

    // Oscilloscope grid lines
    const drawGrid = (startX: number, endX: number) => {
      ctx.save();
      ctx.strokeStyle = '#0e1f30';
      ctx.lineWidth = 0.5;
      const gridSize = 20;

      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      for (let gx = Math.floor(startX / gridSize) * gridSize; gx <= endX; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      ctx.restore();
    };

    drawGrid(0, width);

    // Physiological ECG synthesis (Lead II)
    const getEcgOffset = (progress: number): number => {
      if (progress < 0.12) {
        return Math.sin((progress / 0.12) * Math.PI) * -8; // P-wave
      } else if (progress < 0.18) {
        return 0; // PR segment
      } else if (progress < 0.20) {
        return 5; // Q-wave
      } else if (progress < 0.24) {
        const r = (progress - 0.20) / 0.04;
        return -42 * Math.sin(r * Math.PI); // R-wave peak
      } else if (progress < 0.27) {
        const s = (progress - 0.24) / 0.03;
        return 14 * Math.sin(s * Math.PI); // S-wave
      } else if (progress < 0.36) {
        return 0; // ST segment
      } else if (progress < 0.52) {
        const t = (progress - 0.36) / 0.16;
        return Math.sin(t * Math.PI) * -12; // T-wave
      }
      return 0;
    };

    // Photoplethysmogram synthesis (SpO2)
    const getPlethOffset = (progress: number): number => {
      if (progress < 0.24) {
        const p = progress / 0.24;
        return Math.sin(p * (Math.PI / 2)) * -24; // Systolic pulse upstroke
      } else if (progress < 0.44) {
        const p = (progress - 0.24) / 0.20;
        return -24 + Math.sin(p * Math.PI) * 9; // Dicrotic notch
      } else if (progress < 0.85) {
        const p = (progress - 0.44) / 0.41;
        return -15 * (1 - p); // Diastolic decay
      }
      return 0;
    };

    const render = (currentTime: number) => {
      const currentHr = heartRate && heartRate > 0 ? heartRate : 72;
      const beatInterval = (60 / currentHr) * 1000;

      // Erase trailing head
      const eraseWidth = 16;
      ctx.fillStyle = '#060c14';
      ctx.fillRect(x, 0, eraseWidth, height);
      drawGrid(x, Math.min(width, x + eraseWidth));

      const timeSinceBeat = (currentTime - lastBeatTime) % beatInterval;
      const beatProgress = timeSinceBeat / beatInterval;

      // 1. Draw Phosphor ECG Lead II with phosphor glow
      ctx.save();
      ctx.strokeStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 4;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      const ecgY = ecgMidY + getEcgOffset(beatProgress);
      ctx.moveTo(x, ecgY);
      ctx.lineTo(x + sweepSpeed, ecgY);
      ctx.stroke();
      ctx.restore();

      // 2. Draw Cyan SpO2 Plethysmogram
      if (!compact) {
        ctx.save();
        ctx.strokeStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 3;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        const plethY = plethMidY + getPlethOffset(beatProgress);
        ctx.moveTo(x, plethY);
        ctx.lineTo(x + sweepSpeed, plethY);
        ctx.stroke();
        ctx.restore();
      }

      x += sweepSpeed;
      if (x >= width) {
        x = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [heartRate, spo2, respiratoryRate, compact]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-[#060c14] rounded-2xl overflow-hidden border transition-all duration-300 ${
        isAlarm
          ? 'border-red-500 shadow-lg shadow-red-500/25 ring-2 ring-red-500/30'
          : 'border-slate-800/90 shadow-inner'
      }`}
    >
      <canvas ref={canvasRef} className="block w-full" />

      {/* Hospital Channel Labels */}
      <div className="absolute top-2.5 left-3 flex items-center gap-2 pointer-events-none select-none">
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 backdrop-blur-xs flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
          ECG II • 1.0mV/cm
        </span>
        {!compact && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 backdrop-blur-xs">
            PLETH • SpO2
          </span>
        )}
      </div>

      {isAlarm && (
        <div className="absolute top-2.5 right-3 px-2.5 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded-md animate-pulse shadow-md flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          CRITICAL ALARM
        </div>
      )}
    </div>
  );
}
