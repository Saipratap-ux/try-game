import React, { useEffect, useState } from 'react';
import { Lightbulb, CheckCircle2, RotateCcw } from 'lucide-react';
import type { GameProps } from './GameProps';
import { soundFx } from '../utils/soundFx';

// 6. Memory Card Pairs
const CARD_SYMBOLS = ['☀', '★', '♫', '⚓', '✿', '◆', '☾', '♣'];

interface MemCard {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

export const MemoryPairsGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const createDeck = (): MemCard[] =>
    [...CARD_SYMBOLS, ...CARD_SYMBOLS]
      .sort(() => Math.random() - 0.5)
      .map((symbol, id) => ({ id, symbol, flipped: false, matched: false }));

  const [cards, setCards] = useState<MemCard[]>(createDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const matchedCount = cards.filter((c) => c.matched).length;
  const won = matchedCount === cards.length;

  const flipCard = (idx: number) => {
    if (paused || locked || cards[idx].flipped || cards[idx].matched) return;
    soundFx.click();
    const updated = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(updated);
    const nextSel = [...selected, idx];
    setSelected(nextSel);

    if (nextSel.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      const [a, b] = nextSel;
      if (updated[a].symbol === updated[b].symbol) {
        soundFx.match();
        const afterMatch = updated.map((c, i) =>
          i === a || i === b ? { ...c, matched: true } : c
        );
        setCards(afterMatch);
        setSelected([]);
        if (afterMatch.every((c) => c.matched)) {
          soundFx.win();
          const finalScore = Math.max(200, 2000 - nextMoves * 40);
          onScore(finalScore, true);
        }
      } else {
        setLocked(true);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c))
          );
          setSelected([]);
          setLocked(false);
        }, 650);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-5 p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-mono text-slate-700 dark:text-slate-300">Moves: <strong>{moves}</strong></span>
        <span className="font-mono text-slate-700 dark:text-slate-300">Pairs: <strong>{matchedCount / 2} / 8</strong></span>
        <button
          onClick={() => {
            setCards(createDeck());
            setSelected([]);
            setMoves(0);
          }}
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold inline-flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> New Deal
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 w-full max-w-md">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => flipCard(idx)}
            disabled={paused}
            className={`aspect-square min-h-[60px] rounded-xl text-2xl font-bold transition-transform duration-150 flex items-center justify-center border ${
              c.matched
                ? 'bg-emerald-600 text-white border-emerald-500'
                : c.flipped
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-blue-500'
                  : 'bg-[#1E293B] text-slate-400 border-slate-700 hover:border-blue-400'
            }`}
          >
            {c.flipped || c.matched ? c.symbol : '?'}
          </button>
        ))}
      </div>

      {won && (
        <div className="text-center text-emerald-600 dark:text-emerald-400 font-semibold">
          All pairs matched in {moves} moves! Score recorded.
        </div>
      )}
    </div>
  );
};

// 7. Classic Sudoku 9x9
const SUDOKU_PUZZLE = [
  [5, 3, 0, 0, 7, 0, 0, 0, 0],
  [6, 0, 0, 1, 9, 5, 0, 0, 0],
  [0, 9, 8, 0, 0, 0, 0, 6, 0],
  [8, 0, 0, 0, 6, 0, 0, 0, 3],
  [4, 0, 0, 8, 0, 3, 0, 0, 1],
  [7, 0, 0, 0, 2, 0, 0, 0, 6],
  [0, 6, 0, 0, 0, 0, 2, 8, 0],
  [0, 0, 0, 4, 1, 9, 0, 0, 5],
  [0, 0, 0, 0, 8, 0, 0, 7, 9],
];
const SUDOKU_SOLUTION = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

