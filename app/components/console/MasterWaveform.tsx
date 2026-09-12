"use client";

import { useEffect, useRef } from "react";
import { mulberry32 } from "@/lib/hash";
import type { Side } from "../types";

type MasterWaveformProps = {
  seed: number;
  chaos: number;
  playhead: number;
  duration: number;
  playing: boolean;
  accent?: "orange" | Side;
  height?: number;
};

const SAMPLES = 200;

function amps(seed: number, chaos: number): number[] {
  const rand = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    out.push(0.15 + rand() * (0.35 + chaos * 0.5));
  }
  return out;
}

export function MasterWaveform({
  seed,
  chaos,
  playhead,
  duration,
  playing,
  accent = "orange",
  height = 40,
}: MasterWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ampRef = useRef<number[]>([]);
  const lastIdx = useRef(-1);

  useEffect(() => {
    ampRef.current = amps(seed, chaos);
    lastIdx.current = -1;
  }, [seed, chaos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const span = duration > 0 ? duration : 1;
    const idx = Math.floor((playhead / span) * SAMPLES);
    if (idx === lastIdx.current && lastIdx.current !== -1) return;
    lastIdx.current = idx;

    const parent = canvas.parentElement;
    const cssW = parent?.clientWidth || canvas.clientWidth || 400;
    const cssH = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const styles = getComputedStyle(document.documentElement);
    const token = accent === "hype" ? "--hype" : accent === "diss" ? "--diss" : "--orange";
    const live = styles.getPropertyValue(token).trim();
    const idle = styles.getPropertyValue("--border-mid").trim();
    const split = playhead / span;
    const data = ampRef.current.length ? ampRef.current : amps(seed, chaos);
    const gap = cssW / SAMPLES;

    for (let i = 0; i < SAMPLES; i++) {
      const h = data[i] * cssH;
      const x = i * gap + 0.5;
      const y = (cssH - h) / 2;
      ctx.strokeStyle = i / SAMPLES < split ? live : idle;
      ctx.globalAlpha = i / SAMPLES < split ? 0.85 : 1;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [seed, chaos, playhead, duration, playing, accent, height]);

  return <canvas ref={canvasRef} className="master-waveform" height={height} />;
}
