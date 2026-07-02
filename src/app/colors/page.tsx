"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ColorSwatch, PageHeader } from "@/components/ui/Cards";
import { SeriesFilter } from "@/components/colors/SeriesFilter";
import { parseColorSeries } from "@/lib/utils";

type Color = {
  id: string;
  code: string;
  name: string;
  hex: string;
  series: string;
  imageUrl: string | null;
};

type FormState = {
  id?: string;
  code: string;
  name: string;
  hex: string;
  series: string;
  imageUrl: string | null;
  initialQty: number;
};

const emptyForm = (): FormState => ({
  code: "",
  name: "",
  hex: "#000000",
  series: "",
  imageUrl: null,
  initialQty: 0,
});

export default function ColorsPage() {
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [isCreate, setIsCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);

  const load = (s?: string, q?: string) => {
    const params = new URLSearchParams();
    if (s) params.set("series", s);
    if (q) params.set("q", q);
    fetch(`/api/colors?${params}`)
      .then((r) => r.json())
      .then(setColors)
      .finally(() => setLoading(false));
  };

  const loadSeries = useCallback(() => {
    fetch("/api/colors/series")
      .then((r) => r.json())
      .then(setSeriesOptions);
  }, []);

  useEffect(() => {
    load(series, search);
  }, [series, search]);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const openCreate = () => {
    setForm(emptyForm());
    setIsCreate(true);
    setError("");
  };

  const openEdit = (c: Color) => {
    setForm({
      id: c.id,
      code: c.code,
      name: c.name,
      hex: c.hex,
      series: c.series,
      imageUrl: c.imageUrl,
      initialQty: 0,
    });
    setIsCreate(false);
    setError("");
  };

  const closeForm = () => {
    setForm(null);
    setError("");
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError("");

    if (isCreate) {
      const code = form.code.trim().toUpperCase();
      const res = await fetch("/api/colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name: form.name.trim() || code,
          hex: form.hex,
          series: form.series.trim() || parseColorSeries(code),
          imageUrl: form.imageUrl,
          initialQty: form.initialQty,
        }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok) {
        setError(data.error ?? "创建失败");
        return;
      }
    } else {
      const res = await fetch(`/api/colors/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          hex: form.hex,
          imageUrl: form.imageUrl,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "保存失败");
        return;
      }
    }

    closeForm();
    load(series, search);
    loadSeries();
  };

  const handleDelete = async () => {
    if (!form?.id || isCreate) return;
    if (
      !confirm(
        `确定删除色号「${form.code}」？\n将同时移除所有豆仓中该色号的库存，以及消耗记录里的相关明细。`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    const res = await fetch(`/api/colors/${form.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "删除失败");
      return;
    }
    closeForm();
    load(series, search);
    loadSeries();
  };

  const updateCode = (code: string) => {
    const upper = code.toUpperCase();
    setForm((prev) =>
      prev
        ? {
            ...prev,
            code: upper,
            series: prev.series || parseColorSeries(upper),
          }
        : prev
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="COLORS"
        title="色号管理"
        description="基于 MARD 221 色标准色卡，可新建自定义色号，或编辑名称、HEX 颜色与配图。"
        action={
          <Button onClick={form && isCreate ? closeForm : openCreate}>
            {form && isCreate ? "取消" : "+ 新建色号"}
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="flex-1 rounded-md border border-hairline px-3 py-2.5"
          placeholder="搜索色号或名称…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SeriesFilter series={series} options={seriesOptions} onChange={setSeries} />
      </div>

      {form && (
        <div className="color-block mb-6 bg-block-lilac">
          <h2 className="mb-4 font-semibold">{isCreate ? "新建色号" : `编辑 ${form.code}`}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="eyebrow mb-1 block">色号</span>
              <input
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-mono disabled:opacity-60"
                placeholder="如 P1、ZG3"
                value={form.code}
                onChange={(e) => updateCode(e.target.value)}
                disabled={!isCreate}
                required
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">显示名称</span>
              <input
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">系列</span>
              <input
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-mono uppercase"
                placeholder="自动从色号识别"
                value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value.toUpperCase() })}
                disabled={!isCreate}
              />
            </label>
            <label className="block">
              <span className="eyebrow mb-1 block">HEX 颜色</span>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-hairline bg-canvas px-3 py-2 font-mono"
                  value={form.hex}
                  onChange={(e) => setForm({ ...form, hex: e.target.value })}
                />
                <ColorSwatch hex={form.hex} />
              </div>
            </label>
            <label className="block md:col-span-2">
              <span className="eyebrow mb-1 block">配图 URL（可选）</span>
              <input
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2"
                placeholder="https://..."
                value={form.imageUrl ?? ""}
                onChange={(e) =>
                  setForm({ ...form, imageUrl: e.target.value || null })
                }
              />
            </label>
            {isCreate && (
              <label className="block">
                <span className="eyebrow mb-1 block">初始库存（粒/豆仓）</span>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-hairline bg-canvas px-3 py-2"
                  value={form.initialQty}
                  onChange={(e) =>
                    setForm({ ...form, initialQty: Math.max(0, Number(e.target.value)) })
                  }
                />
                <p className="mt-1 text-xs opacity-60">填 0 则使用各豆仓的默认库存值</p>
              </label>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving || deleting || (isCreate && !form.code.trim())}>
              {saving ? "保存中…" : isCreate ? "创建" : "保存"}
            </Button>
            <Button variant="secondary" onClick={closeForm} disabled={saving || deleting}>
              取消
            </Button>
            {!isCreate && (
              <Button
                variant="secondary"
                className="text-red-600"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                {deleting ? "删除中…" : "删除色号"}
              </Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <p className="opacity-60">加载中…</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {colors.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openEdit(c)}
              className="rounded-md border border-hairline p-3 text-left transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
            >
              {c.imageUrl ? (
                <img
                  src={c.imageUrl}
                  alt={c.code}
                  className="mb-2 h-10 w-full rounded-md object-cover"
                />
              ) : (
                <div
                  className="mb-2 h-10 w-full rounded-md border border-hairline"
                  style={{ backgroundColor: c.hex }}
                />
              )}
              <p className="font-mono text-sm font-medium">{c.code}</p>
              <p className="truncate text-xs opacity-60">{c.name}</p>
              <p className="font-mono text-xs opacity-40">{c.hex}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
