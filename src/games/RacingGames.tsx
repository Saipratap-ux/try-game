import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import type { GameProps } from './GameProps';
import { soundFx } from '../utils/soundFx';

// Shared Touch D-Pad for Racing Games
const RacingControls: React.FC<{
  onLeft: (down: boolean) => void;
  onRight: (down: boolean) => void;
  onUp?: (down: boolean) => void;
  onDown?: (down: boolean) => void;
  upLabel?: string;
}> = ({ onLeft, onRight, onUp, onDown, upLabel = 'Boost' }) => (
  <div className="flex items-center justify-between gap-4 w-full max-w-[380px] select-none">
    <div className="flex gap-2">
      <button
        onPointerDown={() => onLeft(true)}
        onPointerUp={() => onLeft(false)}
        onPointerLeave={() => onLeft(false)}
        className="w-16 h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white flex items-center justify-center border border-slate-600 touch-none"
        aria-label="Steer Left"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>
      <button
        onPointerDown={() => onRight(true)}
        onPointerUp={() => onRight(false)}
        onPointerLeave={() => onRight(false)}
        className="w-16 h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-white flex items-center justify-center border border-slate-600 touch-none"
        aria-label="Steer Right"
      >
        <ArrowRight className="w-6 h-6" />
      </button>
    </div>
    {(onUp || onDown) && (
      <div className="flex gap-2">
        {onUp && (
          <button
            onPointerDown={() => onUp(true)}
            onPointerUp={() => onUp(false)}
            onPointerLeave={() => onUp(false)}
            className="px-4 h-14 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm flex items-center gap-1 touch-none"
          >
            <ArrowUp className="w-4 h-4" /> {upLabel}
          </button>
        )}
        {onDown && (
          <button
            onPointerDown={() => onDown(true)}
            onPointerUp={() => onDown(false)}
            onPointerLeave={() => onDown(false)}
            className="px-4 h-14 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm flex items-center gap-1 touch-none"
          >
            <ArrowDown className="w-4 h-4" /> Rev
          </button>
        )}
      </div>
    )}
  </div>
);

// Helper: Highway/Racer Canvas Engine used cleanly with unique mechanics per mode
const HighwayCanvas: React.FC<
  GameProps & {
    mode: 'turbo' | 'endless' | 'bike' | 'traffic';
  }
