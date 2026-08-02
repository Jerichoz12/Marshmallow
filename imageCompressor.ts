export async function compressImageFile(
  file: File,
  maxWidth = 1024,
  maxHeight = 1024,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If not an image or is an animated gif/svg, read as raw data URL
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type.includes('svg')) {
      const reader = new FileReader();
      reader.onerror = (err) => reject(err);
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = (err) => reject(err);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        // Fallback to raw reader output if image loading fails
        resolve(e.target?.result as string);
      };
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