export const SudokuClassicGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [board, setBoard] = useState<number[][]>(() => SUDOKU_PUZZLE.map((r) => [...r]));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState('Select a blank cell and pick a number 1–9.');

  const setCell = (num: number) => {
    if (paused || !selected) return;
    const [r, c] = selected;
    if (SUDOKU_PUZZLE[r][c] !== 0) return;
    const next = board.map((row) => [...row]);
    next[r][c] = num;
    setBoard(next);
    soundFx.click();

    if (num !== 0 && num !== SUDOKU_SOLUTION[r][c]) {
      setStatus(`Tip: ${num} conflicts with Sudoku solution in row ${r + 1}.`);
    } else {
      setStatus('Clean placement.');
    }

    const solved = next.every((row, ri) =>
      row.every((val, ci) => val === SUDOKU_SOLUTION[ri][ci])
    );
    if (solved) {
      soundFx.win();
      setStatus('Sudoku solved completely!');
      onScore(1500, true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{status}</span>
      </div>

      <div className="grid grid-cols-9 bg-slate-800 p-1 rounded-lg border-2 border-slate-700 w-full max-w-[380px]">
        {board.map((row, r) =>
          row.map((val, c) => {
            const fixed = SUDOKU_PUZZLE[r][c] !== 0;
            const isSel = selected?.[0] === r && selected?.[1] === c;
            const wrong = !fixed && val !== 0 && val !== SUDOKU_SOLUTION[r][c];
            const borderR = c === 2 || c === 5 ? 'border-r-2 border-r-slate-500' : 'border-r border-r-slate-700';
            const borderB = r === 2 || r === 5 ? 'border-b-2 border-b-slate-500' : 'border-b border-b-slate-700';
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => setSelected([r, c])}
                className={`aspect-square flex items-center justify-center font-mono text-base sm:text-lg font-bold ${borderR} ${borderB} ${
                  isSel
                    ? 'bg-blue-600 text-white'
                    : fixed
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : wrong
                        ? 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300'
                        : 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400'
                }`}
              >
                {val === 0 ? '' : val}
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-[380px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => setCell(n)}
            disabled={paused}
            className="w-10 h-11 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-500 font-mono font-bold text-slate-900 dark:text-white"
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setCell(0)}
          disabled={paused}
          className="px-3 h-11 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100"
        >
          Erase
        </button>
      </div>
    </div>
  );
};

// 8. Senior Word Search (Large >=44px cells + 4-Tier Hint System)
const WS_WORDS = [
  { word: 'FAMILY', coords: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], dir: 'Horizontal' },
  { word: 'PUZZLE', coords: [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]], dir: 'Vertical' },
  { word: 'MUSIC', coords: [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5]], dir: 'Diagonal' },
  { word: 'GARDEN', coords: [[7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], dir: 'Horizontal' },
  { word: 'CHESS', coords: [[1, 0], [2, 0], [3, 0], [4, 0], [5, 0]], dir: 'Vertical' },
];

const WS_GRID: string[][] = [
  ['F', 'A', 'M', 'I', 'L', 'Y', 'K', 'T'],
  ['C', 'B', 'R', 'T', 'O', 'N', 'P', 'W'],
  ['H', 'M', 'L', 'Q', 'S', 'D', 'U', 'A'],
  ['E', 'R', 'U', 'P', 'A', 'V', 'Z', 'E'],
  ['S', 'K', 'N', 'S', 'L', 'E', 'Z', 'R'],
  ['S', 'W', 'O', 'M', 'I', 'R', 'L', 'N'],
  ['Q', 'P', 'A', 'D', 'E', 'C', 'E', 'B'],
  ['G', 'A', 'R', 'D', 'E', 'N', 'T', 'O'],
];

export const WordSearchGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [startCell, setStartCell] = useState<[number, number] | null>(null);
  const [hintTier, setHintTier] = useState(0);
  const [hintText, setHintText] = useState('Tap the first letter and last letter of any listed word.');

  const foundCoordSet = new Set(
    WS_WORDS.filter((w) => foundWords.includes(w.word)).flatMap((w) =>
      w.coords.map(([r, c]) => `${r}-${c}`)
    )
  );

  const nextMissing = WS_WORDS.find((w) => !foundWords.includes(w.word));

  const handleHint = () => {
    if (!nextMissing) return;
    const nextTier = (hintTier % 4) + 1;
    setHintTier(nextTier);
    const [r, c] = nextMissing.coords[0];
    if (nextTier === 1) {
      setHintText(`Hint 1 (Letter): Look for "${nextMissing.word}" starting with "${nextMissing.word[0]}".`);
    } else if (nextTier === 2) {
      setHintText(`Hint 2 (Orientation): "${nextMissing.word}" runs ${nextMissing.dir}.`);
    } else if (nextTier === 3) {
      setHintText(`Hint 3 (Column): "${nextMissing.word}" begins in Column ${c + 1}.`);
    } else {
      setHintText(`Hint 4 (First Cell): Highlighted Row ${r + 1}, Col ${c + 1} for "${nextMissing.word}".`);
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (paused) return;
    soundFx.click();
    if (!startCell) {
      setStartCell([r, c]);
      return;
    }
    const [sr, sc] = startCell;
    setStartCell(null);
    const match = WS_WORDS.find((w) => {
      const first = w.coords[0];
      const last = w.coords[w.coords.length - 1];
      return (
        (first[0] === sr && first[1] === sc && last[0] === r && last[1] === c) ||
        (last[0] === sr && last[1] === sc && first[0] === r && first[1] === c)
      );
    });
    if (match && !foundWords.includes(match.word)) {
      soundFx.win();
      const next = [...foundWords, match.word];
      setFoundWords(next);
      setHintTier(0);
      setHintText(`Found "${match.word}"!`);
      onScore(next.length * 250, next.length === WS_WORDS.length);
    } else {
      setHintText('No word between those endpoints. Try selecting first and last letter.');
    }
  };

  const tier4Highlight =
    hintTier === 4 && nextMissing
      ? `${nextMissing.coords[0][0]}-${nextMissing.coords[0][1]}`
      : null;

  return (
    <div className="flex flex-col items-center gap-5 p-4 sm:p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-xl">
        <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200">{hintText}</p>
        <button
          onClick={handleHint}
          disabled={!nextMissing}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Lightbulb className="w-4 h-4" /> Hint ({hintTier}/4)
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {WS_WORDS.map((w) => {
          const found = foundWords.includes(w.word);
          return (
            <span
              key={w.word}
              className={`text-base font-bold tracking-wide inline-flex items-center gap-1 ${
                found ? 'line-through text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {found && <CheckCircle2 className="w-4 h-4" />}
              {w.word}
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-8 gap-1.5 w-full max-w-[420px]">
        {WS_GRID.map((row, r) =>
          row.map((ch, c) => {
            const key = `${r}-${c}`;
            const isFound = foundCoordSet.has(key);
            const isStart = startCell?.[0] === r && startCell?.[1] === c;
            const isHint4 = tier4Highlight === key;
            return (
              <button
                key={key}
                onClick={() => handleCellClick(r, c)}
                disabled={paused}
                className={`min-h-[44px] min-w-[40px] rounded-lg text-lg font-bold transition-colors border ${
                  isStart
                    ? 'bg-blue-600 text-white border-blue-500'
                    : isFound
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : isHint4
                        ? 'bg-amber-300 text-slate-950 border-amber-500'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:border-blue-500'
                }`}
              >
                {ch}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

// 9. Number Puzzle 15
function createSolvable15(): number[] {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
  let empty = 15;
  for (let i = 0; i < 120; i++) {
    const r = Math.floor(empty / 4);
    const c = empty % 4;
    const neighbors: number[] = [];
    if (r > 0) neighbors.push(empty - 4);
    if (r < 3) neighbors.push(empty + 4);
    if (c > 0) neighbors.push(empty - 1);
    if (c < 3) neighbors.push(empty + 1);
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    [arr[empty], arr[pick]] = [arr[pick], arr[empty]];
    empty = pick;
  }
  return arr;
}

export const Sliding15Game: React.FC<GameProps> = ({ paused, onScore }) => {
  const [tiles, setTiles] = useState<number[]>(createSolvable15);
  const [moves, setMoves] = useState(0);

  const solved = tiles.slice(0, 15).every((v, i) => v === i + 1);

  const moveTile = (idx: number) => {
    if (paused || solved) return;
    const empty = tiles.indexOf(0);
    const r1 = Math.floor(idx / 4), c1 = idx % 4;
    const r2 = Math.floor(empty / 4), c2 = empty % 4;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    soundFx.click();
    const next = [...tiles];
    [next[empty], next[idx]] = [next[idx], next[empty]];
    const nextMoves = moves + 1;
    setTiles(next);
    setMoves(nextMoves);
    if (next.slice(0, 15).every((v, i) => v === i + 1)) {
      soundFx.win();
      onScore(Math.max(300, 2500 - nextMoves * 15), true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between w-full max-w-xs text-sm">
        <span className="font-mono font-bold text-slate-800 dark:text-slate-100">Moves: {moves}</span>
        <button
          onClick={() => {
            setTiles(createSolvable15());
            setMoves(0);
          }}
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold"
        >
          Shuffle
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 w-full max-w-xs bg-slate-800 p-3 rounded-xl">
        {tiles.map((v, idx) => (
          <button
            key={idx}
            onClick={() => moveTile(idx)}
            disabled={v === 0 || paused}
            className={`aspect-square rounded-lg font-mono text-xl font-bold transition-transform active:scale-95 ${
              v === 0
                ? 'bg-slate-900/60 cursor-default'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
            }`}
          >
            {v === 0 ? '' : v}
          </button>
        ))}
      </div>
      {solved && <p className="text-emerald-600 dark:text-emerald-400 font-semibold">Solved in {moves} moves!</p>}
    </div>
  );
};

// 10. Pattern & Picture Match
const GLYPHS = ['◆', '●', '▲', '★', '■', '✦'];

export const PictureMatchGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [target, setTarget] = useState<string[]>([]);
  const [choices, setChoices] = useState<string[][]>([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);

  const buildRound = () => {
    const seq = Array.from({ length: 4 }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
    const opts = [seq];
    while (opts.length < 4) {
      const mut = [...seq];
      const idx = Math.floor(Math.random() * 4);
      mut[idx] = GLYPHS[(GLYPHS.indexOf(mut[idx]) + 1 + Math.floor(Math.random() * 4)) % GLYPHS.length];
      if (!opts.some((o) => o.join('') === mut.join(''))) opts.push(mut);
    }
    setTarget(seq);
    setChoices(opts.sort(() => Math.random() - 0.5));
  };

  useEffect(() => {
    buildRound();
  }, []);

  const pick = (opt: string[]) => {
    if (paused) return;
    if (opt.join('') === target.join('')) {
      soundFx.match();
      const next = score + 25;
      setScore(next);
      setRound((r) => r + 1);
      onScore(next);
      buildRound();
    } else {
      soundFx.hit();
      setScore((s) => Math.max(0, s - 5));
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-mono text-slate-700 dark:text-slate-300">Round {round}</span>
        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">Score: {score}</span>
      </div>
      <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border-2 border-blue-500 text-center">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Target Sequence</p>
        <div className="flex gap-4 text-3xl font-bold text-slate-900 dark:text-white">
          {target.map((g, i) => (
            <span key={i}>{g}</span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
        {choices.map((opt, idx) => (
          <button
            key={idx}
            onClick={() => pick(opt)}
            disabled={paused}
            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-blue-500 flex justify-center gap-4 text-2xl text-slate-900 dark:text-white"
          >
            {opt.map((g, i) => (
              <span key={i}>{g}</span>
            ))}
          </button>
        ))}
      </div>
    </div>
  );
};
