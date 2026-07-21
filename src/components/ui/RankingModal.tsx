"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ColorSwatch } from "@/components/ui/Cards";
import { cn, formatNumber } from "@/lib/utils";

export type RankItem = {
  code: string;
  hex: string;
  name?: string;
  value: number;
  hint?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  items: RankItem[];
  valueLabel?: string;
  emptyText?: string;
  /** list=列表；bars=柱状图（余量排行） */
  variant?: "list" | "bars";
  /** bars 模式下按余量给数量上色 */
  stockThresholds?: boolean;
  /** 多豆仓切换 */
  warehouseTabs?: { id: string; name: string }[];
  activeWarehouseId?: string;
  onWarehouseChange?: (id: string) => void;
  onClose: () => void;
};

function qtyClass(value: number, useThresholds: boolean) {
  if (!useThresholds) return "text-ink";
  if (value < 200) return "text-red-600 font-semibold";
  if (value < 400) return "text-amber-600 font-semibold";
  return "text-ink/70";
}

export function RankingModal({
  title,
  subtitle,
  items,
  valueLabel = "粒",
  emptyText = "暂无数据",
  variant = "list",
  stockThresholds = false,
  warehouseTabs,
  activeWarehouseId,
  onWarehouseChange,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const maxValue = useMemo(
    () => Math.max(1, ...items.map((i) => i.value)),
    [items]
  );

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-canvas sm:rounded-2xl",
          variant === "bars" ? "max-w-5xl" : "max-w-lg"
        )}
      >
        <div className="flex shrink-0 flex-col gap-3 border-b border-hairline px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {subtitle && <p className="mt-0.5 text-sm opacity-55">{subtitle}</p>}
              {variant === "bars" && stockThresholds && (
                <p className="mt-1 text-xs opacity-45">
                  柱色=色号色 · &lt;200 红 · &lt;400 黄 · 其余正常 · 从少到多
                </p>
              )}
            </div>
            <button
              type="button"
              className="rounded-pill px-3 py-1.5 text-sm opacity-50 hover:bg-surface-soft hover:opacity-100"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
          {warehouseTabs && warehouseTabs.length > 1 && onWarehouseChange && (
            <div className="flex flex-wrap gap-1.5">
              {warehouseTabs.map((wh) => (
                <button
                  key={wh.id}
                  type="button"
                  className={cn(
                    "rounded-pill px-3 py-1.5 text-sm",
                    activeWarehouseId === wh.id
                      ? "bg-ink text-on-primary"
                      : "bg-surface-soft text-ink/70 hover:bg-hairline-soft"
                  )}
                  onClick={() => onWarehouseChange(wh.id)}
                >
                  {wh.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm opacity-50">{emptyText}</p>
          ) : variant === "bars" ? (
            <div className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {items.map((item, idx) => {
                const pct = Math.max(4, Math.round((item.value / maxValue) * 100));
                return (
                  <div
                    key={`${item.code}-${idx}`}
                    className="flex flex-col items-center"
                    title={`${item.code} · ${formatNumber(item.value)} ${valueLabel}`}
                  >
                    <div className="flex h-28 w-full items-end justify-center">
                      <div
                        className="w-[70%] max-w-8 rounded-t-sm border border-black/10 shadow-sm"
                        style={{
                          height: `${pct}%`,
                          backgroundColor: item.hex || "#ccc",
                          minHeight: item.value === 0 ? 2 : undefined,
                        }}
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-[10px] leading-none opacity-70 sm:text-xs">
                      {item.code}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] tabular-nums leading-none sm:text-xs",
                        qtyClass(item.value, stockThresholds)
                      )}
                    >
                      {formatNumber(item.value)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <ol className="-mx-4 divide-y divide-hairline-soft sm:-mx-5">
              {items.map((item, idx) => (
                <li key={`${item.code}-${idx}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-7 shrink-0 text-sm font-medium opacity-40 tabular-nums">
                    {idx + 1}
                  </span>
                  <ColorSwatch hex={item.hex} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-medium">{item.code}</p>
                    {item.hint && <p className="text-xs opacity-50">{item.hint}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatNumber(item.value)}
                    <span className="ml-0.5 font-normal opacity-45">{valueLabel}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
