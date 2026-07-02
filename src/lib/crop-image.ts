export type CropRect = {
  /** 相对原图宽高的比例 0~1 */
  x: number;
  y: number;
  w: number;
  h: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 按原图比例裁剪，返回 PNG data URL */
export async function cropImageByRect(imageUrl: string, rect: CropRect): Promise<string> {
  const img = await loadImage(imageUrl);
  const sx = Math.max(0, Math.floor(rect.x * img.width));
  const sy = Math.max(0, Math.floor(rect.y * img.height));
  const sw = Math.min(img.width - sx, Math.floor(rect.w * img.width));
  const sh = Math.min(img.height - sy, Math.floor(rect.h * img.height));

  if (sw < 10 || sh < 10) {
    throw new Error("选区太小，请重新框选");
  }

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/png");
}
