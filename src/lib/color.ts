import { scaleLinear } from "d3-scale";
import { interpolateRdYlGn } from "d3-scale-chromatic";

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
