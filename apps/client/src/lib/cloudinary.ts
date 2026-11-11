export async function uploadImages(files: File[]) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error('Upload ảnh cần cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET.');
  }

  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      throw new Error('Chỉ hỗ trợ ảnh tối đa 10 MB mỗi ảnh.');
    }
    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', uploadPreset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body });
    if (!response.ok) throw new Error('Cloudinary không thể tải ảnh lên. Kiểm tra cấu hình upload preset.');
    const result = await response.json();
    if (typeof result.secure_url !== 'string') throw new Error('Dịch vụ ảnh không trả về URL hợp lệ.');
    urls.push(result.secure_url);
  }
  return urls;
}
