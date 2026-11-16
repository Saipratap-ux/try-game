import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import type { GameProps } from './GameProps';
import { soundFx } from '../utils/soundFx';

// 16. Bubble Shooter
const BUBBLE_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#FACC15', '#A855F7'];

export const BubbleShooterGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [resetTick, setResetTick] = useState(0);

  const stateRef = useRef<{
    grid: (string | null)[][];
    aimAngle: number;
    shot: { x: number; y: number; vx: number; vy: number; color: string } | null;
    nextColor: string;
    points: number;
  }>({
    grid: [],
    aimAngle: -Math.PI / 2,
    shot: null,
    nextColor: BUBBLE_COLORS[0],
    points: 0,
  });

  useEffect(() => {
    const rows = 10;
    const cols = 10;
    const grid: (string | null)[][] = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, () =>
        r < 4 ? BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] : null
      )
    );
    stateRef.current = {
      grid,
      aimAngle: -Math.PI / 2,
      shot: null,
      nextColor: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
      points: 0,
    };
    setScore(0);
    setGameOver(false);
  }, [resetTick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const cellSize = 36;
    const radius = 16;

    const findCluster = (grid: (string | null)[][], sr: number, sc: number, color: string) => {
      const visited = new Set<string>();
      const stack = [[sr, sc]];
      const cluster: [number, number][] = [];
      while (stack.length > 0) {
        const [r, c] = stack.pop()!;
        const key = `${r}-${c}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (r < 0 || r >= grid.length || c < 0 || c >= 10) continue;
        if (grid[r][c] !== color) continue;
        cluster.push([r, c]);
        stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
      }
      return cluster;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused) return;

      const s = stateRef.current;
      if (s.shot) {
        s.shot.x += s.shot.vx;
        s.shot.y += s.shot.vy;
        if (s.shot.x < radius || s.shot.x > 360 - radius) {
          s.shot.vx *= -1;
          soundFx.bounce();
        }
        let landed = s.shot.y <= radius + 8;
        if (!landed) {
          for (let r = 0; r < s.grid.length; r++) {
            for (let c = 0; c < 10; c++) {
              if (!s.grid[r][c]) continue;
              const bx = c * cellSize + cellSize / 2;
              const by = r * cellSize + cellSize / 2;
              if (Math.hypot(s.shot.x - bx, s.shot.y - by) < radius * 1.85) {
                landed = true;
                break;
              }
            }
            if (landed) break;
          }
        }
        if (landed) {
          const col = Math.max(0, Math.min(9, Math.floor(s.shot.x / cellSize)));
          let row = Math.max(0, Math.min(9, Math.floor(s.shot.y / cellSize)));
          while (row < 9 && s.grid[row][col] !== null) row += 1;
          s.grid[row][col] = s.shot.color;
          const cluster = findCluster(s.grid, row, col, s.shot.color);
          if (cluster.length >= 3) {
            soundFx.match();
            for (const [cr, cc] of cluster) s.grid[cr][cc] = null;
            s.points += cluster.length * 30;
            setScore(s.points);
            onScore(s.points);
          } else {
            soundFx.click();
          }
          s.shot = null;
          if (s.grid[9].some((cell) => cell !== null)) {
            setGameOver(true);
            onScore(s.points, true);
          }
        }
      }

      // Draw
      ctx.fillStyle = '#0B1221';
      ctx.fillRect(0, 0, 360, 440);

      for (let r = 0; r < s.grid.length; r++) {
        for (let c = 0; c < 10; c++) {
          const color = s.grid[r][c];
          if (!color) continue;
          ctx.beginPath();
          ctx.arc(c * cellSize + cellSize / 2, r * cellSize + cellSize / 2, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      // Aim line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(180, 410);
      ctx.lineTo(180 + Math.cos(s.aimAngle) * 140, 410 + Math.sin(s.aimAngle) * 140);
      ctx.stroke();
      ctx.setLineDash([]);

      // Next bubble at launcher
      ctx.beginPath();
      ctx.arc(180, 410, radius, 0, Math.PI * 2);
      ctx.fillStyle = s.nextColor;
      ctx.fill();

      if (s.shot) {
        ctx.beginPath();
        ctx.arc(s.shot.x, s.shot.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = s.shot.color;
        ctx.fill();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, onScore]);

  const handlePointer = (e: React.PointerEvent<HTMLCanvasElement>, shoot: boolean) => {
    if (paused || gameOver) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 360;
    const py = ((e.clientY - rect.top) / rect.height) * 440;
    const angle = Math.atan2(Math.min(370, py) - 410, px - 180);
    stateRef.current.aimAngle = Math.max(-Math.PI + 0.2, Math.min(-0.2, angle));

    if (shoot && !stateRef.current.shot) {
      const a = stateRef.current.aimAngle;
      stateRef.current.shot = {
        x: 180,
        y: 410,
        vx: Math.cos(a) * 8.5,
        vy: Math.sin(a) * 8.5,
        color: stateRef.current.nextColor,
      };
      stateRef.current.nextColor = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Score: {score}</span>
        <button
          onClick={() => setResetTick((t) => t + 1)}
          className="px-3 py-1 rounded-lg bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={440}
        onPointerMove={(e) => handlePointer(e, false)}
        onPointerDown={(e) => handlePointer(e, true)}
        className="rounded-xl border border-slate-700 touch-none cursor-crosshair max-w-full h-auto"
      />
    </div>
  );
};

// 17. Fruit Catcher
export const FruitCatcherGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const basketXRef = useRef(150);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') basketXRef.current = Math.max(10, basketXRef.current - 28);
      if (e.key === 'ArrowRight') basketXRef.current = Math.min(280, basketXRef.current + 28);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let pts = 0;
    let hp = 3;
    let timer = 0;
    const items: { x: number; y: number; vy: number; color: string; isBomb: boolean }[] = [];

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused || hp <= 0) return;

      timer += 1;
      if (timer > 32) {
        timer = 0;
        const isBomb = Math.random() < 0.22;
        const fruitColors = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#A855F7'];
        items.push({
          x: 24 + Math.random() * 312,
          y: -16,
          vy: 2.8 + Math.min(3, pts / 200),
          color: isBomb ? '#1E293B' : fruitColors[Math.floor(Math.random() * fruitColors.length)],
          isBomb,
        });
      }

      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.vy;
        if (it.y > 395 && it.y < 430 && it.x > basketXRef.current && it.x < basketXRef.current + 72) {
          if (it.isBomb) {
            soundFx.hit();
            hp -= 1;
            setLives(hp);
            if (hp <= 0) onScore(pts, true);
          } else {
            soundFx.match();
            pts += 20;
            setScore(pts);
            onScore(pts);
          }
          items.splice(i, 1);
          continue;
        }
        if (it.y > 460) items.splice(i, 1);
      }

      ctx.fillStyle = '#0B1221';
      ctx.fillRect(0, 0, 360, 440);

      for (const it of items) {
        ctx.beginPath();
        ctx.arc(it.x, it.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = it.color;
        ctx.fill();
        if (it.isBomb) {
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      ctx.fillStyle = '#D97706';
      ctx.beginPath();
      ctx.roundRect(basketXRef.current, 404, 72, 22, 8);
      ctx.fill();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, resetTick, onScore]);

  const restart = () => {
    setScore(0);
    setLives(3);
    setResetTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Score: {score}</span>
        <span className="font-mono text-rose-500 font-semibold">Lives: {lives}</span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={360}
          height={440}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 360;
            basketXRef.current = Math.max(4, Math.min(284, x - 36));
          }}
          className="rounded-xl border border-slate-700 touch-none max-w-full h-auto"
        />
        {lives <= 0 && (
          <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center gap-3">
            <h4 className="text-2xl font-bold text-white">Game Over</h4>
            <p className="font-mono text-amber-400">Score: {score}</p>
            <button onClick={restart} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold">
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 18. Brick Breaker
export const BrickBreakerGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paddleXRef = useRef(135);
  const [score, setScore] = useState(0);
  const [ended, setEnded] = useState<'win' | 'lose' | null>(null);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') paddleXRef.current = Math.max(0, paddleXRef.current - 26);
      if (e.key === 'ArrowRight') paddleXRef.current = Math.min(276, paddleXRef.current + 26);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let bx = 180;
    let by = 320;
    let vx = 3.6;
    let vy = -3.8;
    let pts = 0;
    let over = false;

    const bricks: { x: number; y: number; w: number; h: number; hp: number; color: string }[] = [];
    const palette = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 7; c++) {
        bricks.push({ x: 12 + c * 49, y: 36 + r * 24, w: 43, h: 16, hp: 1, color: palette[r] });
      }
    }

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused || over) return;

      bx += vx;
      by += vy;
      if (bx < 8 || bx > 352) {
        vx *= -1;
        soundFx.bounce();
      }
      if (by < 8) {
        vy *= -1;
        soundFx.bounce();
      }

      // Paddle collision
      if (by > 394 && by < 410 && bx > paddleXRef.current && bx < paddleXRef.current + 84) {
        vy = -Math.abs(vy);
        const hitPos = (bx - (paddleXRef.current + 42)) / 42;
        vx = hitPos * 5.2;
        soundFx.bounce();
      }

      // Brick collision
      for (const br of bricks) {
        if (br.hp <= 0) continue;
        if (bx > br.x && bx < br.x + br.w && by > br.y && by < br.y + br.h) {
          br.hp = 0;
          vy *= -1;
          pts += 50;
          setScore(pts);
          onScore(pts);
          soundFx.match();
          break;
        }
      }

      if (bricks.every((b) => b.hp <= 0)) {
        over = true;
        soundFx.win();
        setEnded('win');
        onScore(pts + 500, true);
      } else if (by > 440) {
        over = true;
        soundFx.hit();
        setEnded('lose');
        onScore(pts, true);
      }

      ctx.fillStyle = '#080D1A';
      ctx.fillRect(0, 0, 360, 440);

      for (const br of bricks) {
        if (br.hp <= 0) continue;
        ctx.fillStyle = br.color;
        ctx.beginPath();
        ctx.roundRect(br.x, br.y, br.w, br.h, 4);
        ctx.fill();
      }

      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.roundRect(paddleXRef.current, 404, 84, 12, 6);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(bx, by, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#F8FAFC';
      ctx.fill();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, resetTick, onScore]);

  const restart = () => {
    setScore(0);
    setEnded(null);
    setResetTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Score: {score}</span>
        <button onClick={restart} className="px-3 py-1 rounded-lg bg-slate-800 text-white text-xs font-semibold">
          Reset
        </button>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={360}
          height={440}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 360;
            paddleXRef.current = Math.max(0, Math.min(276, x - 42));
          }}
          className="rounded-xl border border-slate-700 touch-none max-w-full h-auto"
        />
        {ended && (
          <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center gap-3">
            <h4 className="text-2xl font-bold text-white">{ended === 'win' ? 'Stage Cleared!' : 'Ball Missed'}</h4>
            <p className="font-mono text-blue-400">Score: {score}</p>
            <button onClick={restart} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold">
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 19. Endless Sky Jump
export const SkyJumperGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveRef = useRef({ left: false, right: false });
  const [score, setScore] = useState(0);
  const [lost, setLost] = useState(false);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') moveRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') moveRef.current.right = true;
    };
    const ku = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') moveRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') moveRef.current.right = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let px = 170;
    let py = 360;
    let vx = 0;
    let vy = -9;
    let pts = 0;
    let dead = false;

    const platforms = Array.from({ length: 8 }, (_, i) => ({
      x: 30 + Math.random() * 240,
      y: 410 - i * 56,
      w: 72,
      spring: i === 3,
    }));

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused || dead) return;

      if (moveRef.current.left) vx = -4.5;
      else if (moveRef.current.right) vx = 4.5;
      else vx *= 0.85;

      px += vx;
      if (px < -16) px = 360;
      if (px > 360) px = -16;

      vy += 0.32;
      py += vy;

      if (vy > 0) {
        for (const p of platforms) {
          if (px + 18 > p.x && px < p.x + p.w && py + 24 >= p.y && py + 24 <= p.y + 14) {
            vy = p.spring ? -13.5 : -9.4;
            soundFx.bounce();
          }
        }
      }

      if (py < 180) {
        const dy = 180 - py;
        py = 180;
        pts += Math.round(dy);
        setScore(pts);
        for (const p of platforms) {
          p.y += dy;
          if (p.y > 440) {
            p.y = -10;
            p.x = 20 + Math.random() * 260;
            p.spring = Math.random() < 0.16;
          }
        }
      }

      if (py > 460) {
        dead = true;
        soundFx.hit();
        setLost(true);
        onScore(pts, true);
      }

      ctx.fillStyle = '#0B1221';
      ctx.fillRect(0, 0, 360, 440);

      for (const p of platforms) {
        ctx.fillStyle = p.spring ? '#10B981' : '#3B82F6';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, 10, 5);
        ctx.fill();
      }

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(px + 12, py + 12, 14, 0, Math.PI * 2);
      ctx.fill();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, resetTick, onScore]);

  const restart = () => {
    setLost(false);
    setScore(0);
    setResetTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Altitude: {score}</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={360} height={440} className="rounded-xl border border-slate-700 max-w-full h-auto" />
        {lost && (
          <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center gap-3">
            <h4 className="text-2xl font-bold text-white">Fell Off!</h4>
            <p className="font-mono text-sky-400">Altitude: {score}</p>
            <button onClick={restart} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold">
              Jump Again
            </button>
          </div>
        )}
      </div>
      <div className="flex gap-4">
        <button
          onPointerDown={() => (moveRef.current.left = true)}
          onPointerUp={() => (moveRef.current.left = false)}
          onPointerLeave={() => (moveRef.current.left = false)}
          className="w-20 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-600 touch-none"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onPointerDown={() => (moveRef.current.right = true)}
          onPointerUp={() => (moveRef.current.right = false)}
          onPointerLeave={() => (moveRef.current.right = false)}
          className="w-20 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center border border-slate-600 touch-none"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// 20. Space Shooter
export const SpaceShooterGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shipXRef = useRef(165);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') shipXRef.current = Math.max(12, shipXRef.current - 22);
      if (e.key === 'ArrowRight') shipXRef.current = Math.min(318, shipXRef.current + 22);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let pts = 0;
    let frame = 0;
    let dead = false;
    const bullets: { x: number; y: number }[] = [];
    const enemies: { x: number; y: number; vy: number }[] = [];

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused || dead) return;

      frame += 1;
      if (frame % 12 === 0) {
        bullets.push({ x: shipXRef.current + 15, y: 390 });
      }
      if (frame % 32 === 0) {
        enemies.push({ x: 16 + Math.random() * 300, y: -20, vy: 2.1 + Math.min(2.5, pts / 400) });
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= 7;
        if (bullets[i].y < -10) bullets.splice(i, 1);
      }

      for (let i = enemies.length - 1; i >= 0; i--) {
        const en = enemies[i];
        en.y += en.vy;

        // Hit ship
        if (en.y > 380 && Math.abs(en.x - shipXRef.current) < 26) {
          dead = true;
          soundFx.hit();
          setOver(true);
          onScore(pts, true);
          break;
        }
        if (en.y > 450) {
          enemies.splice(i, 1);
          continue;
        }

        for (let b = bullets.length - 1; b >= 0; b--) {
          if (Math.hypot(bullets[b].x - (en.x + 12), bullets[b].y - (en.y + 12)) < 18) {
            bullets.splice(b, 1);
            enemies.splice(i, 1);
            pts += 50;
            setScore(pts);
            onScore(pts);
            soundFx.match();
            break;
          }
        }
      }

      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, 360, 440);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (let s = 0; s < 16; s++) {
        ctx.fillRect((s * 73) % 360, ((s * 97 + frame * 2) % 440), 2, 2);
      }

      ctx.fillStyle = '#38BDF8';
      for (const b of bullets) ctx.fillRect(b.x - 2, b.y, 4, 10);

      ctx.fillStyle = '#A855F7';
      for (const en of enemies) {
        ctx.beginPath();
        ctx.roundRect(en.x, en.y, 26, 22, 6);
        ctx.fill();
      }

      // Ship
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.moveTo(shipXRef.current + 15, 386);
      ctx.lineTo(shipXRef.current + 30, 418);
      ctx.lineTo(shipXRef.current, 418);
      ctx.closePath();
      ctx.fill();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, resetTick, onScore]);

  const restart = () => {
    setOver(false);
    setScore(0);
    setResetTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Score: {score}</span>
        <span className="text-xs text-slate-500">Auto-blasters active · Drag or use arrows</span>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={360}
          height={440}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 360;
            shipXRef.current = Math.max(4, Math.min(326, x - 15));
          }}
          className="rounded-xl border border-slate-700 touch-none max-w-full h-auto"
        />
        {over && (
          <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center gap-3">
            <h4 className="text-2xl font-bold text-white">Sector Overrun</h4>
            <p className="font-mono text-purple-400">Score: {score}</p>
            <button onClick={restart} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold">
              Launch Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
