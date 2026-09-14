const fs = require('fs');
const path = require('path');

const FILE_DEFAULT_IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp'];


// 確保指定資料夾存在，必要時遞迴建立
async function fileEnsureDirectory(directoryPath) {
  await fs.promises.mkdir(directoryPath, { recursive: true });
  return directoryPath;
}


// 將資料中的檔案路徑欄位改以檔名作為鍵名
function fileRenamePathKeys(records, { extensions = FILE_DEFAULT_IMAGE_EXTENSIONS, capitalize = true } = {}) {
  const extensionPattern = new RegExp(`\\.(${extensions.join('|')})$`, 'i');

  return records.map((record) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => {
        if (typeof value !== 'string' || !extensionPattern.test(value)) return [key, value];

        const parsedName = path.parse(value.replace(/\\/g, '/')).name;
        const nextKey = capitalize
          ? parsedName.replace(/^./, (character) => character.toUpperCase())
          : parsedName;
        return [nextKey, value];
      }),
    ),
  );
}


// 批次刪除檔案，並支援忽略不存在檔案與自訂錯誤處理
async function fileRemoveAll(files, { ignoreMissing = true, onError } = {}) {
  await Promise.all(
    files.map(async (file) => {
      const filePath = typeof file === 'string' ? file : file?.path;
      if (!filePath) return;

      try {
        await fs.promises.unlink(filePath);
      } catch (error) {
        if (ignoreMissing && error.code === 'ENOENT') return;
        if (onError) {
          onError(error, filePath);
          return;
        }
        throw error;
      }
    }),
  );
}

module.exports = {
  FILE_DEFAULT_IMAGE_EXTENSIONS,
  fileEnsureDirectory,
  fileRemoveAll,
  fileRenamePathKeys,
};
