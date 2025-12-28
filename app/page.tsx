"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
type Clef = "treble" | "bass";
type Feedback = "idle" | "correct" | "wrong";

type NoteOnStaff = {
  id: number;
  clef: Clef;
  staffStep: number;
  letter: Letter;
};

const LETTERS: Letter[] = ["C", "D", "E", "F", "G", "A", "B"];
const MIDI_BY_LETTER: Record<Letter, number> = {
  C: 60,
  D: 62,
  E: 64,
  F: 65,
  G: 67,
  A: 69,
  B: 71,
};
const CLEF_ANCHOR: Record<Clef, Letter> = {
  treble: "B", // middle line B4
  bass: "D", // middle line D3
};
const SLOT_OFFSETS = [0, 140, 260];

const STEP_MIN = -4;
const STEP_MAX = 4;
const LINE_SPACING = 12;
const STEP_PX = LINE_SPACING / 2;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function staffStepToLetter(step: number, clef: Clef): Letter {
  const baseIndex = LETTERS.indexOf(CLEF_ANCHOR[clef]);
  const index = mod(baseIndex + step, LETTERS.length);
  return LETTERS[index];
}

let noteId = 0;

function generateNote(prev?: NoteOnStaff): NoteOnStaff {
  let next: NoteOnStaff | null = null;

  for (let i = 0; i < 6; i += 1) {
    const clef: Clef = Math.random() < 0.5 ? "treble" : "bass";
    const staffStep = randInt(STEP_MIN, STEP_MAX);
    const candidate: NoteOnStaff = {
      id: noteId++,
      clef,
      staffStep,
      letter: staffStepToLetter(staffStep, clef),
    };

    if (
      !prev ||
      candidate.clef !== prev.clef ||
      candidate.staffStep !== prev.staffStep
    ) {
      next = candidate;
      break;
    }

    next = candidate;
  }

  return next!;
}

let audioCtx: AudioContext | null = null;

function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playLetter(letter: Letter) {
  const Context =
    typeof window !== "undefined"
      ? window.AudioContext || (window as any).webkitAudioContext
      : null;
  if (!Context) return;

  if (!audioCtx) {
    audioCtx = new Context();
  }

  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }

  const freq = midiToFreq(MIDI_BY_LETTER[letter]);
  const now = audioCtx.currentTime;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

type GrandStaffProps = {
  queue: NoteOnStaff[];
  feedback: Feedback;
  isShifting: boolean;
  spawnedId?: number | null;
};

