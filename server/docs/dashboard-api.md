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

## 報表查詢契約

六個報表端點共用相同的參數驗證規則：

- 開始、結束時間必須是有效時間，且結束時間不可早於開始時間。
- 一般測站必須提供 `PJID` 與 `STID`；EPA 必須提供 `STID`。
- 資料表的 `timeType` 僅接受 `T01`、`T05` 或 `T60`。
- EPA 與日報表的時間類型由後端固定為 `T60`。
- 日報表必須提供單一 `modelType`；`modelTypes` 會移除空值與重複值。

驗證失敗回傳 HTTP `400`：

```json
{
  "success": false,
  "code": "INVALID_REPORT_FILTERS",
  "message": "報表查詢條件不完整或無效。",
  "fieldErrors": {
    "endDateTime": "結束時間不可早於開始時間。"
  }
}
```

成功回應保留 `data` 相容性，並增加可稽核的 `meta`：

```json
{
  "success": true,
  "data": [],
  "meta": {
    "reportType": "data",
    "source": "station",
    "rowCount": 0,
    "generatedAt": "2026-09-29T00:00:00.000Z",
    "appliedFilters": {}
  }
}
```

## 回傳責任

- `realtime`：測站、測項與最新五筆資料。
- `line`：`models`、`line`、`history`。
- `boxplot`：`models`、`boxplots`。
- `heatmap`：`models`、`heatmaps`。
- `wind-rose`：風速級距、16 方位分布與總筆數。
- `wind-vector`：時間、風速、風向資料點。
- 三種報表只回傳各自的 rows。
