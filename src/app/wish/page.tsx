"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { ColorSwatch, PageHeader } from "@/components/ui/Cards";
import { formatNumber, cn } from "@/lib/utils";

const ImageRecognizer = dynamic(
  () => import("@/components/wish/ImageRecognizer").then((m) => m.ImageRecognizer),
  { ssr: false, loading: () => <p className="text-sm opacity-60">加载识别组件…</p> }
);

type Color = { id: string; code: string; name: string; hex: string };
type Warehouse = { id: string; name: string; uniqueCode: string };

type ProjectItem = { id: string; quantity: number; color: Color };
type Project = {
  id: string;
  title: string;
  imageUrl: string | null;
  items: ProjectItem[];
};

type CheckResult = {
  sufficient: boolean;
  totalShortage: number;
  warehouseName: string;
  lines: { colorId: string; code: string; required: number; available: number; shortage: number; sufficient: boolean }[];
};

type DraftLine = { colorId: string; code: string; hex: string; quantity: number };

export default function WishPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseText, setParseText] = useState("");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [selectedColor, setSelectedColor] = useState("");
  const [draftQty, setDraftQty] = useState(1);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);

  const [warehouseSel, setWarehouseSel] = useState<Record<string, string>>({});
  const [checkResults, setCheckResults] = useState<Record<string, CheckResult>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadProjects = useCallback(() => {
    setLoading(true);
    fetch("/api/projects?status=WISH")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
    Promise.all([
      fetch("/api/warehouses").then((r) => r.json()),
      fetch("/api/colors").then((r) => r.json()),
    ]).then(([whs, cols]) => {
      setWarehouses(whs);
      setColors(cols);
    });
  }, [loadProjects]);

  const getWarehouseFor = (projectId: string) =>
    warehouseSel[projectId] ?? warehouses[0]?.id ?? "";

  const mergeDraftLines = (incoming: DraftLine[]) => {
    setDraftLines((prev) => {
      const map = new Map(prev.map((l) => [l.colorId, l]));
      for (const item of incoming) {
        const ex = map.get(item.colorId);
        if (ex) map.set(item.colorId, { ...ex, quantity: ex.quantity + item.quantity });
        else map.set(item.colorId, item);
      }
      return Array.from(map.values());
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setImportError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setImportError(data.error ?? "上传失败");
      return;
    }
    setImageUrl(data.url);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleParse = async () => {
    setImportError("");
    const res = await fetch("/api/projects/recognize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: parseText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error ?? "识别失败");
      return;
    }
    mergeDraftLines(
      data.pairs.map((p: { colorId: string; code: string; hex: string; quantity: number }) => ({
        colorId: p.colorId,
        code: p.code,
        hex: p.hex,
        quantity: p.quantity,
      }))
    );
    if (data.unknown?.length) {
      setImportError(`未识别的色号：${data.unknown.join("、")}`);
    }
  };

  const createProject = async () => {
    if (draftLines.length === 0) {
      setImportError("请添加所需豆子");
      return;
    }
    setImporting(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title || "未命名图纸",
        imageUrl,
        items: draftLines.map((l) => ({ colorId: l.colorId, quantity: l.quantity })),
      }),
    });
    setImporting(false);
    if (!res.ok) {
      const data = await res.json();
      setImportError(data.error ?? "创建失败");
      return;
    }
    setShowImport(false);
    setTitle("");
    setImageUrl(null);
    setParseText("");
    setDraftLines([]);
    loadProjects();
  };

  const runCheck = async (projectId: string) => {
    const whId = getWarehouseFor(projectId);
    if (!whId) return;
    setActionLoading(`check-${projectId}`);
    const res = await fetch(`/api/projects/${projectId}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouseId: whId }),
    });
    const data = await res.json();
    setActionLoading(null);
    if (res.ok) setCheckResults((prev) => ({ ...prev, [projectId]: data }));
  };

  const startBuild = async (projectId: string) => {
    const whId = getWarehouseFor(projectId);
    setActionLoading(`start-${projectId}`);
    const res = await fetch(`/api/projects/${projectId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouseId: whId }),
    });
    const data = await res.json();
    setActionLoading(null);
    if (!res.ok) {
      if (data.lines) setCheckResults((prev) => ({ ...prev, [projectId]: data }));
      alert(data.error ?? "无法开始");
      return;
    }
    router.push("/building");
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("确定删除此项目？")) return;
    await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    loadProjects();
  };

  const totalDraft = draftLines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div>
      <PageHeader
        eyebrow="WISHLIST"
        title="想拼"
        description="导入图纸、识别所需豆子，检查豆仓库存后可在「正在拼」中开拼。"
        action={
          <Button onClick={() => setShowImport(!showImport)}>
            {showImport ? "取消导入" : "+ 导入图纸"}
          </Button>
        }
      />

      {showImport && (
        <div className="color-block mb-8 bg-block-cream">
          <h2 className="mb-4 text-lg font-semibold">导入图纸</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <label className="block">
                <span className="eyebrow mb-1 block">图纸名称</span>
                <input
                  className="w-full rounded-md border border-hairline bg-canvas px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="我的拼豆图纸"
                />
              </label>
              <label className="block">
                <span className="eyebrow mb-1 block">上传图片</span>
                <input
                  type="file"
                  accept="image/*"
                  className="w-full text-sm"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
                {uploading && <p className="mt-1 text-sm opacity-60">上传中…</p>}
                {imageUrl && (
                  <>
                    <img
                      src={imageUrl}
                      alt="预览"
                      className="mt-2 max-h-48 rounded-md border border-hairline object-contain"
                    />
                    <div className="mt-4">
                      <ImageRecognizer imageUrl={imageUrl} onConfirm={mergeDraftLines} />
                    </div>
                  </>
                )}
              </label>
              <label className="block">
                <span className="eyebrow mb-1 block">粘贴材料清单文字（可选）</span>
                <textarea
                  className="h-28 w-full rounded-md border border-hairline bg-canvas px-3 py-2 text-sm"
                  placeholder={"A1 320\nB12 150\n320 C5"}
                  value={parseText}
                  onChange={(e) => setParseText(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2"
                  onClick={handleParse}
                  disabled={!parseText.trim()}
                >
                  识别文字清单
                </Button>
              </label>
            </div>
            <div>
              <p className="eyebrow mb-2">手动添加色号</p>
              <div className="mb-3 flex gap-2">
                <select
                  className="min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-2 py-2 text-sm"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                >
                  <option value="">选择色号</option>
                  {colors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="w-20 rounded-md border border-hairline px-2 py-2 text-sm"
                  value={draftQty}
                  onChange={(e) => setDraftQty(Number(e.target.value))}
                />
                <Button type="button" variant="secondary" onClick={() => {
                  const c = colors.find((x) => x.id === selectedColor);
                  if (c && draftQty > 0) {
                    mergeDraftLines([{ colorId: c.id, code: c.code, hex: c.hex, quantity: draftQty }]);
                    setDraftQty(1);
                  }
                }}>
                  添加
                </Button>
              </div>
              <p className="mb-2 text-sm opacity-60">
                {draftLines.length} 色 · {formatNumber(totalDraft)} 粒
              </p>
              <div className="max-h-52 overflow-y-auto rounded-md border border-hairline divide-y divide-hairline-soft">
                {draftLines.length === 0 ? (
                  <p className="p-4 text-center text-sm opacity-40">暂无材料</p>
                ) : (
                  draftLines.map((l) => (
                    <div key={l.colorId} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <ColorSwatch hex={l.hex} size="sm" />
                      <span className="flex-1 font-mono">{l.code}</span>
                      <span>{formatNumber(l.quantity)}</span>
                      <button
                        type="button"
                        className="opacity-40 hover:opacity-100"
                        onClick={() =>
                          setDraftLines((prev) => prev.filter((x) => x.colorId !== l.colorId))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
              <Button className="mt-4" onClick={createProject} disabled={importing}>
                {importing ? "创建中…" : "加入想拼"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="opacity-60">加载中…</p>
      ) : projects.length === 0 ? (
        <div className="color-block bg-block-lime text-center">
          <p className="mb-4">还没有想拼的图纸，点击上方导入吧。</p>
          <Button onClick={() => setShowImport(true)}>导入图纸</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const total = p.items.reduce((s, i) => s + i.quantity, 0);
            const check = checkResults[p.id];
            return (
              <div key={p.id} className="overflow-hidden rounded-lg border border-hairline bg-canvas">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt={p.title} className="h-40 w-full object-cover object-top" />
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm opacity-60">
                    {p.items.length} 色 · {formatNumber(total)} 粒
                  </p>
                  <div className="mt-4 space-y-3">
                    <select
                      className="w-full rounded-md border border-hairline px-3 py-2 text-sm"
                      value={getWarehouseFor(p.id)}
                      onChange={(e) =>
                        setWarehouseSel((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                    >
                      {warehouses.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} ({wh.uniqueCode})
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      className="w-full"
                      disabled={actionLoading === `check-${p.id}`}
                      onClick={() => runCheck(p.id)}
                    >
                      {actionLoading === `check-${p.id}` ? "检查中…" : "检查豆仓库存"}
                    </Button>
                    {check && (
                      <div
                        className={cn(
                          "rounded-md p-3 text-sm",
                          check.sufficient ? "bg-block-mint" : "bg-block-pink"
                        )}
                      >
                        {check.sufficient ? (
                          <p>✓ {check.warehouseName} 库存充足，可以开始拼！</p>
                        ) : (
                          <>
                            <p className="mb-2 font-medium">
                              库存不足，还需补 {formatNumber(check.totalShortage)} 粒
                            </p>
                            <Link href={`/warehouses/${getWarehouseFor(p.id)}`}>
                              <Button variant="secondary" className="w-full">
                                去补库存
                              </Button>
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                    <Button
                      className="w-full"
                      disabled={
                        actionLoading === `start-${p.id}` ||
                        (check !== undefined && !check.sufficient)
                      }
                      onClick={() => startBuild(p.id)}
                    >
                      {actionLoading === `start-${p.id}` ? "处理中…" : "开始拼"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-center text-xs opacity-40 hover:opacity-70"
                      onClick={() => deleteProject(p.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
