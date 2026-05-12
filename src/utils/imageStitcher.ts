import { createImage } from './cropImage';

export async function stitchImages(files: File[]): Promise<string | null> {
  if (files.length === 0) return null;

  try {
    // 1. Tải toàn bộ file ảnh thành dạng HTMLImageElement
    const images: HTMLImageElement[] = [];
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const img = await createImage(url);
      images.push(img);
      URL.revokeObjectURL(url);
    }

    if (images.length === 0) return null;

    // 2. Tính toán số dòng, số cột để "vuông vức" nhất
    const count = images.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    // 3. Lấy kích thước của ảnh đầu tiên làm kích thước chuẩn cho các ô (cells)
    const cellW = images[0].width;
    const cellH = images[0].height;

    // 4. Tạo Canvas chứa toàn bộ các ảnh
    const canvas = document.createElement('canvas');
    canvas.width = cols * cellW;
    canvas.height = rows * cellH;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return null;

    // Phủ nền trắng (cho những chỗ thừa nếu có)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Kích hoạt chất lượng làm mịn cao
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 5. Vẽ từng ảnh vào đúng vị trí ô lưới (grid)
    images.forEach((img, index) => {
      // Xác định vị trí hàng và cột của ảnh hiện tại
      const r = Math.floor(index / cols);
      const c = index % cols;

      // Tính số lượng ảnh ở hàng hiện tại để căn giữa nếu hàng không đủ ảnh
      const itemsInThisRow = Math.min(cols, count - r * cols);
      const emptySpaceCols = cols - itemsInThisRow;
      const offsetX = (emptySpaceCols * cellW) / 2; // Căn giữa

      const dx = offsetX + c * cellW;
      const dy = r * cellH;

      // Xử lý cắt cúp tự động (object-fit: cover) để lấp đầy ô chuẩn
      const imgRatio = img.width / img.height;
      const cellRatio = cellW / cellH;

      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

      if (imgRatio > cellRatio) {
        // Ảnh gốc rộng hơn ô chuẩn -> Cắt bỏ 2 bên
        sWidth = img.height * cellRatio;
        sx = (img.width - sWidth) / 2;
      } else {
        // Ảnh gốc cao hơn ô chuẩn -> Cắt bỏ trên dưới
        sHeight = img.width / cellRatio;
        sy = (img.height - sHeight) / 2;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, cellW, cellH);
    });

    // 6. Trả về định dạng JPEG chất lượng cao
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (error) {
    console.error("Error stitching images:", error);
    return null;
  }
}
