"use client";
import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
};

/** Non-empty tuple, so indexing modulo its length always yields a string. */
const COLORS = ["#00D4FF", "#7B2FBE", "#4A90D9", "#00D4FF88"] as const;

const MAX_PARTICLES = 80;
const SPAWN_EVERY_N_FRAMES = 4;
const FADE_PORTION = 0.2;

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length) % COLORS.length]!;
}

/** Eases opacity in over the first 20% of life and out over the last 20%. */
function opacityForProgress(progress: number): number {
  if (progress < FADE_PORTION) return progress / FADE_PORTION;
  if (progress > 1 - FADE_PORTION) return (1 - progress) / FADE_PORTION;
  return 1;
}

export function ShadowParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: Particle[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = () => {
      if (particles.length > MAX_PARTICLES) return;
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        size: 1 + Math.random() * 2.5,
        speedX: (Math.random() - 0.5) * 0.6,
        speedY: -(0.4 + Math.random() * 1.2),
        opacity: 0,
        color: pickColor(),
        life: 0,
        maxLife: 120 + Math.random() * 180,
      });
    };

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      if (frame % SPAWN_EVERY_N_FRAMES === 0) spawn();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (!p) continue;

        p.life++;
        p.x += p.speedX;
        p.y += p.speedY;
        p.opacity = opacityForProgress(p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = p.opacity * 0.7;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife) particles.splice(i, 1);
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
