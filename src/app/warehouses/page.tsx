"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/Cards";

type Warehouse = {
  id: string;
  name: string;
  uniqueCode: string;
  defaultQty: number;
  description: string | null;
  createdAt: string;
  _count: { stocks: number };
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [defaultQty, setDefaultQty] = useState(1000);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then(setWarehouses)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, defaultQty, description }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "创建失败");
      return;
    }
    setName("");
    setDefaultQty(1000);
    setDescription("");
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string, whName: string) => {
    if (!confirm(`确定删除「${whName}」？此操作不可恢复。`)) return;
    await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="WAREHOUSES"
        title="豆仓管理"
        description="创建多个拼豆仓库，每个仓库拥有唯一识别码，初始化 221 色 MARD 标准库存。"
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/restock">补豆</ButtonLink>
            <ButtonLink href="/consume">拼豆</ButtonLink>
            <ButtonLink href="/colors">色号</ButtonLink>
            <Button variant={showForm ? "secondary" : "primary"} onClick={() => setShowForm(!showForm)}>
              {showForm ? "取消" : "+ 新建豆仓"}
            </Button>
          </div>
        }
      />

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="color-block mb-8 bg-block-lime"
        >
          <h2 className="mb-4 text-lg font-semibold">新建豆仓</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="eyebrow mb-1 block">名称</span>
              <input
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-3"
                placeholder="例如：豆仓 1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">每色默认库存（粒）</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-3"
                value={defaultQty}
                onChange={(e) => setDefaultQty(Number(e.target.value))}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="eyebrow mb-1 block">备注（可选）</span>
              <input
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-3"
                placeholder="存放位置、用途等"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "创建中…" : "创建并初始化 221 色"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="opacity-60">加载中…</p>
      ) : warehouses.length === 0 ? (
        <div className="color-block bg-block-cream text-center">
          <p>暂无豆仓，点击上方按钮创建。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              className="flex flex-col gap-3 rounded-lg border border-hairline p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="eyebrow opacity-60">{wh.uniqueCode}</p>
                <Link href={`/warehouses/${wh.id}`} className="text-lg font-bold hover:underline">
                  {wh.name}
                </Link>
                {wh.description && (
                  <p className="mt-1 text-sm opacity-60">{wh.description}</p>
                )}
                <p className="mt-1 text-sm opacity-50">
                  {wh._count.stocks} 色号 · 默认 {wh.defaultQty} 粒/色
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/warehouses/${wh.id}`}>查看库存</ButtonLink>
                <Button variant="secondary" onClick={() => handleDelete(wh.id, wh.name)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
