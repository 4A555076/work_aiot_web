const path = require('path');
const multer = require('multer');

/** 建立可設定目的地、欄位、檔名及大小限制的圖片上傳 middleware。 */
function uploadCreateImageMiddleware({
  destination,
  fields,
  filename = (file) => `${file.fieldname}${path.extname(file.originalname).toLowerCase()}`,
  maxFileSize = 20 * 1024 * 1024,
  additionalExtensions = ['.heic', '.heif'],
} = {}) {
  if (!destination) throw new TypeError('destination is required');
  if (!Array.isArray(fields) || fields.length === 0) throw new TypeError('fields is required');

  const storage = multer.diskStorage({
    destination: (request, file, callback) => callback(null, destination),
    filename: (request, file, callback) => callback(null, filename(file, request)),
  });
  const upload = multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter: (request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const allowed =
        file.mimetype.startsWith('image/') || additionalExtensions.includes(extension);
      callback(allowed ? null : new Error('Only image files are allowed'), allowed);
    },
  });

  return upload.fields(
    fields.map((field) =>
      typeof field === 'string' ? { name: field, maxCount: 1 } : field,
    ),
  );
}

/** 將 callback 型 middleware 包裝成可 await 的 Promise。 */
function uploadRunMiddleware(middleware, req, res) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (error) => (error ? reject(error) : resolve()));
  });
}

module.exports = { uploadCreateImageMiddleware, uploadRunMiddleware };
