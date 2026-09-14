# Reusable utilities

此資料夾只放不依賴專案資料表、網路路徑、環境變數或 route 狀態的共用工具。複製到其他 CommonJS 專案後，可按需求個別引用。

函式統一使用「領域前綴 + 動作 + 對象」格式，例如 `dateFormatLocal`、`fileEnsureDirectory`、`cryptoEncryptText`。看到名稱即可判斷工具所屬領域與用途。

## Modules

- `cryptoUtils.js`：RSA 加解密、金鑰產生與雜湊。金鑰生命週期完全由呼叫端管理。
- `dateUtils.js`：日期格式、時間比較、時間區間對齊及取樣步距推斷。
- `fileUtils.js`：建立資料夾、刪除檔案及依檔名重新命名物件欄位。
- `formatUtils.js`：化學式字元與小數格式轉換。
- `geoUtils.js`：座標距離計算。
- `idUtils.js`：可設定前綴、日期粒度與流水號長度的 ID 產生器。
- `uploadUtils.js`：可設定目的地、欄位、檔名及大小限制的圖片上傳 middleware。

## External dependency

只有 `uploadUtils.js` 需要額外安裝 `multer`。其他模組僅使用 Node.js 內建 API 或純 JavaScript。

專案專屬設定應留在呼叫端，例如資料庫查詢、資料表名稱、上傳根目錄、Express 的錯誤回應與紀錄方式。
