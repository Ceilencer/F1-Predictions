# Team Logo Assets

Place one SVG file per constructor in this folder.
Filenames must match the `logoPath` values in `src/config/drivers.ts`.

## Required files (2026 season)

| Filename              | Team                        |
|-----------------------|-----------------------------|
| `red-bull.svg`        | Oracle Red Bull Racing      |
| `ferrari.svg`         | Scuderia Ferrari            |
| `mercedes.svg`        | Mercedes-AMG Petronas       |
| `mclaren.svg`         | McLaren F1 Team             |
| `aston-martin.svg`    | Aston Martin Aramco         |
| `alpine.svg`          | BWT Alpine F1 Team          |
| `williams.svg`        | Williams Racing             |
| `haas.svg`            | MoneyGram Haas F1 Team      |
| `racing-bulls.svg`    | Visa Cash App RB            |
| `audi.svg`            | Audi F1 Team                |

## Sizing guidelines

- SVG format ensures crisp rendering at all sizes
- Logos render at 24–32 px height in the timing tower
- Use the official team SVGs where possible; otherwise use a clean wordmark

## Updating logos

1. Drop the new SVG into this folder with the same filename.
2. No code changes needed — the app references the path from `drivers.ts`.
