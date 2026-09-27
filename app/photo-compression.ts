/** Resize locally before upload; no original image is sent to the server. */
export async function compressPhoto(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('写真を読み込めません。JPEG・PNG・WebP形式の写真を選び直してください。'));
      image.src = url;
    });
    const {naturalWidth: width, naturalHeight: height} = image;
    if (!width || !height) throw new Error('写真のサイズを読み込めませんでした。');
    const scale = Math.min(1, 1600 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('写真を圧縮できませんでした。もう一度お試しください。');
    // JPEG has no alpha channel. Composite transparent inputs onto white.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('写真を圧縮できませんでした。')), 'image/jpeg', 0.8);
    });
    if (blob.type !== 'image/jpeg' || !blob.size || blob.size > 8 * 1024 * 1024) {
      throw new Error('写真を保存できるサイズに圧縮できませんでした。別の写真を選んでください。');
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg', lastModified: file.lastModified});
  } finally {
    URL.revokeObjectURL(url);
    image.src = '';
    canvas.width = canvas.height = 0;
  }
}
