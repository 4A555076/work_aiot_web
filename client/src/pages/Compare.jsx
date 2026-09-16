import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Chart } from "@highcharts/react";
import { Exporting } from "@highcharts/react/modules/Exporting";
import { Copy, Plus, Trash2, Check, Search, Columns2, Rows2 } from "lucide-react";
import {
  useProjectsList,
  useCompareChartData,
  useStationList,
  useStationModelData,
} from "@/hook/useCompare";
import {
  clearComparisonStations,
  getComparisonStations,
  removeComparisonStation,
} from "@/utils/stationSelectionStorage";
import PageTitle from "@/components/common/PageTitle";
import BaseButton from "@/components/common/button/BaseButton";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import BaseInput from "@/components/common/input/BaseInput";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";

const CHART_COLOR_TOKENS = Array.from(
  { length: 10 },
  (_, index) => `--chart-${index + 1}`,
);
const DEFAULT_CHART_COLOR = "#0ea5e9";
const TIME_TYPES = ["T01", "T05", "T60"].map((value) => ({ value, label: value }));
const LINE_TYPES = [
  { value: "spline", label: "曲線" },
  { value: "spline-marker", label: "曲線點" },
  { value: "line", label: "折線" },
  { value: "line-marker", label: "折線點" },
  { value: "scatter-circle", label: "點(圓形)" },
  { value: "scatter-square", label: "點(方型)" },
  { value: "scatter-diamond", label: "點(菱型)" },
  { value: "scatter-triangle", label: "點(正三角)" },
  { value: "scatter-triangle-down", label: "點(倒三角)" },
  { value: "column", label: "柱狀" },
  { value: "area", label: "折線區域" },
  { value: "areaspline", label: "曲線區域" },
];
const CHART_LAYOUT_OPTIONS = [
  { value: "normal", label: "一般" },
  { value: "multiple-axes", label: "多座標軸" },
  { value: "split-axes", label: "分行坐標軸" },
];
const RESPONSE_LIST_KEYS = ["data", "rows", "result", "items", "list", "records"];
const DATE_TIME_KEYS = [
  "Date_Time", "DateTime", "dateTime", "DataTime", "datetime",
  "time", "timestamp", "CreateDate", "createDate",
];

let rowSequence = 0;
const getChartColor = (index = 0) => {
  if (typeof document === "undefined") return DEFAULT_CHART_COLOR;

  const token = CHART_COLOR_TOKENS[index % CHART_COLOR_TOKENS.length];
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
    || DEFAULT_CHART_COLOR;
};

const createRow = (index = 0) => ({
  rowId: `comparison-${Date.now()}-${++rowSequence}`,
  PJID: "",
  STID: "",
  stationName: "",
  Desc: "",
  timeType: "T01",
  column: "",
  itemName: "",
  lineType: "spline",
  color: getChartColor(index),
  stations: [],
  items: [],
  loading: false,
  copiedFrom: "",
});

const getSeriesKey = (index) => {
  let value = index + 1;
  let label = "";

  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }

  return label;
};

const getStationLabel = (station) =>
  station?.label || station?.STName_TW || station?.Desc || station?.IIT || station?.STID || "—";

const getDisplayName = (options, value) => {
  const label = options.find((option) => option.value === value)?.label || "";
  return label.replace(/^\s*\([^)]*\)\s*/, "") || label;
};

const extractRows = (response, depth = 0) => {
  if (depth > 5 || response == null) return [];
  if (Array.isArray(response)) return response;
  if (typeof response !== "object") return [];

  for (const key of RESPONSE_LIST_KEYS) {
    if (response[key] != null) {
      const rows = extractRows(response[key], depth + 1);
      if (rows.length) return rows;
    }
  }

  return [response];
};

const findValue = (object, targetKey) => {
  if (!object || typeof object !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(object, targetKey)) return object[targetKey];

  const target = String(targetKey).trim().toLowerCase();
  const key = Object.keys(object).find((item) => item.trim().toLowerCase() === target);
  return key ? object[key] : undefined;
};

const toTimestamp = (value) => {
  if (value == null) return Number.NaN;
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue < 1e12 ? numericValue * 1000 : numericValue;
  return dayjs(value).valueOf();
};

