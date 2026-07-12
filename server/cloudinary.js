const cloudinary = require('cloudinary').v2; // auto-configures from the CLOUDINARY_URL env var

// file: a local filesystem path (migration script) or a `data:<mime>;base64,...` URI (routes).
// Cloudinary's upload() accepts both directly.
async function uploadImage(file, publicId) {
  const result = await cloudinary.uploader.upload(file, { public_id: publicId });
  return result.secure_url;
}

// Re-derives the public_id from a secure_url so no extra schema field is needed to track it.
function publicIdFromUrl(url) {
  const match = /\/upload\/(?:v\d+\/)?(.+)\.[^./]+$/.exec(url);
  return match ? match[1] : null;
}

// Best-effort: a deletion failure must never surface as an error to the caller.
async function deleteImage(imageUrl) {
  const publicId = publicIdFromUrl(imageUrl);
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch {
    // ignore
  }
}

module.exports = { uploadImage, deleteImage };