> = ({ paused, onScore, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keysRef = useRef({ left: false, right: false, up: false });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [resetTick, setResetTick] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') keysRef.current.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w') keysRef.current.up = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let playerX = 180;
    const playerY = 390;
    const playerW = mode === 'bike' ? 24 : 38;
    const playerH = mode === 'bike' ? 54 : 64;
    let roadOffset = 0;
    let points = 0;
    let shieldTimer = 0;
    let dead = false;
    let spawnTimer = 0;

    interface RoadEntity {
      x: number;
      y: number;
      w: number;
      h: number;
      speed: number;
      kind: 'car' | 'coin' | 'boost' | 'shield';
      color: string;
    }
    const entities: RoadEntity[] = [];

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (paused || dead) return;

      const baseSpeed = mode === 'turbo' ? 5.2 : mode === 'bike' ? 5.8 : 4.6;
      const boost = keysRef.current.up ? 2.4 : 0;
      const worldSpeed = baseSpeed + boost + Math.min(3.5, points / 600);

      if (keysRef.current.left) playerX -= 4.8;
      if (keysRef.current.right) playerX += 4.8;
      playerX = Math.max(46, Math.min(360 - 46 - playerW, playerX));

      roadOffset = (roadOffset + worldSpeed * 2) % 48;
      if (shieldTimer > 0) shieldTimer -= 1;

      spawnTimer += 1;
      if (spawnTimer > (mode === 'traffic' ? 28 : 34)) {
        spawnTimer = 0;
        const laneCenters = [72, 144, 216, 288];
        const lx = laneCenters[Math.floor(Math.random() * laneCenters.length)];
        const roll = Math.random();
        if (roll < 0.25 && mode !== 'traffic') {
          entities.push({ x: lx - 10, y: -30, w: 20, h: 20, speed: worldSpeed, kind: 'coin', color: '#FACC15' });
        } else if (roll < 0.34 && mode === 'bike') {
          entities.push({ x: lx - 14, y: -30, w: 28, h: 28, speed: worldSpeed, kind: 'boost', color: '#38BDF8' });
        } else if (roll < 0.36 && mode === 'traffic') {
          entities.push({ x: lx - 12, y: -30, w: 24, h: 24, speed: worldSpeed, kind: 'shield', color: '#10B981' });
        } else {
          const colors = ['#EF4444', '#F59E0B', '#A855F7', '#EC4899'];
          entities.push({
            x: lx - 18,
            y: -70,
            w: 36,
            h: 62,
            speed: worldSpeed * (0.65 + Math.random() * 0.35),
            kind: 'car',
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }

      for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        e.y += e.speed;
        const hit =
          playerX < e.x + e.w &&
          playerX + playerW > e.x &&
          playerY < e.y + e.h &&
          playerY + playerH > e.y;

        if (hit) {
          if (e.kind === 'coin') {
            soundFx.match();
            points += 50;
            entities.splice(i, 1);
            continue;
          } else if (e.kind === 'boost') {
            soundFx.win();
            points += 75;
            entities.splice(i, 1);
            continue;
          } else if (e.kind === 'shield') {
            soundFx.match();
            shieldTimer = 240;
            entities.splice(i, 1);
            continue;
          } else if (shieldTimer > 0) {
            shieldTimer = 0;
            soundFx.bounce();
            entities.splice(i, 1);
            continue;
          } else {
            soundFx.hit();
            dead = true;
            setGameOver(true);
            onScore(Math.round(points), true);
            break;
          }
        }
        if (e.y > 500) {
          entities.splice(i, 1);
          if (e.kind === 'car') points += mode === 'traffic' ? 20 : 10;
        }
      }

      points += 0.25;
      setScore(Math.round(points));

      // Render Road
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, 360, 480);

      // Shoulders
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, 36, 480);
      ctx.fillRect(324, 0, 36, 480);

      // Lane stripes
      ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
      for (const lx of [108, 180, 252]) {
        for (let y = roadOffset - 48; y < 480; y += 48) {
          ctx.fillRect(lx - 2, y, 4, 24);
        }
      }

      // Entities
      for (const e of entities) {
        if (e.kind === 'coin' || e.kind === 'shield') {
          ctx.beginPath();
          ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
          ctx.fillStyle = e.color;
          ctx.fill();
        } else if (e.kind === 'boost') {
          ctx.fillStyle = e.color;
          ctx.fillRect(e.x, e.y, e.w, e.h);
        } else {
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.roundRect(e.x, e.y, e.w, e.h, 8);
          ctx.fill();
          ctx.fillStyle = '#0F172A';
          ctx.fillRect(e.x + 6, e.y + 12, e.w - 12, 14);
        }
      }

      // Player vehicle
      ctx.fillStyle = mode === 'bike' ? '#8B5CF6' : '#3B82F6';
      ctx.beginPath();
      ctx.roundRect(playerX, playerY, playerW, playerH, 8);
      ctx.fill();
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(playerX + 5, playerY + 10, playerW - 10, 14);

      if (shieldTimer > 0) {
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(playerX + playerW / 2, playerY + playerH / 2, 38, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, mode, resetTick, onScore]);

  const restart = () => {
    setGameOver(false);
    setScore(0);
    setResetTick((t) => t + 1);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Score: {score}</span>
        {gameOver && (
          <button
            onClick={restart}
            className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Play Again
          </button>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-lg">
        <canvas ref={canvasRef} width={360} height={480} className="block max-w-full h-auto" />
        {gameOver && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <h4 className="text-2xl font-bold text-white">Race Finished</h4>
            <p className="font-mono text-blue-400 text-lg">Final Score: {score}</p>
            <button onClick={restart} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold">
              Race Again
            </button>
          </div>
        )}
      </div>

      <RacingControls
        onLeft={(d) => (keysRef.current.left = d)}
        onRight={(d) => (keysRef.current.right = d)}
        onUp={(d) => (keysRef.current.up = d)}
      />
    </div>
  );
};

// 11. Turbo Car Racing
export const TurboRacingGame: React.FC<GameProps> = (props) => <HighwayCanvas {...props} mode="turbo" />;
// 12. Endless Road Runner
export const EndlessRoadGame: React.FC<GameProps> = (props) => <HighwayCanvas {...props} mode="endless" />;
// 14. Bike Racing Dash
export const BikeRacingGame: React.FC<GameProps> = (props) => <HighwayCanvas {...props} mode="bike" />;
// 15. Traffic Dodger
export const TrafficDodgeGame: React.FC<GameProps> = (props) => <HighwayCanvas {...props} mode="traffic" />;

// 13. Precision Parking Challenge
export const ParkingChallengeGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctrlRef = useRef({ left: false, right: false, up: false, down: false });
  const [status, setStatus] = useState<'playing' | 'parked' | 'crashed'>('playing');
  const [level, setLevel] = useState(1);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') ctrlRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd') ctrlRef.current.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w') ctrlRef.current.up = true;
      if (e.key === 'ArrowDown' || e.key === 's') ctrlRef.current.down = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') ctrlRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd') ctrlRef.current.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w') ctrlRef.current.up = false;
      if (e.key === 'ArrowDown' || e.key === 's') ctrlRef.current.down = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let x = 75;
    let y = 360;
    let angle = -Math.PI / 2;
    let speed = 0;
    let done = false;

    const bay = level % 2 === 1 ? { x: 255, y: 70, w: 58, h: 90 } : { x: 245, y: 200, w: 60, h: 92 };
    const obstacles = [
      { x: 165, y: 150, w: 40, h: 120 },
      { x: 35, y: 60, w: 60, h: 60 },
      { x: 255, y: 340, w: 60, h: 50 },
    ];

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (paused || done) return;

      if (ctrlRef.current.up) speed = Math.min(2.8, speed + 0.14);
      else if (ctrlRef.current.down) speed = Math.max(-1.8, speed - 0.12);
      else speed *= 0.9;

      if (Math.abs(speed) > 0.1) {
        const dir = speed >= 0 ? 1 : -1;
        if (ctrlRef.current.left) angle -= 0.045 * dir;
        if (ctrlRef.current.right) angle += 0.045 * dir;
      }

      x += Math.cos(angle) * speed;
      y += Math.sin(angle) * speed;

      // Boundary or obstacle check
      if (x < 24 || x > 336 || y < 24 || y > 396) {
        done = true;
        soundFx.hit();
        setStatus('crashed');
        return;
      }
      for (const ob of obstacles) {
        if (x > ob.x - 14 && x < ob.x + ob.w + 14 && y > ob.y - 14 && y < ob.y + ob.h + 14) {
          done = true;
          soundFx.hit();
          setStatus('crashed');
          return;
        }
      }

      // Check parked cleanly inside bay
      if (
        x > bay.x + 14 &&
        x < bay.x + bay.w - 14 &&
        y > bay.y + 18 &&
        y < bay.y + bay.h - 18 &&
        Math.abs(speed) < 0.35
      ) {
        done = true;
        soundFx.win();
        setStatus('parked');
        onScore(level * 400, true);
        return;
      }

      // Draw Lot
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, 360, 420);

      // Parking bay
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(bay.x, bay.y, bay.w, bay.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(bay.x, bay.y, bay.w, bay.h);
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PARK', bay.x + bay.w / 2, bay.y + bay.h / 2 + 4);

      // Obstacles
      ctx.fillStyle = '#F59E0B';
      for (const ob of obstacles) {
        ctx.beginPath();
        ctx.roundRect(ob.x, ob.y, ob.w, ob.h, 6);
        ctx.fill();
      }

      // Player car rotated
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.roundRect(-22, -13, 44, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(4, -9, 10, 18);
      ctx.restore();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, level, status, onScore]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Bay Level {level}</span>
        <button
          onClick={() => setStatus('playing')}
          className="px-3 py-1 rounded-lg bg-slate-800 text-white text-xs font-semibold"
        >
          Reset Car
        </button>
      </div>
      <div className="relative rounded-xl overflow-hidden border border-slate-700">
        <canvas ref={canvasRef} width={360} height={420} className="block max-w-full h-auto" />
        {status !== 'playing' && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <h4 className="text-2xl font-bold text-white">
              {status === 'parked' ? 'Cleanly Parked!' : 'Scraped a Barrier!'}
            </h4>
            <button
              onClick={() => {
                if (status === 'parked') setLevel((l) => l + 1);
                setStatus('playing');
              }}
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold"
            >
              {status === 'parked' ? 'Next Parking Bay' : 'Try Again'}
            </button>
          </div>
        )}
      </div>
      <RacingControls
        onLeft={(d) => (ctrlRef.current.left = d)}
        onRight={(d) => (ctrlRef.current.right = d)}
        onUp={(d) => (ctrlRef.current.up = d)}
        onDown={(d) => (ctrlRef.current.down = d)}
        upLabel="Drive"
      />
    </div>
  );
};