// datetime-local 沒有時區資訊；圖表採 UTC 顯示時，需保留使用者輸入的鐘面時間。
const localDateTimeToUtcTimestamp = (value) => {
  const dateTime = dayjs(value);
  if (!dateTime.isValid()) return undefined;

  return Date.UTC(
    dateTime.year(),
    dateTime.month(),
    dateTime.date(),
    dateTime.hour(),
    dateTime.minute(),
    dateTime.second(),
  );
};

const normalizePoints = (response, column) => extractRows(response)
  .map((point) => {
    if (!point) return null;
    if (Array.isArray(point)) {
      const timestamp = toTimestamp(point[0]);
      const value = Number(point[1]);
      return Number.isFinite(timestamp) && Number.isFinite(value) ? [timestamp, value] : null;
    }

    const detectedTimeKey = Object.keys(point).find(
      (key) => /(^time$|^tm$|timestamp|date.*time|time.*date)/i.test(key),
    );
    const dateTime = DATE_TIME_KEYS.reduce(
      (value, key) => value ?? findValue(point, key),
      undefined,
    ) ?? point[detectedTimeKey];
    const nestedValues = findValue(point, "values") ?? findValue(point, "data");
    const rawValue = findValue(point, column) ?? findValue(nestedValues, column);
    const timestamp = toTimestamp(dateTime);
    const value = rawValue == null || rawValue === "" ? Number.NaN : Number(rawValue);

    return Number.isFinite(timestamp) && Number.isFinite(value) ? [timestamp, value] : null;
  })
  .filter(Boolean)
  .sort((first, second) => first[0] - second[0]);

const resolveColumn = (row) => row.items.find(
  (item) => item.value === row.column || item.name === row.column,
)?.value || row.column;

const getDefaultItem = (items, currentColumn = "") => {
  const selectedItem = items.find(
    (item) => item.value === currentColumn || item.name === currentColumn,
  ) || items[0];

  return {
    column: selectedItem?.value || "",
    itemName: selectedItem?.label || selectedItem?.name || "",
  };
};

const getSeriesStyle = (lineType) => {
  if (lineType === "spline-marker") {
    return { type: "spline", marker: { enabled: true, radius: 3 } };
  }
  if (lineType === "line-marker") {
    return { type: "line", marker: { enabled: true, radius: 3 } };
  }
  if (lineType.startsWith("scatter-")) {
    return {
      type: "scatter",
      marker: {
        enabled: true,
        radius: 4,
        symbol: lineType.replace("scatter-", ""),
      },
    };
  }
  if (lineType === "column") return { type: "column" };
  if (lineType === "area") return { type: "area", fillOpacity: 0.25 };
  if (lineType === "areaspline") return { type: "areaspline", fillOpacity: 0.25 };
  if (lineType === "spline") return { type: "spline" };

  return { type: "line" };
};

const getLegendName = (item, showStationCode) => {
  const stationName = item.stationName || item.name?.split(" - ")[0] || "";
  const itemName = item.itemName || item.name?.split(" - ").slice(1).join(" - ") || "";
  const matchedStation = stationName.match(/^\(([^)]+)\)\s*(.*)$/);
  const stationLabel = matchedStation
    ? showStationCode
      ? matchedStation[2]
      : matchedStation[1]
    : stationName;

  return `${stationLabel} - ${itemName}`;
};

