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

/** 按原图比例裁剪，带少量边距避免边框文字被切掉 */
export async function cropImageByRect(imageUrl: string, rect: CropRect): Promise<string> {
  const img = await loadImage(imageUrl);
  const padX = Math.max(6, Math.round(img.width * 0.006));
  const padY = Math.max(6, Math.round(img.height * 0.006));

  const sx = Math.max(0, Math.floor(rect.x * img.width) - padX);
  const sy = Math.max(0, Math.floor(rect.y * img.height) - padY);
  const ex = Math.min(img.width, Math.ceil((rect.x + rect.w) * img.width) + padX);
  const ey = Math.min(img.height, Math.ceil((rect.y + rect.h) * img.height) + padY);
  const sw = ex - sx;
  const sh = ey - sy;

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
