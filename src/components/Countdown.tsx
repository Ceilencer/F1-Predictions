"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  deadline: string; // ISO timestamp
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function calcTimeLeft(deadline: string): TimeLeft {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    expired: false,
  };
}

export default function Countdown({ deadline }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    // Compute on client only to avoid SSR/client mismatch
    setTimeLeft(calcTimeLeft(deadline));
    const id = setInterval(() => setTimeLeft(calcTimeLeft(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!timeLeft) return null;

  if (timeLeft.expired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400" />
        Predictions locked
      </span>
    );
  }

  const urgent = timeLeft.days === 0 && timeLeft.hours < 3;
  const warning = timeLeft.days === 0 && timeLeft.hours < 24;

  const colour = urgent
    ? "text-red-400"
    : warning
    ? "text-yellow-400"
    : "text-green-400";
  const dot = urgent ? "bg-red-400" : warning ? "bg-yellow-400" : "bg-green-400";

  const parts = timeLeft.days > 0
    ? `${timeLeft.days}d ${timeLeft.hours}h ${timeLeft.minutes}m`
    : `${String(timeLeft.hours).padStart(2, "0")}:${String(timeLeft.minutes).padStart(2, "0")}:${String(timeLeft.seconds).padStart(2, "0")}`;

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-mono font-medium ${colour}`}>
      <span className={`w-2 h-2 rounded-full animate-pulse ${dot}`} />
      {parts} remaining
    </span>
  );
}