const createChartOptions = (
  series,
  hourlyXAxis,
  showStationCode,
  chartLayout,
  queryTimeRange,
) => {
  const hasSeparateAxes = chartLayout !== "normal";
  const isSplitAxes = chartLayout === "split-axes";
  const splitAxisHeight = series.length ? 100 / series.length : 100;
  const yAxis = hasSeparateAxes
  ? series.map((item, index) => ({
      title: {
        text: getLegendName(item, showStationCode),
      },

      opposite: chartLayout === "multiple-axes",

      ...(isSplitAxes
        ? {
            top: `${index * splitAxisHeight}%`,
            height: `${splitAxisHeight}%`,
            offset: 0,

            // split-axes 不顯示 Y 軸刻度
            lineWidth: 0,
            tickWidth: 0,
            tickLength: 0,
            minorTickWidth: 0,
            minorTickLength: 0,

            labels: {
              enabled: false,
            },
          }
        : {}),
    }))
  : {
      title: {
        text: "測值",
      },
    };

  return ({
  chart: {
    height: isSplitAxes ? Math.max(430, series.length * 180) : 430,
    spacing: [18, 14, 10, 10],
    backgroundColor: "transparent",
    zooming: { type: "x" },
    alignTicks: !isSplitAxes,
  },
  title: { text: null },
  time: { useUTC: true },
  credits: { enabled: false },
  xAxis: {
    type: "datetime",
    crosshair: true,
    min: queryTimeRange.min,
    max: queryTimeRange.max,
    startOnTick: false,
    endOnTick: false,
    tickInterval: hourlyXAxis ? 60 * 60 * 1000 : undefined,
    title: { text: "日期時間" },

    labels: {
      rotation: hourlyXAxis ? -90 : 0,
      align: hourlyXAxis ? "right" : "center",
      step: 1,

      formatter: function () {
        
        const time = this.axis.chart.time;
        const value = Number(this.value);
        const currentTime = time.dateFormat("%H:%M", value);

        if (hourlyXAxis) {
          return time.dateFormat("%m/%d %H:%M", value);
        }

        if (currentTime === "00:00") {
          return time.dateFormat("%m/%d", value);
        }

        return currentTime;
      },
    },
  },
  yAxis,
  legend: {
    enabled: true,
    align: "center",
    verticalAlign: "top",
    layout: "horizontal",
  },
  tooltip: { shared: true, xDateFormat: "%Y-%m-%d %H:%M", valueDecimals: 2 },
  plotOptions: {
    series: { animation: false, connectNulls: false, marker: { enabled: false } },
  },
  lang: {
    weekdays: ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],
    contextButtonTitle: '匯出選單',
    downloadPNG: '下載 PNG',
    downloadJPEG: '下載 JPEG',
    downloadPDF: '下載 PDF',
    downloadSVG: '下載 SVG',
    downloadCSV: '下載 CSV',
    downloadXLS: '下載 XLS',
    printChart: '列印圖表',
    viewFullscreen: '全螢幕檢視',
    exitFullscreen: '退出全螢幕',
    resetZoom:'重置縮放',
    noData: '沒有資料可顯示'
  },
  series: series.map((item, index) => ({
    id: item.id,
    name: getLegendName(item, showStationCode),
    color: item.color,
    data: item.data,
    yAxis: hasSeparateAxes ? index : 0,
    ...getSeriesStyle(item.lineType),
  })),
  });
};

