# Dashboard API v2

Dashboard API 依資料來源分成兩組，所有端點皆使用 `POST` 並經過 token 驗證。

- 一般測站：`/aiot/stations/dashboard/*`，定義於 `chartRoutes.js`
- EPA/TAQMN：`/aiot/open-data/dashboard/*`，定義於 `chartRoutes.js`

## 獨立端點

| 功能 | 一般測站 | EPA |
| --- | --- | --- |
| 即時數據 | `/stations/dashboard/realtime` | `/open-data/dashboard/realtime` |
| 折線圖 | `/stations/dashboard/line` | `/open-data/dashboard/line` |
| 盒鬚圖 | `/stations/dashboard/boxplot` | `/open-data/dashboard/boxplot` |
| 熱點圖 | `/stations/dashboard/heatmap` | `/open-data/dashboard/heatmap` |
| 風瑰圖 | `/stations/dashboard/wind-rose` | `/open-data/dashboard/wind-rose` |
| 風向風速圖 | `/stations/dashboard/wind-vector` | `/open-data/dashboard/wind-vector` |
| 資料表 | `/stations/dashboard/table` | `/open-data/dashboard/table` |
| 日報表 | `/stations/dashboard/daily-report` | `/open-data/dashboard/daily-report` |
| 月報表 | `/stations/dashboard/monthly-report` | `/open-data/dashboard/monthly-report` |

一般測站請求帶 `PJID`、`STID`；圖表另帶 `startDateTime`、`endDateTime`、`type`。EPA 請求只需要 `STID` 與時間範圍，後端固定使用 `T60`。

資料表與月報表可帶 `modelTypes` 陣列篩選多個測項；日報表使用 `modelType` 篩選單一測項。未提供篩選條件時保留回傳全部測項的相容行為（日報表仍需指定測項）。
一般測站的數值與筆數為獨立選項，例如 `PM2.5` 與 `PM2.5 (Count)`，可分別或同時查詢。

## 回傳責任

- `realtime`：測站、測項與最新五筆資料。
- `line`：`models`、`line`、`history`。
- `boxplot`：`models`、`boxplots`。
- `heatmap`：`models`、`heatmaps`。
- `wind-rose`：風速級距、16 方位分布與總筆數。
- `wind-vector`：時間、風速、風向資料點。
- 三種報表只回傳各自的 rows。
