import Image from "next/image";
import { getDriverByCode, getTeamByShortName } from "@/config/drivers";

interface PredictionCardProps {
  displayName: string;
  pWhatPosition: number;
  isOwn?: boolean;
  isSprint?: boolean;
  pole_position: string;
  top3_p1: string;
  top3_p2: string;
  top3_p3: string;
  biggest_surprise: string;
  biggest_flop: string;
  p_what_driver: string;
  crazy_prediction: string;
  sprint_pole?: string | null;
  sprint_winner?: string | null;
}

function PickRow({ label, value }: { label: string; value: string }) {
  const driver = getDriverByCode(value);
  const team = !driver ? getTeamByShortName(value) : null;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0 min-w-0">
      <span className="text-[10px] font-bold text-muted tracking-widest uppercase w-16 shrink-0">
        {label}
      </span>
      {driver ? (
        <>
          <div
            className="relative h-6 w-6 rounded-full overflow-hidden shrink-0"
            style={{ background: driver.team.colour + "33" }}
          >
            <Image
              src={driver.photoPath}
              alt={driver.name}
              fill
              unoptimized
              className="object-cover object-top"
              sizes="24px"
            />
          </div>
          <span
            className="text-[11px] font-bold tracking-wide shrink-0"
            style={{ color: driver.team.colour }}
          >
            {driver.code}
          </span>
          <span className="text-xs text-white truncate">{driver.name}</span>
        </>
      ) : team ? (
        <>
          <div className="relative h-5 w-5 shrink-0">
            <Image
              src={team.logoPath}
              alt={team.shortName}
              fill
              unoptimized
              className="object-contain"
              sizes="20px"
            />
          </div>
          <span className="text-xs text-white truncate">{team.name}</span>
        </>
      ) : (
        <span className="text-xs text-muted italic">—</span>
      )}
    </div>
  );
}

export default function PredictionCard({
  displayName,
  pWhatPosition,
  isOwn = false,
  isSprint = false,
  pole_position,
  top3_p1,
  top3_p2,
  top3_p3,
  biggest_surprise,
  biggest_flop,
  p_what_driver,
  crazy_prediction,
  sprint_pole,
  sprint_winner,
}: PredictionCardProps) {
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`bg-surface rounded-xl overflow-hidden ${isOwn ? "border-2 border-white/40 ring-1 ring-white/10" : "border border-white/5"}`}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isOwn ? "bg-white/15 border border-white/30" : "bg-accent/20 border border-accent/30"}`}>
          <span className={`text-xs font-bold ${isOwn ? "text-white" : "text-accent"}`}>{initials}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          {isOwn && <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest shrink-0">You</span>}
        </div>
      </div>

      {/* Picks */}
      <div className="px-4 py-2">
        <PickRow label="Pole"    value={pole_position}    />
        {isSprint && (
          <>
            <PickRow label="Spr Pole"   value={sprint_pole   ?? ""} />
            <PickRow label="Spr Win"    value={sprint_winner ?? ""} />
          </>
        )}
        <PickRow label="P1"      value={top3_p1}          />
        <PickRow label="P2"      value={top3_p2}          />
        <PickRow label="P3"      value={top3_p3}          />
        <PickRow label="Surprise" value={biggest_surprise} />
        <PickRow label="Flop"    value={biggest_flop}     />
        <PickRow label={`P${pWhatPosition}?`} value={p_what_driver} />
      </div>

      {/* Crazy prediction */}
      <div className="px-4 pb-3">
        <p className="text-[10px] font-bold text-muted tracking-widest uppercase mb-1">Crazy pick</p>
        <p className="text-xs text-white/80 italic leading-relaxed">&ldquo;{crazy_prediction}&rdquo;</p>
      </div>
    </div>
  );
}
