export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues
    image.src = url;
  });

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0
): Promise<string | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box of the rotated image
  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));

  // Set canvas size to match the bounding box
  canvas.width = safeArea;
  canvas.height = safeArea;

  // Translate canvas context to a central location to allow rotating around the center
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate(rotRad);
  ctx.translate(-safeArea / 2, -safeArea / 2);

  // Draw rotated image
  ctx.drawImage(
    image,
    safeArea / 2 - image.width / 2,
    safeArea / 2 - image.height / 2
  );

  // Extract the cropped image using pixelCrop values
  const data = ctx.getImageData(
    Math.round(safeArea / 2 - image.width / 2 + pixelCrop.x),
    Math.round(safeArea / 2 - image.height / 2 + pixelCrop.y),
    Math.round(pixelCrop.width),
    Math.round(pixelCrop.height)
  );

  // Set canvas width to final desired crop size
  canvas.width = Math.round(pixelCrop.width);
  canvas.height = Math.round(pixelCrop.height);

  // Paste generated rotate image at the top left corner
  ctx.putImageData(data, 0, 0);

  // Dùng image/jpeg với quality 1.0 (100%) để giữ nguyên chất lượng ảnh, tránh lỗi dung lượng PNG quá lớn
  return canvas.toDataURL('image/jpeg', 1.0);
}
