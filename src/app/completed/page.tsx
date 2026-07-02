"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/Cards";
import { formatNumber } from "@/lib/utils";

type Project = {
  id: string;
  title: string;
  imageUrl: string | null;
  completedAt: string | null;
  items: { quantity: number }[];
  warehouse: { name: string } | null;
};

export default function CompletedPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/projects?status=COMPLETED")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        eyebrow="GALLERY"
        title="拼完了"
        description="已完成的作品集。通过「拼豆」导入图纸扣减库存后也会自动收录在此。"
      />

      {loading ? (
        <p className="opacity-60">加载中…</p>
      ) : projects.length === 0 ? (
        <div className="color-block bg-block-lilac text-center">
          <p>还没有完成的作品。完成「正在拼」或通过「拼豆」扣减库存后会出现在这里。</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {projects.map((p) => {
            const total = p.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <article
                key={p.id}
                className="group overflow-hidden rounded-lg border border-hairline bg-canvas transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
              >
                <div className="aspect-[3/4] w-full overflow-hidden bg-surface-soft">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-xs opacity-40">
                      {p.title}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="truncate text-sm font-semibold">{p.title}</h3>
                  <p className="mt-0.5 text-xs opacity-60">
                    {p.items.length} 色 · {formatNumber(total)} 粒
                  </p>
                  {p.warehouse && (
                    <p className="mt-0.5 truncate text-xs opacity-40">{p.warehouse.name}</p>
                  )}
                  {p.completedAt && (
                    <p className="mt-1 text-xs opacity-40">
                      {new Date(p.completedAt).toLocaleDateString("zh-CN")}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
