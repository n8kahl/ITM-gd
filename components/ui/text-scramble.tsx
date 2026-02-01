"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface TextScrambleProps {
  text: string;
  className?: string;
  characterSet?: string;
  speed?: number; // ms per character reveal
  scrambleSpeed?: number; // ms between scramble cycles
  delay?: number; // initial delay before starting
  onComplete?: () => void;
}

// Characters to cycle through during scramble - trading/tech themed
const DEFAULT_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%#@&*+=<>{}[]";

export function TextScramble({
  text,
  className,
  characterSet = DEFAULT_CHARS,
  speed = 50,
  scrambleSpeed = 30,
  delay = 500,
  onComplete,
}: TextScrambleProps) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const revealedIndexRef = useRef(0);
  const frameRef = useRef<number>();

  const scramble = useCallback(() => {
    const chars = characterSet.split("");
    const textChars = text.split("");
    const revealed = revealedIndexRef.current;

    // Build display string
    const result = textChars.map((char, index) => {
      // Already revealed characters
      if (index < revealed) {
        return char;
      }
      // Preserve spaces
      if (char === " ") {
        return " ";
      }
      // Scramble unrevealed characters
      return chars[Math.floor(Math.random() * chars.length)];
    });

    setDisplayText(result.join(""));
  }, [text, characterSet]);

  useEffect(() => {
    let scrambleInterval: NodeJS.Timeout;
    let revealTimeout: NodeJS.Timeout;
    let initialTimeout: NodeJS.Timeout;

    const startAnimation = () => {
      // Continuous scramble animation
      scrambleInterval = setInterval(scramble, scrambleSpeed);

      // Progressive reveal
      const reveal = () => {
        if (revealedIndexRef.current < text.length) {
          // Skip spaces in timing
          const currentChar = text[revealedIndexRef.current];
          if (currentChar === " ") {
            revealedIndexRef.current++;
            reveal();
            return;
          }

          revealedIndexRef.current++;
          revealTimeout = setTimeout(reveal, speed);
        } else {
          // Animation complete
          clearInterval(scrambleInterval);
          setDisplayText(text);
          setIsComplete(true);
          onComplete?.();
        }
      };

      reveal();
    };

    // Initial delay
    initialTimeout = setTimeout(startAnimation, delay);

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(revealTimeout);
      clearInterval(scrambleInterval);
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [text, speed, scrambleSpeed, delay, scramble, onComplete]);

  // Reset on text change
  useEffect(() => {
    revealedIndexRef.current = 0;
    setIsComplete(false);
    setDisplayText("");
  }, [text]);

  return (
    <span
      className={cn(
        "inline-block font-mono",
        !isComplete && "tracking-wider",
        className
      )}
      aria-label={text}
    >
      {displayText || text.replace(/./g, " ")}
      {!isComplete && (
        <span className="animate-pulse text-primary">_</span>
      )}
    </span>
  );
}

// Variant with line-by-line reveal
interface MultiLineScrambleProps {
  lines: string[];
  className?: string;
  lineClassName?: string;
  staggerDelay?: number;
  speed?: number;
  scrambleSpeed?: number;
  initialDelay?: number;
}

export function MultiLineScramble({
  lines,
  className,
  lineClassName,
  staggerDelay = 800,
  speed = 40,
  scrambleSpeed = 25,
  initialDelay = 500,
}: MultiLineScrambleProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [completedLines, setCompletedLines] = useState<number[]>([]);

  const handleComplete = useCallback((index: number) => {
    setCompletedLines((prev) => [...prev, index]);
    if (index < lines.length - 1) {
      setTimeout(() => setActiveIndex(index + 1), 200);
    }
  }, [lines.length]);

  return (
    <div className={cn("space-y-2", className)}>
      {lines.map((line, index) => (
        <div key={index} className={lineClassName}>
          {index <= activeIndex ? (
            <TextScramble
              text={line}
              speed={speed}
              scrambleSpeed={scrambleSpeed}
              delay={index === 0 ? initialDelay : staggerDelay}
              onComplete={() => handleComplete(index)}
            />
          ) : (
            <span className="opacity-0">{line}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// Headline variant with larger styling
interface ScrambleHeadlineProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "span";
  speed?: number;
  delay?: number;
}

export function ScrambleHeadline({
  text,
  className,
  as: Component = "h1",
  speed = 60,
  delay = 800,
}: ScrambleHeadlineProps) {
  return (
    <Component className={className}>
      <TextScramble
        text={text}
        speed={speed}
        scrambleSpeed={35}
        delay={delay}
        characterSet="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&"
      />
    </Component>
  );
}
