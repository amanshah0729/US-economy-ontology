import { scaleLinear } from "d3-scale";
import { interpolateRdYlGn, interpolateYlGnBu } from "d3-scale-chromatic";

// Map a YoY real growth rate to a color on the RdYlGn scale.
// Domain clamped at ±5% so the color contrast stays useful.
const growthScale = scaleLinear<number, number>()
  .domain([-0.05, 0, 0.05])
  .range([0, 0.5, 1])
  .clamp(true);

export const GRAY = "#9ca3af"; // tailwind gray-400 — used for missing data

export function growthToColor(growth: number | null | undefined): string {
  if (growth == null || Number.isNaN(growth)) return GRAY;
  return interpolateRdYlGn(growthScale(growth));
}

// Mean annual wage → color. Light yellow-green at $30k → deep blue at $150k+.
// Sqrt-style perceptual stretch so the meaty $40k–$80k range gets contrast.
const wageScale = scaleLinear<number, number>()
  .domain([30_000, 60_000, 100_000, 150_000])
  .range([0.1, 0.35, 0.65, 0.95])
  .clamp(true);

export function wageToColor(wage: number | null | undefined): string {
  if (wage == null || Number.isNaN(wage)) return GRAY;
  return interpolateYlGnBu(wageScale(wage));
}

export const WAGE_LEGEND_STOPS = [30_000, 60_000, 100_000, 150_000] as const;
