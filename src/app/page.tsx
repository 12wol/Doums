"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PageHeader, StatCard } from "@/components/ui/Cards";
import { formatNumber } from "@/lib/utils";

type DashboardData = {
  grandTotal: number;
  warehouseCount: number;
  colorCount: number;
  warehouses: {
    id: string;
    name: string;
    uniqueCode: string;
    totalQty: number;
    lowStock: number;
    emptyStock: number;
    consumptionCount: number;
    seriesTotals: Record<string, number>;
  }[];
  recentConsumptions: {
    id: string;
    note: string | null;
    createdAt: string;
    warehouseName: string;
    totalBeads: number;
    colorCount: number;
  }[];
};

const SERIES_COLORS: Record<string, string> = {
  A: "#dceeb1",
  B: "#c8e6cd",
  C: "#c5b0f4",
  D: "#efd4d4",
  E: "#f3c9b6",
  F: "#f4ecd6",
  G: "#fec993",
  H: "#e6e6e6",
  M: "#d1ccaf",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="opacity-60">加载中…</p>;
  }

  if (!data) {
    return <p className="text-red-600">加载失败</p>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="INVENTORY"
        title="豆仓仪表盘"
        description="查看所有拼豆仓库的总库存、低库存预警与最近消耗记录。"
        action={
          <Link href="/warehouses">
            <Button>库存管理</Button>
          </Link>
        }
      />

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="总库存" value={formatNumber(data.grandTotal)} hint="全部豆仓合计（粒）" block="lime" />
        <StatCard label="豆仓数" value={data.warehouseCount} hint={`${data.colorCount} 个 MARD 色号`} block="lilac" />
        <StatCard
          label="低库存色号"
          value={data.warehouses.reduce((s, w) => s + w.lowStock, 0)}
          hint="库存 &lt; 200 粒"
          block="pink"
        />
      </div>

      {data.warehouseCount === 0 ? (
        <div className="color-block bg-block-cream text-center">
          <p className="mb-4 text-lg">还没有豆仓，创建第一个开始管理库存吧。</p>
          <Link href="/warehouses">
            <Button>创建豆仓</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">各豆仓概览</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.warehouses.map((wh) => (
              <Link
                key={wh.id}
                href={`/warehouses/${wh.id}`}
                className="rounded-lg border border-hairline bg-canvas p-6 transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="eyebrow opacity-60">{wh.uniqueCode}</p>
                    <h3 className="text-xl font-bold">{wh.name}</h3>
                  </div>
                  <span className="text-2xl font-semibold">{formatNumber(wh.totalQty)}</span>
                </div>
                <div className="mb-3 flex h-3 overflow-hidden rounded-full">
                  {Object.entries(wh.seriesTotals).map(([series, qty]) => {
                    const pct = wh.totalQty > 0 ? (qty / wh.totalQty) * 100 : 0;
                    if (pct < 0.5) return null;
                    return (
                      <div
                        key={series}
                        style={{ width: `${pct}%`, backgroundColor: SERIES_COLORS[series] ?? "#ccc" }}
                        title={`${series} 系 ${formatNumber(qty)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-4 text-sm opacity-70">
                  <span>低库存 {wh.lowStock}</span>
                  <span>缺货 {wh.emptyStock}</span>
                  <span>消耗 {wh.consumptionCount} 次</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.recentConsumptions.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">最近消耗</h2>
          <div className="divide-y divide-hairline-soft rounded-lg border border-hairline">
            {data.recentConsumptions.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{c.warehouseName}</span>
                  <span className="mx-2 opacity-40">·</span>
                  <span>{c.colorCount} 色 / {formatNumber(c.totalBeads)} 粒</span>
                  {c.note && <span className="ml-2 opacity-60">— {c.note}</span>}
                </div>
                <time className="opacity-50">
                  {new Date(c.createdAt).toLocaleString("zh-CN")}
                </time>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