function GrandStaff({
  queue,
  feedback,
  isShifting,
  spawnedId,
}: GrandStaffProps) {
  const note = queue[0];
  if (!note) return null;
  const trebleLines = [50, 62, 74, 86, 98];
  const bassLines = [160, 172, 184, 196, 208];
  const isTreble = note.clef === "treble";
  const lines = isTreble ? trebleLines : bassLines;
  const anchorY = isTreble ? 74 : 184;
  const noteY = anchorY - note.staffStep * STEP_PX;
  const noteX = 430;

  const ledgerYs = useMemo(() => {
    const positions: number[] = [];
    if (note.staffStep >= STEP_MAX + 2) {
      for (let step = STEP_MAX + 2; step <= note.staffStep; step += 2) {
        positions.push(anchorY - step * STEP_PX);
      }
    } else if (note.staffStep <= STEP_MIN - 2) {
      for (let step = STEP_MIN - 2; step >= note.staffStep; step -= 2) {
        positions.push(anchorY - step * STEP_PX);
      }
    }
    return positions;
  }, [anchorY, note.staffStep]);

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.7)]">
      <svg
        viewBox="0 0 960 260"
        role="img"
        aria-label="Grand staff with a single note"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="scanGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="noteSheen" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect
          x="0"
          y="0"
          width="960"
          height="260"
          fill="url(#scanGlow)"
          opacity="0.18"
        />

        {[50, 62, 74, 86, 98].map((y) => (
          <line
            key={`treble-${y}`}
            x1="140"
            x2="840"
            y1={y}
            y2={y}
            stroke="rgba(226,232,240,0.35)"
            strokeWidth="1.5"
          />
        ))}
        {[160, 172, 184, 196, 208].map((y) => (
          <line
            key={`bass-${y}`}
            x1="140"
            x2="840"
            y1={y}
            y2={y}
            stroke="rgba(226,232,240,0.35)"
            strokeWidth="1.5"
          />
        ))}

        <g aria-label="Treble clef">
          <text
            x="106"
            y="92"
            fill="rgba(241,245,249,0.92)"
            fontSize="58"
            fontFamily="serif"
            textAnchor="middle"
          >
            𝄞
          </text>
          <text
            x="106"
            y="114"
            fill="rgba(226,232,240,0.9)"
            fontSize="13"
            fontWeight="700"
            textAnchor="middle"
          >
            Treble
          </text>
        </g>
        <g aria-label="Bass clef">
          <text
            x="110"
            y="196"
            fill="rgba(241,245,249,0.92)"
            fontSize="56"
            fontFamily="serif"
            textAnchor="middle"
          >
            𝄢
          </text>
          <text
            x="110"
            y="220"
            fill="rgba(226,232,240,0.9)"
            fontSize="13"
            fontWeight="700"
            textAnchor="middle"
          >
            Bass
          </text>
        </g>

        {ledgerYs.map((y) => (
          <line
            key={`ledger-${y}`}
            x1={noteX - 28}
            x2={noteX + 28}
            y1={y}
            y2={y}
            stroke="rgba(226,232,240,0.85)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}

        {queue.slice(0, 3).map((n, idx) => {
          const offset = SLOT_OFFSETS[idx] ?? 0;
          const x = noteX + offset;
          const y = (n.clef === "treble" ? 74 : 184) - n.staffStep * STEP_PX;
          const isCurrent = idx === 0;
          const size =
            idx === 0
              ? { rx: 14, ry: 10.5, innerRx: 9, innerRy: 7 }
              : idx === 1
                ? { rx: 12, ry: 9, innerRx: 8, innerRy: 6 }
                : { rx: 10, ry: 7, innerRx: 6.5, innerRy: 4.5 };
          const fill = isCurrent
            ? feedback === "correct"
              ? "#22c55e"
              : feedback === "wrong"
                ? "#ef4444"
                : "#60a5fa"
            : "rgba(191,219,254,0.55)";
          const stroke = isCurrent
            ? "rgba(15,23,42,0.5)"
            : "rgba(148,163,184,0.45)";
          const isSpawned = spawnedId != null && n.id === spawnedId;
          const layerClass =
            idx === 0 ? "current" : idx === 1 ? "preview-1" : "preview-2";

          const stemDown = n.staffStep > 1;
          const stemLength = isCurrent ? 34 : 28;
          const stemX = stemDown ? x - size.rx + 2 : x + size.rx - 2;
          const stemY2 = stemDown ? y + stemLength : y - stemLength;

          return (
            <g
              key={n.id}
              className={`note-layer ${layerClass} ${isShifting ? "shifting" : ""} ${isSpawned ? "note-enter" : ""}`}
              style={{
                transformOrigin: `${x}px ${y}px`,
              }}
            >
              <line
                x1={stemX}
                y1={y}
                x2={stemX}
                y2={stemY2}
                stroke={isCurrent ? stroke : "rgba(148,163,184,0.35)"}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <ellipse
                cx={x}
                cy={y}
                rx={size.rx}
                ry={size.ry}
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
              />
              <ellipse
                cx={x}
                cy={y}
                rx={size.rx - 1.5}
                ry={size.ry - 1.5}
                fill="url(#noteSheen)"
                opacity={isCurrent ? 0.35 : 0.22}
              />
              <ellipse
                cx={x - 2}
                cy={y - 2}
                rx={size.innerRx}
                ry={size.innerRy}
                fill="rgba(255,255,255,0.2)"
              />
            </g>
          );
        })}

      </svg>
    </div>
  );
}

type KeyboardProps = {
  onPress: (letter: Letter) => void;
  feedback: Feedback;
  lastPressed?: Letter;
  hintLetter?: Letter;
};

function Keyboard({
  onPress,
  feedback,
  lastPressed,
  hintLetter,
}: KeyboardProps) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm uppercase tracking-[0.2em] text-slate-300">
          Click to answer
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
              feedback === "correct"
                ? "bg-emerald-500/15 text-emerald-200"
                : feedback === "wrong"
                  ? "bg-rose-500/15 text-rose-200"
                  : "bg-white/10 text-slate-200"
            }`}
          >
            {feedback === "idle" ? "Idle" : feedback}
          </span>
          {hintLetter ? (
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-100">
              Hint: {hintLetter}
            </span>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {LETTERS.map((letter) => {
          const isLast = lastPressed === letter;
          const isHint = hintLetter === letter;
          const isCorrect = isLast && feedback === "correct";
          const isWrong = isLast && feedback === "wrong";

          const base =
            "group relative flex h-16 items-center justify-center rounded-2xl border text-lg font-semibold uppercase transition duration-200 focus:outline-none";
          const palette = isCorrect
            ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-50 shadow-[0_10px_30px_-18px_rgba(16,185,129,0.8)]"
            : isWrong
              ? "border-rose-400/60 bg-rose-400/15 text-rose-50 shadow-[0_10px_30px_-18px_rgba(248,113,113,0.8)]"
              : isHint
                ? "border-amber-400/60 bg-amber-400/15 text-amber-50 shadow-[0_10px_30px_-18px_rgba(251,191,36,0.8)]"
                : "border-white/10 bg-white/5 text-slate-50 hover:border-white/40 hover:bg-white/10";

          return (
            <button
              key={letter}
              type="button"
              onClick={() => onPress(letter)}
              className={`${base} ${palette}`}
              aria-label={`Press ${letter}`}
            >
              <span className="text-xl">{letter}</span>
              <span className="pointer-events-none absolute inset-x-4 bottom-2 block h-px bg-white/10 opacity-0 transition group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Home() {
  const [queue, setQueue] = useState<NoteOnStaff[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [lastPressed, setLastPressed] = useState<Letter | undefined>();
  const [hintLetter, setHintLetter] = useState<Letter | undefined>();
  const [spawnedId, setSpawnedId] = useState<number | null>(null);
  const [isShifting, setIsShifting] = useState(false);

  const feedbackTimer = useRef<NodeJS.Timeout | null>(null);
  const hintTimer = useRef<NodeJS.Timeout | null>(null);
  const currentNote = queue[0];

  useEffect(() => {
    const first = generateNote();
    const second = generateNote(first);
    const third = generateNote(second);
    setQueue([first, second, third]);
    setSpawnedId(third.id);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const handlePress = useCallback(
    (letter: Letter) => {
      if (isShifting) return;
      const current = queue[0];
      if (!current) return;

      setLastPressed(letter);
      playLetter(letter);

      if (letter === current.letter) {
        setFeedback("correct");
        setHintLetter(undefined);
        setIsShifting(true);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => {
          setQueue((prev) => {
            if (prev.length === 0) return prev;
            const [, second, third] = prev;
            const seed = third ?? second ?? prev[0];
            const nextNote = generateNote(seed);
            const nextQueue = [
              second ?? nextNote,
              third ?? nextNote,
              nextNote,
            ];
            setSpawnedId(nextNote.id);
            return nextQueue;
          });
          setFeedback("idle");
          setIsShifting(false);
        }, 420);
      } else {
        setFeedback("wrong");
        setHintLetter(current.letter);
        if (hintTimer.current) clearTimeout(hintTimer.current);
        hintTimer.current = setTimeout(() => setHintLetter(undefined), 500);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        feedbackTimer.current = setTimeout(() => setFeedback("idle"), 200);
      }
    },
    [queue, isShifting],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (LETTERS.includes(key as Letter)) {
        e.preventDefault();
        handlePress(key as Letter);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlePress]);

  if (!currentNote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 px-6 py-4 text-sm uppercase tracking-[0.25em] text-slate-300">
          Loading the first note...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.15),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(236,72,153,0.12),transparent_35%),radial-gradient(circle_at_60%_70%,rgba(16,185,129,0.12),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center gap-10 px-6 py-14">
        <header className="flex w-full flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300">
                Grand Staff Loop
              </p>
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">
                Instant Note Trainer
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100">
                Plays on every click
              </div>
              <div className="rounded-2xl bg-sky-500/15 px-4 py-2 text-sm text-sky-100">
                Random clef, naturals only
              </div>
            </div>
          </div>
          <p className="max-w-3xl text-base text-slate-200">
            See one note on the grand staff. Click the matching letter to
            advance. Wrong answers flash, show a hint, and keep the same target
            until you nail it.
          </p>
        </header>

        <GrandStaff
          queue={queue}
          feedback={feedback}
          isShifting={isShifting}
          spawnedId={spawnedId}
        />

        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.9)] backdrop-blur">
          <Keyboard
            onPress={handlePress}
            feedback={feedback}
            lastPressed={lastPressed}
            hintLetter={hintLetter}
          />
        </div>
      </div>
    </div>
  );
}
