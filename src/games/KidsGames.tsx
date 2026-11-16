import React, { useEffect, useRef, useState } from 'react';
import { Volume2, RotateCcw, Sparkles } from 'lucide-react';
import type { GameProps } from './GameProps';
import { soundFx } from '../utils/soundFx';

// 1. Color Match Studio
const COLORS = [
  { name: 'Red', hex: '#EF4444' },
  { name: 'Blue', hex: '#3B82F6' },
  { name: 'Yellow', hex: '#FACC15' },
  { name: 'Green', hex: '#22C55E' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Orange', hex: '#F97316' },
];

export const ColorMatchGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [target, setTarget] = useState(COLORS[0]);
  const [options, setOptions] = useState(COLORS.slice(0, 4));
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('Tap the matching color!');

  const nextRound = (currentScore: number) => {
    const shuffled = [...COLORS].sort(() => Math.random() - 0.5).slice(0, 4);
    const pick = shuffled[Math.floor(Math.random() * shuffled.length)];
    setOptions(shuffled);
    setTarget(pick);
    onScore(currentScore);
  };

  useEffect(() => {
    nextRound(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (c: typeof COLORS[number]) => {
    if (paused) return;
    if (c.name === target.name) {
      soundFx.match();
      const next = score + 10;
      setScore(next);
      setFeedback(`Great job! That is ${c.name}.`);
      setTimeout(() => nextRound(next), 450);
    } else {
      soundFx.bounce();
      setFeedback(`Try again! Find ${target.name}.`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 bg-amber-50 dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-slate-700">
      <div className="text-center">
        <p className="text-sm font-medium text-amber-900/70 dark:text-slate-400">
          Parent-assisted discovery · Score: <span className="font-mono font-bold text-slate-900 dark:text-white">{score}</span>
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl shadow-md border-4 border-white dark:border-slate-700"
            style={{ backgroundColor: target.hex }}
            aria-label={`Target color ${target.name}`}
          />
          <h3 className="text-3xl font-bold text-slate-900 dark:text-white">Find {target.name}</h3>
        </div>
        <p className="mt-2 text-base font-medium text-blue-700 dark:text-blue-300">{feedback}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        {options.map((c) => (
          <button
            key={c.name}
            onClick={() => handlePick(c)}
            disabled={paused}
            className="h-28 rounded-2xl border-4 border-white dark:border-slate-700 shadow-sm transition-transform active:scale-95 hover:scale-[1.02] flex items-end justify-center p-3 text-white font-bold text-lg drop-shadow"
            style={{ backgroundColor: c.hex }}
          >
            <span className="bg-black/35 px-3 py-1 rounded-lg text-sm">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// 2. Shape Explorer
const SHAPES = [
  { id: 'circle', label: 'Circle', color: '#3B82F6' },
  { id: 'square', label: 'Square', color: '#10B981' },
  { id: 'triangle', label: 'Triangle', color: '#F59E0B' },
  { id: 'star', label: 'Star', color: '#8B5CF6' },
  { id: 'hexagon', label: 'Hexagon', color: '#EC4899' },
];

function renderShapeSvg(id: string, color: string, outline = false) {
  const fill = outline ? 'none' : color;
  const stroke = outline ? '#94A3B8' : 'none';
  const strokeWidth = outline ? 5 : 0;
  const dash = outline ? '8 6' : undefined;
  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20">
      {id === 'circle' && <circle cx="50" cy="50" r="36" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />}
      {id === 'square' && <rect x="16" y="16" width="68" height="68" rx="10" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />}
      {id === 'triangle' && <polygon points="50,14 86,84 14,84" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinejoin="round" />}
      {id === 'star' && <polygon points="50,10 61,36 89,38 67,57 74,85 50,70 26,85 33,57 11,38 39,36" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinejoin="round" />}
      {id === 'hexagon' && <polygon points="50,12 84,31 84,69 50,88 16,69 16,31" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} strokeLinejoin="round" />}
    </svg>
  );
}

export const ShapeExplorerGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [target, setTarget] = useState(SHAPES[0]);
  const [choices, setChoices] = useState(SHAPES.slice(0, 4));
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('Match the shape that fits the outline!');

  const setup = (nextScore: number) => {
    const pool = [...SHAPES].sort(() => Math.random() - 0.5).slice(0, 4);
    setChoices(pool);
    setTarget(pool[Math.floor(Math.random() * pool.length)]);
    onScore(nextScore);
  };

  useEffect(() => {
    setup(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (s: typeof SHAPES[number]) => {
    if (paused) return;
    if (s.id === target.id) {
      soundFx.win();
      const next = score + 15;
      setScore(next);
      setMessage(`Well done! You matched the ${s.label}.`);
      setTimeout(() => setup(next), 450);
    } else {
      soundFx.bounce();
      setMessage(`Look closely at the outline—try finding the ${target.label}.`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-emerald-50 dark:bg-slate-900 rounded-xl border border-emerald-200 dark:border-slate-700">
      <div className="text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Score: <span className="font-mono font-bold text-slate-900 dark:text-white">{score}</span>
        </p>
        <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">Match the {target.label}</h3>
        <div className="mt-4 inline-flex items-center justify-center w-32 h-32 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-inner">
          {renderShapeSvg(target.id, target.color, true)}
        </div>
        <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-xl">
        {choices.map((s) => (
          <button
            key={s.id}
            onClick={() => choose(s)}
            disabled={paused}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 transition-transform active:scale-95 shadow-sm min-h-[120px]"
          >
            {renderShapeSvg(s.id, s.color, false)}
            <span className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// 3. Animal Sounds Safari
const ANIMALS: { id: 'cat' | 'dog' | 'cow' | 'duck' | 'lion' | 'frog'; name: string; soundWord: string; bg: string }[] = [
  { id: 'cat', name: 'Cat', soundWord: 'Meow', bg: '#FDE68A' },
  { id: 'dog', name: 'Dog', soundWord: 'Woof', bg: '#BFDBFE' },
  { id: 'cow', name: 'Cow', soundWord: 'Moo', bg: '#E5E7EB' },
  { id: 'duck', name: 'Duck', soundWord: 'Quack', bg: '#FEF08A' },
  { id: 'lion', name: 'Lion', soundWord: 'Roar', bg: '#FED7AA' },
  { id: 'frog', name: 'Frog', soundWord: 'Ribbit', bg: '#BBF7D0' },
];

export const AnimalSafariGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [quizMode, setQuizMode] = useState(false);
  const [target, setTarget] = useState(ANIMALS[0]);
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Tap an animal card to hear its musical sound!');

  const startQuizRound = () => {
    const pick = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    setTarget(pick);
    soundFx.animalCall(pick.id);
    setStatus(`Listen carefully! Which animal says "${pick.soundWord}"?`);
  };

  const handleTap = (a: typeof ANIMALS[number]) => {
    if (paused) return;
    soundFx.animalCall(a.id);
    if (!quizMode) {
      const next = score + 5;
      setScore(next);
      onScore(next);
      setStatus(`${a.name} says "${a.soundWord}"!`);
      return;
    }
    if (a.id === target.id) {
      soundFx.match();
      const next = score + 15;
      setScore(next);
      onScore(next);
      setStatus(`Correct! That was the ${a.name}!`);
      setTimeout(startQuizRound, 700);
    } else {
      setStatus(`Oops, that was the ${a.name}. Try finding "${target.soundWord}"!`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-orange-50 dark:bg-slate-900 rounded-xl border border-orange-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-4 w-full max-w-2xl">
        <div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Animal Sounds Safari</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{status}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const nextMode = !quizMode;
              setQuizMode(nextMode);
              if (nextMode) startQuizRound();
              else setStatus('Explore Mode: Tap any animal to listen.');
            }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              quizMode
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600'
            }`}
          >
            {quizMode ? 'Quiz Mode Active' : 'Switch to Quiz Mode'}
          </button>
          {quizMode && (
            <button
              onClick={() => soundFx.animalCall(target.id)}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4" /> Replay
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {ANIMALS.map((a) => (
          <button
            key={a.id}
            onClick={() => handleTap(a)}
            disabled={paused}
            className="p-5 rounded-2xl border-2 border-white dark:border-slate-700 shadow-sm hover:scale-[1.02] active:scale-95 transition-transform flex flex-col items-center gap-2 text-slate-900"
            style={{ backgroundColor: a.bg }}
          >
            <span className="text-2xl font-extrabold tracking-tight">{a.name}</span>
            <span className="text-sm font-semibold text-slate-700">{quizMode ? 'Tap to Answer' : `"${a.soundWord}"`}</span>
          </button>
        ))}
      </div>
      <p className="text-sm font-mono text-slate-600 dark:text-slate-400">Score: {score}</p>
    </div>
  );
};

// 4. Alphabet Adventure (Trace & Match)
const ALPHABET_WORDS: Record<string, string> = {
  A: 'Apple', B: 'Ball', C: 'Cat', D: 'Drum', E: 'Elephant', F: 'Fish',
  G: 'Guitar', H: 'House', I: 'Igloo', J: 'Juice', K: 'Kite', L: 'Lion',
  M: 'Moon', N: 'Nest', O: 'Orange', P: 'Penguin', Q: 'Queen', R: 'Rocket',
  S: 'Sun', T: 'Train', U: 'Umbrella', V: 'Violin', W: 'Whale', X: 'Xylophone',
  Y: 'Yo-Yo', Z: 'Zebra',
};
const LETTERS = Object.keys(ALPHABET_WORDS);

export const AlphabetAdventureGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const letter = LETTERS[idx];

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Faint guide letter
    ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.font = 'bold 180px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, canvas.width / 2, canvas.height / 2 + 8);
  };

  useEffect(() => {
    clearCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (paused) return;
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || paused) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    drawingRef.current = false;
  };

  const completeLetter = () => {
    soundFx.match();
    const nextScore = score + 10;
    setScore(nextScore);
    onScore(nextScore);
    setIdx((prev) => (prev + 1) % LETTERS.length);
  };

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-sky-50 dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-slate-700">
      <div className="flex items-center justify-between w-full max-w-lg">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
            {letter} is for {ALPHABET_WORDS[letter]}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Trace the letter below using your finger or mouse.</p>
        </div>
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">Score: {score}</span>
      </div>

      <canvas
        ref={canvasRef}
        width={340}
        height={240}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="touch-none bg-white dark:bg-slate-800 rounded-2xl border-2 border-sky-300 dark:border-slate-600 shadow-inner cursor-crosshair w-full max-w-[340px]"
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={clearCanvas}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-medium inline-flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> Clear Trace
        </button>
        <button
          onClick={completeLetter}
          disabled={paused}
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
        >
          <Sparkles className="w-4 h-4" /> Done! Next Letter
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 max-w-lg">
        {LETTERS.map((l, i) => (
          <button
            key={l}
            onClick={() => setIdx(i)}
            className={`w-8 h-8 rounded-md text-xs font-bold ${
              i === idx
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
};

// 5. Number Counting Garden
export const NumberGardenGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [count, setCount] = useState(3);
  const [options, setOptions] = useState<number[]>([2, 3, 4, 5]);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('Count the bright apples and tap the matching number!');

  const newRound = (nextScore: number) => {
    const target = Math.floor(Math.random() * 12) + 1;
    const set = new Set<number>([target]);
    while (set.size < 4) {
      const candidate = Math.max(1, target + Math.floor(Math.random() * 7) - 3);
      set.add(candidate);
    }
    setCount(target);
    setOptions(Array.from(set).sort((a, b) => a - b));
    onScore(nextScore);
  };

  useEffect(() => {
    newRound(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (n: number) => {
    if (paused) return;
    if (n === count) {
      soundFx.win();
      const next = score + 10;
      setScore(next);
      setMsg(`Awesome! There are ${count} apples.`);
      setTimeout(() => newRound(next), 500);
    } else {
      soundFx.bounce();
      setMsg(`Count one more time! That wasn't ${n}.`);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-pink-50 dark:bg-slate-900 rounded-xl border border-pink-200 dark:border-slate-700">
      <div className="text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Score: <span className="font-mono font-bold text-slate-900 dark:text-white">{score}</span>
        </p>
        <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">How many apples do you see?</h3>
        <p className="text-sm font-medium text-pink-700 dark:text-pink-300 mt-1">{msg}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 p-6 rounded-2xl bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 min-h-[140px] w-full max-w-lg">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="w-11 h-11 rounded-full bg-red-500 border-2 border-red-600 shadow-sm flex items-center justify-center relative"
            aria-label="Apple"
          >
            <span className="w-2 h-3 bg-emerald-500 rounded-full -top-2 absolute rotate-12" />
            <span className="text-xs font-mono font-bold text-white">{i + 1}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-3 w-full max-w-md">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => pick(n)}
            disabled={paused}
            className="h-20 rounded-xl bg-white dark:bg-slate-800 border-2 border-pink-300 dark:border-slate-600 hover:border-blue-500 text-2xl font-mono font-bold text-slate-900 dark:text-white shadow-sm active:scale-95"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
};
