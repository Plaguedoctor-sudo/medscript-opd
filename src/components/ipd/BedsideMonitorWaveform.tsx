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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = canvas.width;
    const height = canvas.height;

    // Split canvas vertically into Lead II ECG (top) and SpO2 Pleth (bottom)
    const ecgMidY = compact ? height * 0.45 : height * 0.35;
    const plethMidY = compact ? height * 0.85 : height * 0.75;

    let x = 0;
    const sweepSpeed = 2.0; // pixels per frame
    const lastBeatTime = performance.now();

    // Clear background initially
    ctx.fillStyle = '#060d15';
    ctx.fillRect(0, 0, width, height);

    // Draw faint oscilloscope grid lines
    const drawGrid = (startX: number, endX: number) => {
      ctx.strokeStyle = '#0d2235';
      ctx.lineWidth = 0.5;
      const gridSize = 20;

      // Horizontal lines
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let gx = Math.floor(startX / gridSize) * gridSize; gx <= endX; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
    };

    drawGrid(0, width);

    // ECG waveform synthesis function
    const getEcgOffset = (progress: number): number => {
      // progress is from 0.0 to 1.0 during a cardiac cycle
      if (progress < 0.12) {
        // P-wave
        return Math.sin((progress / 0.12) * Math.PI) * -8;
      } else if (progress < 0.18) {
        // PR segment
        return 0;
      } else if (progress < 0.20) {
        // Q-wave (small downward)
        return 5;
      } else if (progress < 0.24) {
        // R-wave (sharp spike upwards)
        const rProgress = (progress - 0.20) / 0.04;
        return -38 * Math.sin(rProgress * Math.PI);
      } else if (progress < 0.27) {
        // S-wave (sharp downward dip)
        const sProgress = (progress - 0.24) / 0.03;
        return 12 * Math.sin(sProgress * Math.PI);
      } else if (progress < 0.36) {
        // ST segment
        return 0;
      } else if (progress < 0.52) {
        // T-wave (smooth rounded upward wave)
        const tProgress = (progress - 0.36) / 0.16;
        return Math.sin(tProgress * Math.PI) * -12;
      }
      return 0; // Baseline
    };

    // SpO2 Plethysmograph waveform synthesis
    const getPlethOffset = (progress: number): number => {
      if (progress < 0.25) {
        // Systolic upstroke
        const p = progress / 0.25;
        return Math.sin(p * (Math.PI / 2)) * -22;
      } else if (progress < 0.45) {
        // Dicrotic notch
        const p = (progress - 0.25) / 0.20;
        return -22 + Math.sin(p * Math.PI) * 8;
      } else if (progress < 0.85) {
        // Diastolic runoff
        const p = (progress - 0.45) / 0.40;
        return -14 * (1 - p);
      }
      return 0;
    };

    const render = (currentTime: number) => {
      const currentHr = heartRate && heartRate > 0 ? heartRate : 72;
      const beatInterval = (60 / currentHr) * 1000; // ms per beat

      // Clear the erase bar ahead of the drawing sweep head
      const eraseWidth = 14;
      ctx.fillStyle = '#060d15';
      ctx.fillRect(x, 0, eraseWidth, height);
      drawGrid(x, Math.min(width, x + eraseWidth));

      const timeSinceBeat = (currentTime - lastBeatTime) % beatInterval;
      const beatProgress = timeSinceBeat / beatInterval;

      // 1. Draw Lead II ECG (Phosphor Green)
      const ecgY = ecgMidY + getEcgOffset(beatProgress);
      ctx.strokeStyle = '#22c55e'; // Green
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, ecgY);
      ctx.lineTo(x + sweepSpeed, ecgY);
      ctx.stroke();

      // 2. Draw SpO2 Plethysmogram (Cyan / Electric Blue)
      if (!compact) {
        const plethY = plethMidY + getPlethOffset(beatProgress);
        ctx.strokeStyle = '#06b6d4'; // Cyan
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, plethY);
        ctx.lineTo(x + sweepSpeed, plethY);
        ctx.stroke();
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
    <div className={`relative bg-[#060d15] rounded-xl overflow-hidden border ${isAlarm ? 'border-red-500 shadow-red-500/20 shadow-lg animate-pulse' : 'border-slate-800'}`}>
      <canvas
        ref={canvasRef}
        width={compact ? 320 : 540}
        height={compact ? 110 : 180}
        className="w-full h-full block"
      />
      {/* On-Screen Channel Badges */}
      <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
          ECG II • 1.0mV/cm
        </span>
        {!compact && (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
            PLETH • SpO2
          </span>
        )}
      </div>

      {isAlarm && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-wider rounded animate-bounce">
          ALARM
        </div>
      )}
    </div>
  );
}
