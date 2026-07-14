import { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
}

interface Spark {
  points: { x: number; y: number }[];
  life: number; maxLife: number; width: number;
}

export default function LightningBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const particles: Particle[] = [];
    const sparks: Spark[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const randBetween = (a: number, b: number) => a + Math.random() * (b - a);

    const spawnParticle = () => {
      particles.push({
        x: randBetween(0, canvas.width),
        y: randBetween(0, canvas.height),
        vx: randBetween(-0.3, 0.3),
        vy: randBetween(-0.6, -0.1),
        life: 0,
        maxLife: randBetween(80, 180),
        size: randBetween(1, 2.5),
      });
    };

    const buildLightning = (x1: number, y1: number, x2: number, y2: number, roughness = 6): { x: number; y: number }[] => {
      if (Math.hypot(x2 - x1, y2 - y1) < 8) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
      const mx = (x1 + x2) / 2 + randBetween(-roughness, roughness);
      const my = (y1 + y2) / 2 + randBetween(-roughness, roughness);
      return [
        ...buildLightning(x1, y1, mx, my, roughness * 0.6),
        ...buildLightning(mx, my, x2, y2, roughness * 0.6),
      ];
    };

    const spawnSpark = () => {
      const x = randBetween(50, canvas.width - 50);
      const y = randBetween(canvas.height * 0.1, canvas.height * 0.6);
      const targetY = y + randBetween(80, 220);
      sparks.push({
        points: buildLightning(x, y, x + randBetween(-30, 30), targetY, 18),
        life: 0,
        maxLife: randBetween(18, 36),
        width: randBetween(0.5, 1.5),
      });
    };

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // dim background gradient
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
      );
      grad.addColorStop(0, "rgba(30,22,0,0.15)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // spawn
      if (frame % 3 === 0 && particles.length < 80) spawnParticle();
      if (frame % 55 === 0) spawnSpark();

      // draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,197,66,${alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#f5c542";
        ctx.fill();
        ctx.shadowBlur = 0;
        if (p.life >= p.maxLife) particles.splice(i, 1);
      }

      // draw sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++;
        const alpha = (1 - s.life / s.maxLife) * 0.7;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (const pt of s.points.slice(1)) ctx.lineTo(pt.x, pt.y);
        ctx.strokeStyle = `rgba(255,230,100,${alpha})`;
        ctx.lineWidth = s.width;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#fbbf24";
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (s.life >= s.maxLife) sparks.splice(i, 1);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed", inset: 0, zIndex: 0,
        pointerEvents: "none", opacity: 0.6,
      }}
    />
  );
}
