import React, { useEffect, useState } from 'react';
import { RotateCcw, Dices } from 'lucide-react';
import type { GameProps } from './GameProps';
import { soundFx } from '../utils/soundFx';

// 21. Chess Master vs Bot
type ChessColor = 'w' | 'b';
type PieceType = 'P' | 'R' | 'N' | 'B' | 'Q' | 'K';
interface ChessPiece {
  color: ChessColor;
  type: PieceType;
}

const PIECE_UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};
const PIECE_VAL: Record<PieceType, number> = { P: 10, N: 30, B: 32, R: 50, Q: 90, K: 900 };

function initChessBoard(): (ChessPiece | null)[][] {
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const board: (ChessPiece | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { color: 'b', type: back[c] };
    board[1][c] = { color: 'b', type: 'P' };
    board[6][c] = { color: 'w', type: 'P' };
    board[7][c] = { color: 'w', type: back[c] };
  }
  return board;
}

function getPseudoMoves(board: (ChessPiece | null)[][], r: number, c: number): [number, number][] {
  const p = board[r][c];
  if (!p) return [];
  const moves: [number, number][] = [];
  const inBounds = (rr: number, cc: number) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;

  if (p.type === 'P') {
    const dir = p.color === 'w' ? -1 : 1;
    const startRow = p.color === 'w' ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === startRow && !board[r + 2 * dir][c]) moves.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1]) {
      if (inBounds(r + dir, c + dc) && board[r + dir][c + dc] && board[r + dir][c + dc]!.color !== p.color) {
        moves.push([r + dir, c + dc]);
      }
    }
    return moves;
  }

  if (p.type === 'N') {
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc) && board[rr][cc]?.color !== p.color) moves.push([rr, cc]);
    }
    return moves;
  }

  if (p.type === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr, cc = c + dc;
        if (inBounds(rr, cc) && board[rr][cc]?.color !== p.color) moves.push([rr, cc]);
      }
    }
    return moves;
  }

  const dirs: [number, number][] = [];
  if (p.type === 'R' || p.type === 'Q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  if (p.type === 'B' || p.type === 'Q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);

  for (const [dr, dc] of dirs) {
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc)) {
      const target = board[rr][cc];
      if (!target) {
        moves.push([rr, cc]);
      } else {
        if (target.color !== p.color) moves.push([rr, cc]);
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  return moves;
}

export const ChessMasterGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [board, setBoard] = useState<(ChessPiece | null)[][]>(initChessBoard);
  const [turn, setTurn] = useState<ChessColor>('w');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [status, setStatus] = useState('White to move. Select a piece.');
  const [winner, setWinner] = useState<ChessColor | null>(null);
  const [score, setScore] = useState(0);

  const legalForSelected = selected ? getPseudoMoves(board, selected[0], selected[1]) : [];

  const applyMove = (
    curBoard: (ChessPiece | null)[][],
    fr: number,
    fc: number,
    tr: number,
    tc: number
  ) => {
    const next = curBoard.map((row) => [...row]);
    const moving = next[fr][fc]!;
    const captured = next[tr][tc];
    next[tr][tc] =
      moving.type === 'P' && (tr === 0 || tr === 7)
        ? { color: moving.color, type: 'Q' }
        : moving;
    next[fr][fc] = null;
    return { next, captured };
  };

  useEffect(() => {
    if (turn !== 'b' || winner || paused) return;
    const t = setTimeout(() => {
      const allMoves: { fr: number; fc: number; tr: number; tc: number; gain: number }[] = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (board[r][c]?.color === 'b') {
            for (const [tr, tc] of getPseudoMoves(board, r, c)) {
              const target = board[tr][tc];
              const centerBonus = tr >= 2 && tr <= 5 && tc >= 2 && tc <= 5 ? 2 : 0;
              allMoves.push({
                fr: r,
                fc: c,
                tr,
                tc,
                gain: (target ? PIECE_VAL[target.type] : 0) + centerBonus + Math.random(),
              });
            }
          }
        }
      }
      if (allMoves.length === 0) {
        setWinner('w');
        setStatus('White wins! Black has no moves.');
        soundFx.win();
        onScore(score + 500, true);
        return;
      }
      allMoves.sort((a, b) => b.gain - a.gain);
      const best = allMoves[0];
      const { next, captured } = applyMove(board, best.fr, best.fc, best.tr, best.tc);
      setBoard(next);
      soundFx.click();
      if (captured?.type === 'K') {
        setWinner('b');
        setStatus('SC Bot captured the King — Black wins!');
        soundFx.hit();
        onScore(score, true);
      } else {
        setTurn('w');
        setStatus('Your turn (White).');
      }
    }, 520);
    return () => clearTimeout(t);
  }, [turn, winner, paused, board, score, onScore]);

  const handleSquare = (r: number, c: number) => {
    if (paused || winner || turn !== 'w') return;
    const piece = board[r][c];
    if (selected) {
      const isLegal = legalForSelected.some(([mr, mc]) => mr === r && mc === c);
      if (isLegal) {
        const { next, captured } = applyMove(board, selected[0], selected[1], r, c);
        setBoard(next);
        setSelected(null);
        const pts = captured ? score + PIECE_VAL[captured.type] * 5 : score + 5;
        setScore(pts);
        onScore(pts);
        if (captured) soundFx.match();
        else soundFx.click();

        if (captured?.type === 'K') {
          setWinner('w');
          setStatus('Checkmate Victory — You won!');
          soundFx.win();
          onScore(pts + 600, true);
        } else {
          setTurn('b');
          setStatus('SC Bot is thinking...');
        }
        return;
      }
    }
    if (piece?.color === 'w') {
      setSelected([r, c]);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 w-full max-w-[400px] text-sm">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{status}</span>
        <button
          onClick={() => {
            setBoard(initChessBoard());
            setTurn('w');
            setSelected(null);
            setWinner(null);
            setScore(0);
            setStatus('White to move. Select a piece.');
          }}
          className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-semibold inline-flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-8 border-2 border-slate-700 rounded-lg overflow-hidden w-full max-w-[400px]">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const darkSq = (r + c) % 2 === 1;
            const isSel = selected?.[0] === r && selected?.[1] === c;
            const isTarget = legalForSelected.some(([mr, mc]) => mr === r && mc === c);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => handleSquare(r, c)}
                className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl select-none relative ${
                  isSel
                    ? 'bg-blue-500 text-white'
                    : isTarget
                      ? darkSq
                        ? 'bg-emerald-700'
                        : 'bg-emerald-300'
                      : darkSq
                        ? 'bg-[#334155]'
                        : 'bg-[#E2E8F0]'
                }`}
              >
                <span className={cell?.color === 'w' ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]' : 'text-slate-950'}>
                  {cell ? PIECE_UNICODE[`${cell.color}${cell.type}`] : ''}
                </span>
                {isTarget && !cell && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-950/40 absolute" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

// 22. Ludo Classic (Simplified Track Ludo vs Bot / Local)
const TRACK_LEN = 28;
export const LudoClassicGame: React.FC<GameProps> = ({ paused, onScore }) => {
  // Position: -1 = yard, 0..27 = main track, 28 = finished home
  const [tokens, setTokens] = useState<[number[], number[]]>([
    [-1, -1, -1, -1],
    [-1, -1, -1, -1],
  ]);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [dice, setDice] = useState<number | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [msg, setMsg] = useState('Blue (You) vs Purple (Bot). Roll the dice!');

  const rollDice = () => {
    if (paused || winner !== null || dice !== null) return;
    const val = Math.floor(Math.random() * 6) + 1;
    soundFx.click();
    setDice(val);
    const playerTokens = tokens[turn];
    const hasValid = playerTokens.some((pos) => (pos === -1 ? val === 6 : pos + val <= TRACK_LEN));
    if (!hasValid) {
      setMsg(`Rolled ${val} — no valid moves. Passing turn.`);
      setTimeout(() => {
        setDice(null);
        setTurn(turn === 0 ? 1 : 0);
      }, 650);
    } else {
      setMsg(`${turn === 0 ? 'Blue' : 'Purple'} rolled ${val}! Choose a token.`);
    }
  };

  const moveToken = (playerIdx: 0 | 1, tokenIdx: number, rolledVal: number) => {
    const nextTokens: [number[], number[]] = [[...tokens[0]], [...tokens[1]]];
    const cur = nextTokens[playerIdx][tokenIdx];
    let nextPos = cur;
    if (cur === -1 && rolledVal === 6) nextPos = 0;
    else if (cur >= 0 && cur + rolledVal <= TRACK_LEN) nextPos = cur + rolledVal;
    else return false;

    nextTokens[playerIdx][tokenIdx] = nextPos;
    soundFx.match();

    // Capture opponent if sharing relative board coordinate (offset by 14)
    if (nextPos > 0 && nextPos < TRACK_LEN) {
      const opp = playerIdx === 0 ? 1 : 0;
      const myGlobal = (nextPos + (playerIdx === 1 ? 14 : 0)) % TRACK_LEN;
      for (let i = 0; i < 4; i++) {
        const oppPos = nextTokens[opp][i];
        if (oppPos > 0 && oppPos < TRACK_LEN) {
          const oppGlobal = (oppPos + (opp === 1 ? 14 : 0)) % TRACK_LEN;
          if (oppGlobal === myGlobal) {
            nextTokens[opp][i] = -1;
            soundFx.hit();
          }
        }
      }
    }

    setTokens(nextTokens);
    setDice(null);

    if (nextTokens[playerIdx].every((p) => p === TRACK_LEN)) {
      setWinner(playerIdx);
      soundFx.win();
      setMsg(playerIdx === 0 ? 'You won Ludo Classic!' : 'Bot reached Home first!');
      onScore(playerIdx === 0 ? 1200 : 250, true);
      return true;
    }

    if (rolledVal !== 6) {
      setTurn(playerIdx === 0 ? 1 : 0);
    } else {
      setMsg(`Rolled 6! Bonus roll for ${playerIdx === 0 ? 'Blue' : 'Purple'}.`);
    }
    return true;
  };

  useEffect(() => {
    if (turn !== 1 || winner !== null || paused) return;
    if (dice === null) {
      const t = setTimeout(rollDice, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const botTokens = tokens[1];
      const idx = botTokens.findIndex((p) => (p === -1 ? dice === 6 : p + dice <= TRACK_LEN));
      if (idx >= 0) moveToken(1, idx, dice);
    }, 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, dice, winner, paused]);

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{msg}</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={rollDice}
          disabled={turn !== 0 || dice !== null || winner !== null || paused}
          className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold inline-flex items-center gap-2"
        >
          <Dices className="w-5 h-5" />
          {dice !== null ? `Rolled: ${dice}` : turn === 0 ? 'Roll Dice' : 'Bot Turn...'}
        </button>
        <button
          onClick={() => {
            setTokens([[-1, -1, -1, -1], [-1, -1, -1, -1]]);
            setTurn(0);
            setDice(null);
            setWinner(null);
            setMsg('New game started!');
          }}
          className="px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm font-semibold"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        {[0, 1].map((pIdx) => (
          <div
            key={pIdx}
            className={`p-4 rounded-xl border ${
              turn === pIdx ? 'border-blue-500 bg-white dark:bg-slate-800' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
            }`}
          >
            <h4 className="font-bold text-sm mb-3 text-slate-900 dark:text-white">
              {pIdx === 0 ? 'Blue Tokens (You)' : 'Purple Tokens (Bot)'}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {tokens[pIdx].map((pos, tIdx) => {
                const canMove =
                  pIdx === 0 &&
                  turn === 0 &&
                  dice !== null &&
                  (pos === -1 ? dice === 6 : pos + dice <= TRACK_LEN);
                return (
                  <button
                    key={tIdx}
                    disabled={!canMove}
                    onClick={() => dice !== null && moveToken(0, tIdx, dice)}
                    className={`p-3 rounded-lg border text-left transition ${
                      canMove
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 cursor-pointer'
                        : 'border-slate-200 dark:border-slate-700 opacity-80'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Token #{tIdx + 1}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {pos === -1 ? 'In Yard (Need 6)' : pos === TRACK_LEN ? 'Home!' : `Step ${pos}/${TRACK_LEN}`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 23. Tic-Tac-Toe Local (vs Bot or 2P Pass-and-Play)
export const TicTacToeLocalGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [board, setBoard] = useState<('X' | 'O' | null)[]>(Array(9).fill(null));
  const [vsBot, setVsBot] = useState(true);
  const [xTurn, setXTurn] = useState(true);

  const checkWin = (b: ('X' | 'O' | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return b.every(Boolean) ? 'draw' : null;
  };

  const result = checkWin(board);

  useEffect(() => {
    if (!vsBot || xTurn || result || paused) return;
    const t = setTimeout(() => {
      const empties = board.map((v, i) => (v === null ? i : -1)).filter((i) => i >= 0);
      if (empties.length === 0) return;
      // Pick winning or blocking move if available
      let pick = empties[Math.floor(Math.random() * empties.length)];
      for (const sym of ['O', 'X'] as const) {
        for (const idx of empties) {
          const test = [...board];
          test[idx] = sym;
          if (checkWin(test) === sym) {
            pick = idx;
            break;
          }
        }
      }
      const next = [...board];
      next[pick] = 'O';
      setBoard(next);
      setXTurn(true);
      soundFx.click();
    }, 360);
    return () => clearTimeout(t);
  }, [vsBot, xTurn, result, paused, board]);

  const tapCell = (i: number) => {
    if (paused || result || board[i] !== null) return;
    if (vsBot && !xTurn) return;
    const next = [...board];
    next[i] = xTurn ? 'X' : 'O';
    setBoard(next);
    soundFx.click();
    const res = checkWin(next);
    if (res === 'X') {
      soundFx.win();
      onScore(300, true);
    } else if (res === 'O' && !vsBot) {
      soundFx.win();
    }
    setXTurn(!xTurn);
  };

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setVsBot(true);
            setBoard(Array(9).fill(null));
            setXTurn(true);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${vsBot ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600'}`}
        >
          1P vs Bot
        </button>
        <button
          onClick={() => {
            setVsBot(false);
            setBoard(Array(9).fill(null));
            setXTurn(true);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!vsBot ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600'}`}
        >
          2P Local
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 w-64">
        {board.map((val, i) => (
          <button
            key={i}
            onClick={() => tapCell(i)}
            className="h-20 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-3xl font-extrabold flex items-center justify-center hover:border-blue-500"
          >
            <span className={val === 'X' ? 'text-blue-500' : 'text-purple-500'}>{val}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {result === 'draw' ? 'Draw Match!' : result ? `${result} Wins!` : `${xTurn ? 'X' : 'O'} Turn`}
        </span>
        <button
          onClick={() => {
            setBoard(Array(9).fill(null));
            setXTurn(true);
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold"
        >
          Rematch
        </button>
      </div>
    </div>
  );
};

// 24. Connect Four Local
export const ConnectFourLocalGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [grid, setGrid] = useState<(1 | 2 | null)[]>(Array(42).fill(null));
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<1 | 2 | 'draw' | null>(null);

  const checkWinner = (b: (1 | 2 | null)[]) => {
    const at = (r: number, c: number) => b[r * 7 + c];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const p = at(r, c);
        if (!p) continue;
        if (c + 3 < 7 && p === at(r, c + 1) && p === at(r, c + 2) && p === at(r, c + 3)) return p;
        if (r + 3 < 6 && p === at(r + 1, c) && p === at(r + 2, c) && p === at(r + 3, c)) return p;
        if (r + 3 < 6 && c + 3 < 7 && p === at(r + 1, c + 1) && p === at(r + 2, c + 2) && p === at(r + 3, c + 3)) return p;
        if (r + 3 < 6 && c - 3 >= 0 && p === at(r + 1, c - 1) && p === at(r + 2, c - 2) && p === at(r + 3, c - 3)) return p;
      }
    }
    return b.every(Boolean) ? 'draw' : null;
  };

  const dropInCol = (col: number, player: 1 | 2) => {
    const next = [...grid];
    let placed = false;
    for (let r = 5; r >= 0; r--) {
      if (next[r * 7 + col] === null) {
        next[r * 7 + col] = player;
        placed = true;
        break;
      }
    }
    if (!placed) return false;
    soundFx.click();
    setGrid(next);
    const res = checkWinner(next);
    if (res) {
      setWinner(res);
      if (res === 1) {
        soundFx.win();
        onScore(500, true);
      }
    } else {
      setTurn(player === 1 ? 2 : 1);
    }
    return true;
  };

  useEffect(() => {
    if (turn !== 2 || winner || paused) return;
    const t = setTimeout(() => {
      const validCols = [0, 1, 2, 3, 4, 5, 6].filter((c) => grid[c] === null);
      if (validCols.length === 0) return;
      const pick = validCols[Math.floor(Math.random() * validCols.length)];
      dropInCol(pick, 2);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, paused]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between w-full max-w-[340px] text-sm">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {winner === 'draw' ? 'Draw!' : winner ? `${winner === 1 ? 'Blue (You)' : 'Amber (Bot)'} Wins!` : `${turn === 1 ? 'Your Turn (Blue)' : 'Bot Thinking...'}`}
        </span>
        <button
          onClick={() => {
            setGrid(Array(42).fill(null));
            setTurn(1);
            setWinner(null);
          }}
          className="px-3 py-1 rounded-lg bg-slate-800 text-white text-xs font-semibold"
        >
          Reset
        </button>
      </div>

      <div className="bg-blue-800 p-3 rounded-2xl grid grid-cols-7 gap-1.5 w-full max-w-[340px] shadow-inner">
        {grid.map((cell, idx) => {
          const col = idx % 7;
          return (
            <button
              key={idx}
              disabled={turn !== 1 || Boolean(winner) || paused}
              onClick={() => dropInCol(col, 1)}
              className={`aspect-square rounded-full transition-colors ${
                cell === 1 ? 'bg-sky-400' : cell === 2 ? 'bg-amber-400' : 'bg-slate-950/75 hover:bg-slate-900'
              }`}
              aria-label={`Column ${col + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
};

// 25. Football Penalty Striker (Sports Zone)
const ZONES = ['Top Left', 'Top Center', 'Top Right', 'Bottom Left', 'Bottom Center', 'Bottom Right'];

export const PenaltyStrikerGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [kick, setKick] = useState(1);
  const [goals, setGoals] = useState(0);
  const [keeperIdx, setKeeperIdx] = useState<number | null>(null);
  const [shotIdx, setShotIdx] = useState<number | null>(null);
  const [msg, setMsg] = useState('Tap any target corner of the goal net to shoot!');

  const shoot = (zoneIdx: number) => {
    if (paused || kick > 5 || shotIdx !== null) return;
    const dive = Math.floor(Math.random() * 6);
    setShotIdx(zoneIdx);
    setKeeperIdx(dive);

    const scored = dive !== zoneIdx;
    const nextGoals = scored ? goals + 1 : goals;
    if (scored) {
      soundFx.win();
      setGoals(nextGoals);
      setMsg(`GOAL! Fired into ${ZONES[zoneIdx]}.`);
    } else {
      soundFx.hit();
      setMsg(`Saved! Goalkeeper guessed ${ZONES[dive]}.`);
    }

    setTimeout(() => {
      setShotIdx(null);
      setKeeperIdx(null);
      if (kick === 5) {
        onScore(nextGoals * 200, true);
        setKick(6);
      } else {
        setKick((k) => k + 1);
      }
    }, 900);
  };

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-emerald-950 rounded-xl border border-emerald-800 text-white">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-mono">Kick: {Math.min(kick, 5)} / 5</span>
        <span className="font-mono font-bold text-emerald-300">Goals: {goals}</span>
      </div>
      <p className="text-sm text-emerald-100 text-center">{msg}</p>

      <div className="grid grid-cols-3 gap-3 w-full max-w-md p-4 border-4 border-white/80 rounded-t-xl bg-emerald-900/60">
        {ZONES.map((label, idx) => (
          <button
            key={label}
            onClick={() => shoot(idx)}
            disabled={paused || kick > 5}
            className={`h-24 rounded-lg border border-white/30 flex flex-col items-center justify-center text-xs font-semibold transition ${
              keeperIdx === idx
                ? 'bg-amber-500 text-slate-950'
                : shotIdx === idx
                  ? 'bg-sky-500 text-white'
                  : 'bg-emerald-800/50 hover:bg-emerald-700/70'
            }`}
          >
            <span>{label}</span>
            {keeperIdx === idx && <span className="mt-1 font-bold">KEEPER</span>}
            {shotIdx === idx && keeperIdx !== idx && <span className="mt-1 font-bold">GOAL!</span>}
          </button>
        ))}
      </div>

      {kick > 5 && (
        <button
          onClick={() => {
            setKick(1);
            setGoals(0);
            setMsg('New 5-kick shootout! Pick your corner.');
          }}
          className="px-5 py-2 rounded-lg bg-white text-emerald-950 font-bold"
        >
          Play Shootout Again ({goals}/5)
        </button>
      )}
    </div>
  );
};

// 26. Cricket Super Over (Sports Zone)
export const CricketSuperOverGame: React.FC<GameProps> = ({ paused, onScore }) => {
  const [ballPos, setBallPos] = useState(0); // 0 to 100
  const [ballsLeft, setBallsLeft] = useState(6);
  const [runs, setRuns] = useState(0);
  const [commentary, setCommentary] = useState('Wait until the ball enters the blue Crease Zone, then Swing!');
  const [swinging, setSwinging] = useState(false);

  useEffect(() => {
    if (paused || ballsLeft <= 0 || swinging) return;
    const interval = setInterval(() => {
      setBallPos((prev) => {
        if (prev >= 100) {
          // Missed delivery
          setSwinging(true);
          setBallsLeft((b) => {
            const left = b - 1;
            if (left === 0) onScore(runs, true);
            return left;
          });
          setCommentary('Dot ball — cleanly past the bat!');
          setTimeout(() => {
            setBallPos(0);
            setSwinging(false);
          }, 550);
          return 100;
        }
        return prev + 4;
      });
    }, 36);
    return () => clearInterval(interval);
  }, [paused, ballsLeft, swinging, runs, onScore]);

  const swingBat = () => {
    if (paused || ballsLeft <= 0 || swinging) return;
    setSwinging(true);
    const dist = Math.abs(ballPos - 82);
    let scored = 0;
    let text = 'Missed! Dot ball.';
    if (dist <= 6) {
      scored = 6;
      text = 'MAXIMUM SIX! Clean middle of the bat!';
      soundFx.win();
    } else if (dist <= 13) {
      scored = 4;
      text = 'CRACKING FOUR! Raced to the boundary.';
      soundFx.match();
    } else if (dist <= 20) {
      scored = 2;
      text = 'Solid 2 runs into the gap.';
      soundFx.click();
    } else {
      soundFx.hit();
    }
    const nextRuns = runs + scored;
    const nextBalls = ballsLeft - 1;
    setRuns(nextRuns);
    setBallsLeft(nextBalls);
    setCommentary(text);
    onScore(nextRuns, nextBalls === 0);

    setTimeout(() => {
      setBallPos(0);
      setSwinging(false);
    }, 650);
  };

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-slate-900 rounded-xl border border-slate-700 text-white">
      <div className="flex items-center justify-between w-full max-w-md text-sm">
        <span className="font-mono font-bold text-blue-400 text-lg">Runs: {runs}</span>
        <span className="font-mono text-slate-300">Balls Left: {ballsLeft}</span>
      </div>
      <p className="text-sm text-center text-slate-200 min-h-[20px]">{commentary}</p>

      {/* Pitch Bar */}
      <div className="w-full max-w-md h-20 rounded-xl bg-emerald-900 border border-emerald-700 relative overflow-hidden flex items-center px-4">
        <div
          className="absolute top-0 bottom-0 bg-blue-500/30 border-x-2 border-blue-400"
          style={{ left: '75%', width: '14%' }}
        />
        <span className="text-[10px] font-mono uppercase text-blue-200 absolute top-1" style={{ left: '76%' }}>
          Crease
        </span>
        <div
          className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow absolute transition-none"
          style={{ left: `calc(${ballPos}% - 10px)` }}
        />
      </div>

      {ballsLeft > 0 ? (
        <button
          onClick={swingBat}
          disabled={paused || swinging}
          className="w-full max-w-xs py-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-lg font-bold shadow-lg"
        >
          SWING BAT
        </button>
      ) : (
        <button
          onClick={() => {
            setRuns(0);
            setBallsLeft(6);
            setBallPos(0);
            setCommentary('New Super Over! Time your swing.');
          }}
          className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold"
        >
          Play Another Super Over ({runs} runs)
        </button>
      )}
    </div>
  );
};
