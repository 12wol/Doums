"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Cards";
import { formatNumber } from "@/lib/utils";

type Project = {
  id: string;
  title: string;
  imageUrl: string | null;
  startedAt: string | null;
  items: { quantity: number }[];
  warehouse: { name: string } | null;
};

export default function BuildingPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/projects?status=BUILDING")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completeBuild = async (projectId: string) => {
    if (!confirm("确认拼完了？将自动从豆仓扣除对应库存。")) return;
    setActionLoading(projectId);
    const res = await fetch(`/api/projects/${projectId}/complete`, { method: "POST" });
    setActionLoading(null);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "操作失败");
      return;
    }
    router.push("/completed");
  };

  return (
    <div>
      <PageHeader
        eyebrow="BUILDING"
        title="正在拼"
        description="从「想拼」开始的项目会出现在这里，拼完后自动扣减库存并移入「拼完了」。"
      />

      {loading ? (
        <p className="opacity-60">加载中…</p>
      ) : projects.length === 0 ? (
        <div className="color-block bg-block-mint text-center">
          <p>当前没有正在拼的项目。去「想拼」选一张图纸开始吧。</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const total = p.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <div
                key={p.id}
                className="overflow-hidden rounded-lg border border-hairline bg-canvas"
              >
                <div className="aspect-[3/4] w-full bg-surface-soft">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm opacity-40">
                      无预览图
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm opacity-60">
                    {p.items.length} 色 · {formatNumber(total)} 粒
                    {p.warehouse && ` · ${p.warehouse.name}`}
                  </p>
                  {p.startedAt && (
                    <p className="mt-1 text-xs opacity-40">
                      开始于 {new Date(p.startedAt).toLocaleString("zh-CN")}
                    </p>
                  )}
                  <Button
                    className="mt-4 w-full"
                    disabled={actionLoading === p.id}
                    onClick={() => completeBuild(p.id)}
                  >
                    {actionLoading === p.id ? "处理中…" : "拼完了"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
