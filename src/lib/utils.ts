import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const nanoid = customAlphabet(alphabet, 6);

export function generateWarehouseCode(): string {
  return `WH-${nanoid()}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

function parseColorCode(code: string): { series: string; num: number } {
  const match = code.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return { series: code, num: 0 };
  return { series: match[1].toUpperCase(), num: parseInt(match[2], 10) };
}

/** MARD 色号自然排序：A1, A2, …, A10, A26, B1 … */
export function compareColorCode(a: string, b: string): number {
  const pa = parseColorCode(a);
  const pb = parseColorCode(b);
  const seriesCmp = pa.series.localeCompare(pb.series);
  if (seriesCmp !== 0) return seriesCmp;
  return pa.num - pb.num;
}

/** 从色号提取系列，如 A1 → A，ZG5 → ZG */
export function parseColorSeries(code: string): string {
  const match = code.trim().match(/^([A-Za-z]+)\d+$/);
  return match ? match[1].toUpperCase() : code.trim().slice(0, 1).toUpperCase() || "X";
}
