import { useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { Chart } from "@highcharts/react";
import { Exporting } from "@highcharts/react/modules/Exporting";
import { Copy, Plus, Trash2, Check } from "lucide-react";
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
import BaseCard from "@/components/common/card/BaseCard";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import BaseInput from "@/components/common/input/BaseInput";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";

const COLORS = ['#2caffe', '#544fc5', '#00e272', '#fe6a35', '#6b8abc', '#d568fb', '#2ee0ca', '#fa4b42', '#feb56a', '#91e8e1'];
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
  color: COLORS[index % COLORS.length],
  stations: [],
  items: [],
  loading: false,
});

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

const createChartOptions = (series, hourlyXAxis, showStationCode, chartLayout) => {
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
    backgroundColor: "#ffffff",
    zooming: { type: "x" },
    alignTicks: !isSplitAxes,
  },
  title: { text: null },
  time: { useUTC: true },
  credits: { enabled: false },
  xAxis: {
    type: "datetime",
    crosshair: true,
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
  const [form, setForm] = useState({
    startTime: dayjs().startOf("day").format("YYYY-MM-DDTHH:mm"),
    endTime: dayjs().endOf("day").format("YYYY-MM-DDTHH:mm"),
  });
  const [series, setSeries] = useState([]);
  const [notice, setNotice] = useState("");
  const [copiedStationId, setCopiedStationId] = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const [chartSettings, setChartSettings] = useState([]);
  const [chartLayout, setChartLayout] = useState("normal");
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
    setRows(selections.map((selection, index) => ({
      ...createRow(index),
      ...selection,
      timeType: selection.PJID === "TAQMN" ? "T60" : selection.timeType || "T01",
      loading: true,
    })));
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
    if (chartData.some((result) => result.status === "rejected")) {
      setNotice("部分資料載入失敗，已保留成功資料");
    }
  }, [chartData]);

  const updateRow = (id, patch) => setRows((current) => current.map(
    (row) => row.rowId === id ? { ...row, ...patch } : row,
  ));

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
    const remaining = rows.filter((item) => item.rowId !== row.rowId);
    setRows(remaining);
    setSeries((current) => current.filter((item) => item.id !== row.rowId));
    if (row.PJID && row.STID && !remaining.some(
      (item) => item.PJID === row.PJID && item.STID === row.STID,
    )) removeComparisonStation(row.PJID, row.STID);
  };

  const duplicateRow = (row) => {
    setRows((current) => [
      ...current,
      { ...row, rowId: createRow().rowId, color: COLORS[current.length % COLORS.length] },
    ]);
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

  const validate = () => {
    if (!form.startTime) return "請選擇開始時間";
    if (!form.endTime) return "請選擇結束時間";
    if (dayjs(form.startTime).isAfter(dayjs(form.endTime))) return "開始時間不可晚於結束時間";
    if (!rows.length) return "請至少新增一筆比對資料";

    for (let index = 0; index < rows.length; index += 1) {
      if (!rows[index].PJID) return `第 ${index + 1} 筆資料尚未選擇專案`;
      if (!rows[index].STID) return `第 ${index + 1} 筆資料尚未選擇測站`;
      if (!rows[index].column) return `第 ${index + 1} 筆資料尚未選擇測項`;
    }
    return "";
  };

  const clearAll = () => {
    clearComparisonStations();
    setRows([]);
    setSeries([]);
    setClearOpen(false);
    setNotice("已清除所有比對資料");
  };

  useEffect(() => {
    if (querying) return;
    if (validate() || rows.some((row) => row.loading)) {
      lastQueryKeyRef.current = "";
      setSeries([]);
      return;
    }

    const queryKey = JSON.stringify({ rows, form });
    if (lastQueryKeyRef.current === queryKey) return;

    const timer = setTimeout(() => {
      lastQueryKeyRef.current = queryKey;
      queriedRowsRef.current = rows.map((row) => ({ ...row, items: [...row.items] }));
      fetchChartData(rows.map((row) => ({
        PJID: row.PJID,
        STID: row.STID,
        column: resolveColumn(row),
        type: row.PJID === "TAQMN" ? "T60" : row.timeType,
        startDateTime: dayjs(form.startTime).format("YYYY-MM-DD HH:mm:ss"),
        endDateTime: dayjs(form.endTime).format("YYYY-MM-DD HH:mm:ss"),
      })));
    }, 300);

    return () => clearTimeout(timer);
  }, [rows, form, querying]);

  const availableSeries = series.filter((item) => item.data.length);
  const hourlyXAxis = chartSettings.includes("hourly-x-axis");
  const showStationCode = chartSettings.includes("station-code-legend");
  const chartOptions = createChartOptions(
    availableSeries,
    hourlyXAxis,
    showStationCode,
    chartLayout,
  );

  return (
    <div className="space-y-8 highcharts-light">
      <PageTitle description="設定時間與測站測項，查看資料趨勢差異" />

      {notice && (
        <div
          role="status"
          className="
            fixed inset-x-4 top-20 z-50
            rounded-lg bg-primary px-4 py-3
            type-body text-primary-foreground shadow-sm
            sm:inset-x-auto sm:right-5 sm:max-w-sm
          "
        >
          {notice}
        </div>
      )}

      <BaseCard
        title={
          <span className="flex items-center gap-2">
            <b className="grid size-7 shrink-0 place-items-center rounded-full bg-primary type-meta text-primary-foreground">
              1
            </b>

            <span>設定時間與比對項目</span>
          </span>
        }
        subtitle="設定查詢期間，並選擇要比較的測站與測項"
        headerRight={
          <div className="flex shrink-0 gap-1.5 sm:gap-2">
            <BaseButton
              type="button"
              size="sm"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  createRow(current.length),
                ])
              }
            >
              <Plus />
              <span className="hidden sm:inline">新增</span>
            </BaseButton>

            <BaseButton
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setClearOpen(true)}
              disabled={!rows.length}
            >
              <Trash2 />
              <span className="hidden sm:inline">清除</span>
            </BaseButton>
          </div>
        }
        contentClassName="p-0"
      >
        <div className="mb-4 border-b border-border px-3 py-3 sm:mb-5 sm:px-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
            <span className="type-meta font-semibold text-muted-foreground sm:col-span-2 lg:mr-1">
              時間範圍
            </span>

            <div className="min-w-0 lg:w-56">
              <BaseInput
                label=""
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
            </div>

            <span className="hidden shrink-0 type-meta text-muted-foreground lg:block">
              —
            </span>

            <div className="min-w-0 lg:w-56">
              <BaseInput
                label=""
                type="datetime-local"
                value={form.endTime}
                min={form.startTime}
                max={dayjs().endOf("day").format("YYYY-MM-DD HH:mm")}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        {rows.length ? (
          <>
            <div className="divide-y divide-border lg:hidden">
              {rows.map((row, index) => (
                <div
                  key={row.rowId}
                  className="space-y-3 px-3 py-4 transition-colors hover:bg-secondary/30 sm:px-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="type-meta font-semibold text-foreground bg-primary-light p-1 rounded-r-md">
                      比對項目 {index + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        aria-label={`項目 ${index + 1} 顏色`}
                        value={row.color}
                        onChange={(event) => updateRow(row.rowId, { color: event.target.value })}
                        className="size-7 shrink-0 cursor-pointer rounded-md border border-border bg-card p-0.5"
                      />

                      <BaseButton
                        type="button"
                        variant="ghost"
                        size="table-icon"
                        className="text-muted-foreground"
                        title="複製"
                        onClick={() => duplicateRow(row)}
                      >
                        <Copy />
                      </BaseButton>

                      <BaseButton
                        type="button"
                        variant="ghost"
                        size="table-icon"
                        className="text-muted-foreground hover:text-destructive"
                        title="刪除"
                        onClick={() => deleteRow(row)}
                      >
                        <Trash2 />
                      </BaseButton>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <span className="type-meta font-medium text-muted-foreground">
                        專案
                      </span>

                      <BaseSelect
                        value={row.PJID}
                        displayValue={getDisplayName(projects, row.PJID)}
                        onChange={(PJID) => selectProject(row, PJID)}
                        options={projects}
                        placeholder="選擇專案"
                      />

                      {row.PJID && (
                        <p className="truncate px-1 type-meta text-muted-foreground">
                          {row.PJID}
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <span className="type-meta font-medium text-muted-foreground">
                        測站
                      </span>

                      <BaseSelect
                        value={row.STID}
                        displayValue={getDisplayName(row.stations, row.STID)}
                        onChange={(STID) => selectStation(row, STID)}
                        options={row.stations}
                        placeholder={row.loading ? "載入中…" : "選擇測站"}
                        disabled={!row.PJID || row.loading}
                      />

                      {(row.STID || row.Desc || row.stationName) && (
                        <div className="flex min-w-0 items-center gap-1 px-1">
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
                              {copiedStationId === row.rowId ? (<Check />) : (<Copy />)}
                            </BaseButton>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 space-y-1">
                    <span className="type-meta font-medium text-muted-foreground">
                      測項
                    </span>

                    <BaseSelect
                      value={row.column}
                      onChange={(column) =>
                        updateRow(row.rowId, {
                          column,
                          itemName:
                            row.items.find(
                              (item) =>
                                item.value === column,
                            )?.label || column,
                        })
                      }
                      options={row.items}
                      placeholder={row.loading ? "載入中…" : "選擇測項"}
                      disabled={!row.STID || row.loading}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-1">
                      <span className="type-meta font-medium text-muted-foreground">
                        時間頻率
                      </span>

                      <BaseSelect
                        value={row.timeType}
                        onChange={(timeType) => updateRow(row.rowId, { timeType })}
                        options={
                          row.PJID === "TAQMN"
                            ? TIME_TYPES.filter(
                                (item) =>
                                  item.value === "T60",
                              )
                            : TIME_TYPES
                        }
                        disabled={row.PJID === "TAQMN"}
                      />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <span className="type-meta font-medium text-muted-foreground">
                        線條
                      </span>

                      <BaseSelect
                        value={row.lineType}
                        onChange={(lineType) => updateRow(row.rowId, { lineType })}
                        options={LINE_TYPES}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[23%]" />
                  <col className="w-[23%]" />
                  <col className="w-[15%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                  <col className="w-[9%]" />
                </colgroup>

                <thead className="border-b border-border bg-secondary">
                  <tr className="text-muted-foreground">
                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      專案
                    </th>

                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      測站
                    </th>

                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      測項
                    </th>

                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      時間頻率
                    </th>

                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      線條
                    </th>

                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      顏色
                    </th>

                    <th className="px-1 py-2 text-center type-meta font-semibold">
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {rows.map((row, index) => (
                    <tr
                      key={row.rowId}
                      className="align-top transition-colors hover:bg-secondary/40"
                    >
                      <td className="px-1 py-2">
                        <div className="min-w-0">
                          <BaseSelect
                            value={row.PJID}
                            displayValue={getDisplayName(projects, row.PJID)}
                            onChange={(PJID) => selectProject(row, PJID)}
                            options={projects}
                            placeholder="選擇專案"
                          />

                          {row.PJID && (
                            <p className="mt-1 truncate px-1 type-meta text-muted-foreground">
                              {row.PJID}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-1 py-2">
                        <div className="min-w-0">
                          <BaseSelect
                            value={row.STID}
                            displayValue={getDisplayName(row.stations, row.STID)}
                            onChange={(STID) => selectStation(row, STID)}
                            options={row.stations}
                            placeholder={row.loading ? "載入中…" : "選擇測站"}
                            disabled={!row.PJID || row.loading}
                          />

                          {(row.STID || row.Desc || row.stationName) && (
                            <div className="mt-1 flex min-w-0 items-center gap-1 px-1">
                              <p
                                className="min-w-0 flex-1 truncate type-meta text-muted-foreground"
                                title={[ row.STID, row.Desc].filter(Boolean).join(" · ")}
                              >
                                {[ row.STID, row.Desc].filter(Boolean).join(" · ")}
                              </p>

                              {row.stationName && (
                                <BaseButton
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  className="shrink-0"
                                  title="複製 STID 與 IIT"
                                  onClick={() =>
                                    copyStationName(row)
                                  }
                                >
                                  {copiedStationId ===
                                  row.rowId ? (
                                    <Check />
                                  ) : (
                                    <Copy />
                                  )}
                                </BaseButton>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-1 py-2">
                        <BaseSelect
                          value={row.column}
                          onChange={(column) =>
                            updateRow(row.rowId, {
                              column,
                              itemName:
                                row.items.find(
                                  (item) =>
                                    item.value ===
                                    column,
                                )?.label || column,
                            })
                          }
                          options={row.items}
                          placeholder={
                            row.loading
                              ? "載入中…"
                              : "選擇測項"
                          }
                          disabled={
                            !row.STID || row.loading
                          }
                        />
                      </td>

                      <td className="px-1 py-2">
                        <BaseSelect
                          value={row.timeType}
                          onChange={(timeType) =>
                            updateRow(row.rowId, {
                              timeType,
                            })
                          }
                          options={
                            row.PJID === "TAQMN"
                              ? TIME_TYPES.filter(
                                  (item) =>
                                    item.value ===
                                    "T60",
                                )
                              : TIME_TYPES
                          }
                          disabled={
                            row.PJID === "TAQMN"
                          }
                        />
                      </td>

                      <td className="px-1 py-2">
                        <BaseSelect
                          value={row.lineType}
                          onChange={(lineType) =>
                            updateRow(row.rowId, {
                              lineType,
                            })
                          }
                          options={LINE_TYPES}
                        />
                      </td>

                      <td className="px-1 py-2">
                        <div className="flex justify-center">
                          <input
                            type="color"
                            aria-label={`項目 ${index + 1} 顏色`}
                            value={row.color}
                            onChange={(event) =>
                              updateRow(row.rowId, {
                                color:
                                  event.target.value,
                              })
                            }
                            className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-card p-0.5"
                          />
                        </div>
                      </td>

                      <td className="px-1 py-2">
                        <div className="flex justify-center gap-1">
                          <BaseButton
                            type="button"
                            variant="ghost"
                            size="table-icon"
                            className="text-muted-foreground"
                            title="複製"
                            onClick={() =>
                              duplicateRow(row)
                            }
                          >
                            <Copy />
                          </BaseButton>

                          <BaseButton
                            type="button"
                            variant="ghost"
                            size="table-icon"
                            className="text-muted-foreground hover:text-destructive"
                            title="刪除"
                            onClick={() =>
                              deleteRow(row)
                            }
                          >
                            <Trash2 />
                          </BaseButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() =>
              setRows([createRow(0)])
            }
            className="grid min-h-28 w-full place-items-center p-5 text-center text-muted-foreground transition-colors hover:bg-secondary/40 sm:p-6"
          >
            <span>
              <Plus
                className="mx-auto mb-2 text-primary"
                size={22}
              />

              <strong className="block type-body text-foreground">
                新增第一個比對項目
              </strong>

              <small>
                可比較不同測站或不同測項
              </small>
            </span>
          </button>
        )}

        <div className="border-t border-border px-3 py-2">
          <p className="type-meta text-muted-foreground">
            {rows.length
              ? querying
                ? "資料載入中…"
                : `共 ${rows.length} 個項目，設定完成後自動更新圖表`
              : "請先新增比對項目"}
          </p>
        </div>
      </BaseCard>

      <BaseCard
        title={
          <span className="flex items-center gap-2">
            <b className="grid size-7 shrink-0 place-items-center rounded-full bg-primary type-meta text-primary-foreground">
              2
            </b>

            <span>查看比對結果</span>
          </span>
        }
        subtitle="拖曳圖表可放大時間區段，右上角可匯出圖表與資料"
      >
        <div className="mb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <BaseCheckbox
              className="flex flex-col gap-2"
              value={chartSettings}
              onChange={setChartSettings}
              items={[
                { value: "hourly-x-axis", label: "X 軸小時刻度" },
                {
                  value: "station-code-legend",
                  label: "編號（STID）更改成裝置名稱（IIT）",
                },
              ]}
            />

            <div className="w-full sm:w-56 sm:shrink-0">
              <BaseSelect
                label=""
                value={chartLayout}
                onChange={setChartLayout}
                options={CHART_LAYOUT_OPTIONS}
              />
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden">
          {!series.length ? (
            <div className="grid h-52 place-items-center rounded-lg border border-dashed border-border bg-secondary/30 px-4 text-center text-muted-foreground sm:h-64 lg:h-72">
              <span>
                <strong className="block type-body text-foreground">
                  圖表會在設定完成後自動更新
                </strong>

                <small>
                  請新增測站並完成專案、測站與測項設定
                </small>
              </span>
            </div>
          ) : !availableSeries.length ? (
            <div className="grid h-52 place-items-center rounded-lg border border-dashed border-border bg-secondary/30 px-4 text-center type-body text-muted-foreground sm:h-64 lg:h-72">
              查無符合條件的監測資料
            </div>
          ) : (
            <Chart key={chartLayout} options={chartOptions}>
              <Exporting
                sourceWidth={1200}
                sourceHeight={800}
                scale={2}
              />
            </Chart>
          )}
        </div>
      </BaseCard>

      <BaseDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="確定清除所有比對資料？"
        description="此操作會移除目前所有比對設定，且無法復原。"
        onConfirm={clearAll}
        confirmText="清除"
      />
    </div>
  )
}
