"use client";

import { useEffect, useState } from "react";

// A word that swaps on a loop: each letter drops in from above, holds, then
// falls away below before the next word comes in. Styles in site.css
// (.site-letter). Purely visual: the caller gives screen readers the full
// sentence, since a word that changes under them is just noise.

export type Word = { text: string; ms: number };

// How long the letters take to fall away, so the next word starts on cue:
// the out animation is 300ms, plus 25ms between letters.
const outMs = (text: string) => 300 + text.length * 25;

export function RotatingWord({ words, className = "" }: { words: readonly Word[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const word = words[index];

  useEffect(() => {
    const leave = setTimeout(() => setLeaving(true), Math.max(0, word.ms - outMs(word.text)));
    const next = setTimeout(() => {
      setLeaving(false);
      setIndex((i) => (i + 1) % words.length);
    }, word.ms);
    return () => {
      clearTimeout(leave);
      clearTimeout(next);
    };
  }, [word, words.length]);

  return (
    <span aria-hidden className={`${leaving ? "site-word-out" : ""} ${className}`}>
      {/* A new key per word remounts the letters, so each one drops in afresh. */}
      <span key={index}>
        {[...word.text].map((letter, i) => (
          <span key={i} className="site-letter" style={{ "--i": i } as React.CSSProperties}>
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}