export default function ComparePage() {
  const [rows, setRows] = useState([]);
  const [initialTimeRange] = useState(() => ({
    startTime: dayjs().startOf("day").format("YYYY-MM-DDTHH:mm"),
    endTime: dayjs().endOf("day").format("YYYY-MM-DDTHH:mm"),
  }));
  const [form, setForm] = useState(initialTimeRange);
  const [queryForm, setQueryForm] = useState(initialTimeRange);
  const [series, setSeries] = useState([]);
  const [chartRevision, setChartRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [copiedStationId, setCopiedStationId] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [chartSettings, setChartSettings] = useState([]);
  const [chartLayout, setChartLayout] = useState("normal");
  const [workspaceLayout, setWorkspaceLayout] = useState("horizontal");
  const [activeRowId, setActiveRowId] = useState("");
  const queriedRowsRef = useRef([]);
  const lastQueryKeyRef = useRef("");

  const { 
    data: projects, 
    error: projectsError, 
    fetchProjectsList 
  } = useProjectsList();
  const { 
    data: stationData, 
    error: stationsError, 
    fetchStationList 
  } = useStationList();
  const { 
    data: modelData, 
    error: modelError,
    fetchStationModelData 
  } = useStationModelData();
  const {
    data: chartData,
    loading: querying,
    error: chartError,
    fetchChartData,
  } = useCompareChartData();

  useEffect(() => {
    fetchProjectsList();

    const selections = getComparisonStations();
    const initialRows = selections.length
      ? selections.map((selection, index) => ({
          ...createRow(index),
          ...selection,
          timeType: selection.PJID === "TAQMN" ? "T60" : selection.timeType || "T01",
          loading: true,
        }))
      : [createRow(0)];

    setRows(initialRows);
    setActiveRowId(initialRows[0]?.rowId || "");

    selections.forEach((selection) => {
      fetchStationList({ project: selection.PJID });
      fetchStationModelData(selection.STID, { PJID: selection.PJID });
    });
  }, []);

  useEffect(() => {
    setRows((current) => current.map((row) => {
      const stations = stationData[row.PJID];
      if (!stations) return row;

      const station = stations.find((item) => String(item.value) === row.STID);
      return {
        ...row,
        stations,
        stationName: row.STID ? getStationLabel(station) : "",
        Desc: row.STID ? station?.Desc || "" : "",
        loading: row.STID ? row.loading : false,
      };
    }));
  }, [stationData]);

  useEffect(() => {
    setRows((current) => current.map((row) => {
      const items = modelData[`${row.PJID}::${row.STID}`];
      if (!items) return row;

      return {
        ...row,
        items,
        loading: false,
        ...getDefaultItem(items, row.column),
      };
    }));
  }, [modelData]);

  useEffect(() => {
    if (!rows.length) return;
    if (activeRowId && !rows.some((row) => row.rowId === activeRowId)) {
      setActiveRowId(rows[0].rowId);
    }
  }, [rows, activeRowId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const error = projectsError || stationsError || modelError || chartError;
    if (error) setNotice(error);
  }, [projectsError, stationsError, modelError, chartError]);

  useEffect(() => {
    if (!chartData.length) return;

    const nextSeries = chartData.map((result, index) => {
      const row = queriedRowsRef.current[index];
      if (!row) return null;

      const common = {
        id: row.rowId,
        name: `${row.stationName} - ${row.itemName || row.column}`,
        stationName: row.stationName,
        itemName: row.itemName || row.column,
        color: row.color,
        lineType: row.lineType,
      };
      if (result.status === "rejected") {
        return {
          ...common,
          data: [],
          error: result.reason?.response?.data?.message || result.reason?.message || "查詢失敗",
        };
      }

      const column = resolveColumn(row);
      return {
        ...common,
        PJID: row.PJID,
        STID: row.STID,
        column,
        data: normalizePoints(result.value, column),
      };
    }).filter(Boolean);

    setSeries(nextSeries);
    setChartRevision((current) => current + 1);
    if (chartData.some((result) => result.status === "rejected")) {
      setNotice("部分資料載入失敗，已保留成功資料");
    }
  }, [chartData]);

  const updateRow = (id, patch) => {
    setActiveRowId(id);
    setRows((current) => current.map(
      (row) => row.rowId === id ? { ...row, ...patch } : row,
    ));
  };

  const addRow = () => {
    const nextRow = createRow(rows.length);
    setRows((current) => [...current, nextRow]);
    setActiveRowId(nextRow.rowId);
  };

  const selectProject = (row, PJID) => {
    updateRow(row.rowId, {
      PJID, STID: "", stationName: "", Desc: "", column: "", itemName: "",
      timeType: PJID === "TAQMN" ? "T60" : row.PJID === "TAQMN" ? "T01" : row.timeType,
      items: [], stations: [], loading: Boolean(PJID),
    });
    if (!PJID) return;
    fetchStationList({ project: PJID });
  };

  const selectStation = (row, STID) => {
    const station = row.stations.find((item) => String(item.value) === STID);
    updateRow(row.rowId, {
      STID,
      stationName: getStationLabel(station),
      Desc: station?.Desc || "",
      column: "",
      itemName: "",
      items: [],
      loading: Boolean(STID),
    });
    if (!STID) return;

    fetchStationModelData(STID, { PJID: row.PJID });

    const oldStationUsed = rows.some(
      (item) => item.rowId !== row.rowId && item.PJID === row.PJID && item.STID === row.STID,
    );
    if (row.STID && !oldStationUsed) removeComparisonStation(row.PJID, row.STID);
  };

  const deleteRow = (row) => {
    const sourceIndex = rows.findIndex((item) => item.rowId === row.rowId);
    const remaining = rows.filter((item) => item.rowId !== row.rowId);
    const fallbackRow = remaining[Math.min(sourceIndex, remaining.length - 1)] || createRow(0);
    const nextRows = remaining.length ? remaining : [fallbackRow];

    setRows(nextRows);
    setSeries((current) => current.filter((item) => item.id !== row.rowId));

    if (activeRowId === row.rowId) {
      setActiveRowId(fallbackRow.rowId);
    }

    if (row.PJID && row.STID && !remaining.some(
      (item) => item.PJID === row.PJID && item.STID === row.STID,
    )) removeComparisonStation(row.PJID, row.STID);
  };

  const duplicateRow = (row) => {
    const sourceIndex = rows.findIndex((item) => item.rowId === row.rowId);
    const sourceKey = getSeriesKey(Math.max(sourceIndex, 0));
    const nextRow = {
      ...row,
      rowId: createRow().rowId,
      color: getChartColor(rows.length),
      copiedFrom: sourceKey,
    };

    setRows((current) => {
      const liveSourceIndex = current.findIndex((item) => item.rowId === row.rowId);
      const next = [...current];
      next.splice(liveSourceIndex + 1, 0, nextRow);
      return next;
    });
    setActiveRowId(nextRow.rowId);

    const sourceName = [row.stationName || row.STID, row.itemName || row.column]
      .filter(Boolean)
      .join(" · ");
    setNotice(`已複製 ${sourceKey}${sourceName ? `｜${sourceName}` : ""}`);
  };

  const copyStationName = async (row) => {
    if (!row.stationName) return;
    try {
      await navigator.clipboard.writeText(row.stationName);
      setCopiedStationId(row.rowId);
      setNotice(`已複製測站：${row.stationName}`);
      setTimeout(() => setCopiedStationId((current) => current === row.rowId ? "" : current), 1800);
    } catch {
      setNotice("無法複製測站名稱，請確認瀏覽器剪貼簿權限");
    }
  };

  const validate = (timeRange = form) => {
    if (!timeRange.startTime) return "請選擇開始時間";
    if (!timeRange.endTime) return "請選擇結束時間";
    if (dayjs(timeRange.startTime).isAfter(dayjs(timeRange.endTime))) {
      return "開始時間不可晚於結束時間";
    }
    if (!rows.length) return "請至少新增一筆比對資料";

    for (let index = 0; index < rows.length; index += 1) {
      if (!rows[index].PJID) return `第 ${index + 1} 筆資料尚未選擇專案`;
      if (!rows[index].STID) return `第 ${index + 1} 筆資料尚未選擇測站`;
      if (!rows[index].column) return `第 ${index + 1} 筆資料尚未選擇測項`;
    }
    return "";
  };

  const search = () => {
    const error = validate(form);
    if (error) {
      setNotice(error);
      return;
    }

    setQueryForm({ ...form });
  };

  const clearAll = () => {
    const nextRow = createRow(0);
    clearComparisonStations();
    setRows([nextRow]);
    setActiveRowId(nextRow.rowId);
    setSeries([]);
    setClearOpen(false);
    setNotice("已清除所有比對資料");
  };

  useEffect(() => {
    if (querying) return;
    if (validate(queryForm) || rows.some((row) => row.loading)) {
      lastQueryKeyRef.current = "";
      setSeries([]);
      return;
    }

    const queryKey = JSON.stringify({ rows, form: queryForm });
    if (lastQueryKeyRef.current === queryKey) return;

    const timer = setTimeout(() => {
      lastQueryKeyRef.current = queryKey;
      queriedRowsRef.current = rows.map((row) => ({ ...row, items: [...row.items] }));
      fetchChartData(rows.map((row) => ({
        PJID: row.PJID,
        STID: row.STID,
        column: resolveColumn(row),
        type: row.PJID === "TAQMN" ? "T60" : row.timeType,
        startDateTime: dayjs(queryForm.startTime).format("YYYY-MM-DD HH:mm:ss"),
        endDateTime: dayjs(queryForm.endTime).format("YYYY-MM-DD HH:mm:ss"),
      })));
    }, 300);

    return () => clearTimeout(timer);
  }, [rows, queryForm, querying]);

  const availableSeries = series.filter((item) => item.data.length);
  const hourlyXAxis = chartSettings.includes("hourly-x-axis");
  const showStationCode = chartSettings.includes("station-code-legend");
  const chartOptions = createChartOptions(
    availableSeries,
    hourlyXAxis,
    showStationCode,
    chartLayout,
    {
      min: localDateTimeToUtcTimestamp(queryForm.startTime),
      max: localDateTimeToUtcTimestamp(queryForm.endTime),
    },
  );
  const chartKey = JSON.stringify({
    chartRevision,
    chartLayout,
    startTime: queryForm.startTime,
    endTime: queryForm.endTime,
    series: availableSeries.map((item) => ({
      id: item.id,
      type: item.lineType,
      length: item.data.length,
      first: item.data[0]?.[0],
      last: item.data.at(-1)?.[0],
    })),
  });
  const hasPendingTimeChanges = form.startTime !== queryForm.startTime
    || form.endTime !== queryForm.endTime;
  const configuredRowCount = rows.filter((row) => row.PJID && row.STID && row.column).length;
  const analysisReady = configuredRowCount === rows.length && rows.length > 0;

  return (
    <div className="space-y-8 highcharts-light">
      <PageTitle description="設定時間與測站測項，查看資料趨勢差異" />

      {notice && (
        <div
          role="status"
          className="fixed inset-x-4 top-20 z-50 rounded-lg bg-primary px-4 py-3 type-body text-primary-foreground shadow-sm sm:inset-x-auto sm:right-5 sm:max-w-sm"
        >
          {notice}
        </div>
      )}

      <div className="bg-surface-secondary/60">
        <section className="border-y border-border bg-surface px-4 py-5 sm:px-5" aria-labelledby="compare-filter-title">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(12rem,.7fr)_minmax(13rem,1fr)_minmax(13rem,1fr)_auto] xl:items-end">
          <div className="min-w-0 xl:self-center">
            <div className="flex items-center gap-2">
              <span className="type-meta font-bold text-primary">01</span>
              <h2 id="compare-filter-title" className="type-section-title font-semibold text-foreground">
                分析條件
              </h2>
            </div>
            <p className="mt-1 type-meta text-muted-foreground">
              選擇資料比較的時間範圍
            </p>
          </div>

          <BaseInput
              id="compare-start-time"
              label="開始時間"
              type="datetime-local"
              value={form.startTime}
              max={form.endTime}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startTime: event.target.value,
                }))
              }
            />

            <BaseInput
              id="compare-end-time"
              label="結束時間"
              type="datetime-local"
              value={form.endTime}
              min={form.startTime}
              max={dayjs().endOf("day").format("YYYY-MM-DDTHH:mm")}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endTime: event.target.value,
                }))
              }
            />

            <BaseButton
              type="button"
              onClick={search}
              disabled={querying}
              className="w-full whitespace-nowrap px-6 sm:w-auto"
            >
              <Search className="size-4" />
              {querying ? "分析中…" : "分析資料"}
            </BaseButton>
        </div>

        {hasPendingTimeChanges && (
          <p className="mt-3 text-right type-meta font-medium text-warning">
            時間範圍已修改，點選「分析資料」後套用。
          </p>
        )}
      </section>

      <section aria-labelledby="compare-workspace-title">
        <header className="flex flex-col gap-4 bg-surface px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div>
            <h2 id="compare-workspace-title" className="type-card-title font-semibold text-foreground">
              資料比較工作區
            </h2>
            <p className="mt-1 type-meta text-muted-foreground">
              已設定 {configuredRowCount} / {rows.length} 組比較資料
            </p>
          </div>

          <div
            className="flex w-fit items-center rounded-lg border border-border bg-surface-secondary p-0.5"
            aria-label="工作區排列方式"
          >
            <button
              type="button"
              onClick={() => setWorkspaceLayout("horizontal")}
              aria-label="左右排列"
              title="左右排列"
              aria-pressed={workspaceLayout === "horizontal"}
              className={`grid size-8 place-items-center rounded-md transition-colors ${
                workspaceLayout === "horizontal"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Columns2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setWorkspaceLayout("vertical")}
              aria-label="上下排列"
              title="上下排列"
              aria-pressed={workspaceLayout === "vertical"}
              className={`grid size-8 place-items-center rounded-md transition-colors ${
                workspaceLayout === "vertical"
                  ? "bg-surface text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rows2 className="size-4" />
            </button>
          </div>
        </header>

        <div
          className={`grid border-y border-border ${
            workspaceLayout === "horizontal"
              ? "xl:grid-cols-[27rem_minmax(0,1fr)]"
              : "grid-cols-1"
          }`}
        >
          <aside
            className={`flex min-h-0 min-w-0 flex-col bg-surface-secondary ${
              workspaceLayout === "horizontal"
                ? "border-b border-border xl:border-b-0 xl:border-r"
                : "border-b border-border"
            }`}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="type-meta font-bold text-primary">02</span>
                  <h2 className="type-section-title font-semibold text-foreground">比較資料</h2>
                </div>
                <p className="mt-0.5 type-meta text-muted-foreground">選擇專案、測站、測項與圖型</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">

                <BaseButton
                  type="button"
                  size="sm"
                  title="新增比較資料"
                  onClick={addRow}
                >
                  <Plus className="size-4" />
                  新增
                </BaseButton>

                <BaseButton
                  type="button"
                  variant="ghost"
                  size="table-icon"
                  className="text-muted-foreground hover:text-destructive"
                  title="清除"
                  onClick={() => setClearOpen(true)}
                >
                  <Trash2 className="size-4" />
                </BaseButton>
              </div>
            </header>

            <div className="flex-1 space-y-3 p-3 sm:p-4">
              {rows.map((row, index) => {
                const rowReady = Boolean(row.PJID && row.STID && row.column);
                const seriesKey = getSeriesKey(index);
                const sourceSummary = rowReady
                  ? [row.stationName || row.STID, row.itemName || row.column]
                      .filter(Boolean)
                      .join(" · ")
                  : `比較資料 ${seriesKey}`;

                const isActive = row.rowId === activeRowId;
                const isExpanded = isActive;
                const showActiveState = isActive;

                return (
                  <article
                    key={row.rowId}
                    className={`overflow-hidden rounded-xl border bg-surface transition-all ${
                      showActiveState
                        ? "border-primary/40 ring-1 ring-primary/10"
                        : "border-border hover:border-primary/25"
                    }`}
                    style={showActiveState ? { borderLeftColor: row.color, borderLeftWidth: 4 } : undefined}
                  >
                    <div className={`flex items-center justify-between gap-3 px-3 py-3 ${
                      showActiveState ? "border-b border-border/70 bg-primary-light" : "bg-surface"
                    }`}>
                      <button
                        type="button"
                        onClick={() => setActiveRowId((current) =>
                          current === row.rowId ? "" : row.rowId
                        )}
                        aria-expanded={isExpanded}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <div
                          className="grid size-9 shrink-0 place-items-center rounded-lg type-body font-bold text-primary-foreground"
                          style={{ backgroundColor: row.color }}
                        >
                          {seriesKey}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <strong className="min-w-0 flex-1 truncate type-body font-semibold text-foreground">
                              {rowReady ? sourceSummary : `比較資料 ${seriesKey}`}
                            </strong>
                            {showActiveState && (
                              <span className="shrink-0 rounded-full bg-primary-light px-2 py-0.5 type-meta font-semibold text-primary">
                                編輯中
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 type-meta text-muted-foreground">
                            {!rowReady && <span className="font-medium text-warning">未完成</span>}
                          </div>
                        </div>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <label className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border bg-surface" title={`${seriesKey} 圖表顏色`}>
                          <span className="size-4 rounded-full" style={{ backgroundColor: row.color }} />
                          <input
                            type="color"
                            aria-label={`序列 ${seriesKey} 顏色`}
                            value={row.color}
                            onChange={(event) =>
                              updateRow(row.rowId, { color: event.target.value })
                            }
                            className="sr-only"
                          />
                        </label>

                        <BaseButton
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          title={`複製 ${seriesKey}｜${sourceSummary}`}
                          aria-label={`複製序列 ${seriesKey}`}
                          onClick={() => duplicateRow(row)}
                        >
                          <Copy />
                        </BaseButton>

                        <BaseButton
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive"
                          title={`刪除 ${seriesKey}｜${sourceSummary}`}
                          aria-label={`刪除序列 ${seriesKey}`}
                          onClick={() => deleteRow(row)}
                        >
                          <Trash2 />
                        </BaseButton>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3">
                        <div
                          className={`grid gap-2.5 sm:grid-cols-2 ${
                            workspaceLayout === "horizontal"
                              ? "xl:grid-cols-1"
                              : "xl:grid-cols-[1.15fr_1.15fr_1fr_1fr] xl:items-start"
                          }`}
                        >
                      <div className="min-w-0">
                        <BaseSelect
                          label="專案"
                          value={row.PJID}
                          displayValue={getDisplayName(projects, row.PJID)}
                          onChange={(PJID) => selectProject(row, PJID)}
                          options={projects}
                          placeholder="選擇專案"
                        />
                      </div>

                      <div className="min-w-0">
                        <BaseSelect
                          label="測站"
                          value={row.STID}
                          displayValue={getDisplayName(row.stations, row.STID)}
                          onChange={(STID) => selectStation(row, STID)}
                          options={row.stations}
                          placeholder={row.loading ? "載入中…" : "選擇測站"}
                          disabled={!row.PJID || row.loading}
                        />
                        {(row.STID || row.Desc) && (
                          <div className="mt-1 flex min-w-0 items-center gap-1 px-1">
                            <p
                              className="min-w-0 flex-1 truncate type-meta text-muted-foreground"
                              title={[row.STID, row.Desc].filter(Boolean).join(" · ")}
                            >
                              {[row.STID, row.Desc].filter(Boolean).join(" · ")}
                            </p>

                            {row.stationName && (
                              <BaseButton
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                className="shrink-0"
                                title="複製 STID 與 IIT"
                                onClick={() => copyStationName(row)}
                              >
                                {copiedStationId === row.rowId ? <Check /> : <Copy />}
                              </BaseButton>
                            )}
                          </div>
                        )}
                      </div>

                      <BaseSelect
                        label="測項"
                        value={row.column}
                        onChange={(column) =>
                          updateRow(row.rowId, {
                            column,
                            itemName:
                              row.items.find((item) => item.value === column)?.label || column,
                          })
                        }
                        options={row.items}
                        placeholder={row.loading ? "載入中…" : "選擇測項"}
                        disabled={!row.STID || row.loading}
                      />

                      <div className="grid grid-cols-2 gap-2.5">
                        <BaseSelect
                          label="頻率"
                          value={row.timeType}
                          onChange={(timeType) => updateRow(row.rowId, { timeType })}
                          options={
                            row.PJID === "TAQMN"
                              ? TIME_TYPES.filter((item) => item.value === "T60")
                              : TIME_TYPES
                          }
                          disabled={row.PJID === "TAQMN"}
                        />

                        <BaseSelect
                          label="圖型"
                          value={row.lineType}
                          onChange={(lineType) => updateRow(row.rowId, { lineType })}
                          options={LINE_TYPES}
                        />
                      </div>
                    </div>
                      </div>
                    )}
                  </article>
                );
              })}

            </div>
          </aside>

          <main
            className={`flex min-h-0 min-w-0 flex-col bg-surface ${
              workspaceLayout === "vertical" ? "border-t-0" : ""
            }`}
          >
            <header className="shrink-0 border-b border-border px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                <div className="flex items-center gap-2">
                  <span className="type-meta font-bold text-primary">03</span>
                  <h2 className="type-section-title font-semibold text-foreground">分析結果</h2>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <BaseCheckbox
                    className="flex flex-wrap gap-x-4 gap-y-2"
                    value={chartSettings}
                    onChange={setChartSettings}
                    items={[
                      { value: "hourly-x-axis", label: "小時刻度" },
                      { value: "station-code-legend", label: "IIT 名稱" },
                    ]}
                  />

                  <div className="w-full sm:w-40">
                    <BaseSelect
                      label=""
                      value={chartLayout}
                      onChange={setChartLayout}
                      options={CHART_LAYOUT_OPTIONS}
                    />
                  </div>
                </div>
              </div>
            </header>

            <section className="flex-1 bg-surface-secondary p-3 sm:p-4 lg:p-5">
              <div className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-surface p-2 sm:p-3">
                {querying && !series.length ? (
                  <div className="h-107.5 animate-pulse rounded-lg bg-muted" />
                ) : !analysisReady ? (
                  <div className="grid h-107.5 place-items-center rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center">
                    <div className="max-w-md">
                      <strong className="block type-body font-semibold text-foreground">
                        請完成比較資料
                      </strong>
                      <p className="mt-2 type-meta text-muted-foreground">
                        請為每一組資料選擇專案、測站與測項。
                      </p>
                    </div>
                  </div>
                ) : !series.length || !availableSeries.length ? (
                  <div className="grid h-107.5 place-items-center rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center">
                    <div className="max-w-md">
                      <strong className="block type-body font-semibold text-foreground">
                        查無資料
                      </strong>
                      <p className="mt-2 type-meta text-muted-foreground">
                        目前條件沒有可顯示的監測資料，請調整時間或比較項目。
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Chart key={chartKey} options={chartOptions}>
                      <Exporting sourceWidth={1200} sourceHeight={800} scale={2} />
                    </Chart>

                    {querying && (
                      <div className="absolute inset-2 grid place-items-center rounded-lg bg-surface/75 type-body font-semibold text-primary backdrop-blur-[1px] sm:inset-3">
                        分析中…
                      </div>
                    )}
                  </>
                )}
              </div>

            </section>
          </main>
        </div>
      </section>
      </div>


      <BaseDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="確定清除所有比較資料？"
        description="清除目前所有比較資料。"
        onConfirm={clearAll}
        confirmText="清除"
      />
    </div>
  );
}
