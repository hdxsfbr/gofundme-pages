"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import "./live-donation-chart.css";

const amounts = [25, 50, 15, 100, 35, 20, 75, 10];
const openingTotal = 11850;
const interval = 3200;
const windowSize = 20;
const cumulative = (index: number) => {
  const cycles = Math.floor(index / amounts.length);
  return (
    cycles * amounts.reduce((sum, value) => sum + value, 0) +
    amounts
      .slice(0, index % amounts.length)
      .reduce((sum, value) => sum + value, 0)
  );
};

function RollingDigit({ digit }: { digit: string }) {
  const [pair, setPair] = useState({ before: digit, current: digit });
  if (pair.current !== digit) setPair({ before: pair.current, current: digit });
  const before = pair.before;
  if (!/\d/.test(digit)) return <span>{digit}</span>;
  return (
    <span className="odometer-digit">
      <span
        key={digit}
        className={before === digit ? "odometer-still" : "odometer-roll"}
      >
        <span>{before}</span>
        <span>{digit}</span>
      </span>
    </span>
  );
}

export function LiveDonationChart() {
  const id = useId().replaceAll(":", "");
  const root = useRef<HTMLDivElement>(null);
  const clock = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (paused || reduced || !visible) return;
    let frame = 0;
    let last = 0;
    let paint = 0;
    const draw = (now: number) => {
      if (!document.hidden) {
        if (last) clock.current += Math.min(now - last, 100);
        if (now - paint > 32) {
          setElapsed(clock.current);
          paint = now;
        }
      }
      last = now;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [paused, reduced, visible]);

  const step = Math.floor(elapsed / interval);
  const fraction = (elapsed % interval) / interval;
  const total = openingTotal + cumulative(step);
  // A sliding illustrative window, with the same sequence on every campaign.
  // This component never reads or writes contributions or analytics.
  const base = cumulative(step) + fraction * amounts[step % amounts.length];
  const top =
    cumulative(step + windowSize + 1) +
    fraction * amounts[(step + windowSize + 1) % amounts.length];
  const y = (value: number) =>
    190 - ((value - base) / Math.max(top - base, 1)) * 155;
  const coords = Array.from(
    { length: windowSize + 2 },
    (_, i) =>
      `${((i - fraction) / windowSize) * 600},${y(cumulative(step + i))}`,
  );
  const path = `M ${coords.join(" L ")}`;
  const value = total.toLocaleString("en-US");
  const running = !paused && !reduced;
  return (
    <div
      className="live-donation-chart"
      ref={root}
      data-testid="live-donation-chart"
    >
      <div className="live-chart-heading">
        <span className="live-chart-badge">
          <i className={running ? "is-live" : ""} /> Live demo
        </span>
        <button
          className="live-chart-pause"
          onClick={() => setPaused(!paused)}
          disabled={reduced}
          aria-label={
            reduced
              ? "Reduced motion: live donation demo paused"
              : paused
                ? "Resume live donation demo"
                : "Pause live donation demo"
          }
        >
          {running ? <Pause size={14} /> : <Play size={14} />}
          {reduced ? "Reduced motion" : paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div className="live-chart-stat">
        <span className="live-chart-label">Illustrative total · USD</span>
        <span
          className="live-chart-total"
          role="img"
          aria-label={`Illustrative total: $${value}`}
        >
          <span aria-hidden="true" className="odometer">
            <span className="odometer-currency">$</span>
            {value.split("").map((digit, i) => (
              <RollingDigit key={value.length - i} digit={digit} />
            ))}
          </span>
        </span>
        <span className="live-chart-arrival" key={step}>
          {step
            ? `+$${amounts[(step - 1) % amounts.length]} · demo donation received`
            : "A little generosity. A growing impact."}
        </span>
      </div>
      <svg
        className="live-chart-svg"
        viewBox="0 0 600 220"
        role="img"
        aria-label="Animated illustration of incoming donations; not recorded campaign funding"
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d5fa66" stopOpacity=".25" />
            <stop offset="100%" stopColor="#d5fa66" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`clip-${id}`}>
            <rect width="600" height="220" />
          </clipPath>
        </defs>
        {[40, 90, 140, 190].map((y) => (
          <line
            key={y}
            x1="0"
            x2="600"
            y1={y}
            y2={y}
            stroke="white"
            strokeOpacity=".1"
            strokeDasharray="3 7"
          />
        ))}
        <g clipPath={`url(#clip-${id})`}>
          <path d={`${path} L 630 220 L -40 220 Z`} fill={`url(#fill-${id})`} />
          <path
            d={path}
            fill="none"
            stroke="#d5fa66"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      </svg>
      <div className="live-chart-axis">
        <span>A moment ago</span>
        <span>{running ? "Now" : "Paused"}</span>
      </div>
      <p className="live-chart-disclaimer">
        Simulated activity to preview a live campaign. These donations aren’t
        saved or included in campaign totals.
      </p>
    </div>
  );
}
