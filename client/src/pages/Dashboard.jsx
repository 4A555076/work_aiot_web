import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { InspectionEntry } from "@/pages/InspectionEntry";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/zh-tw";
import { Chart, Highcharts } from "@highcharts/react";
import { Exporting } from "@highcharts/react/modules/Exporting";
import "@highcharts/react/series/BoxPlot";
import "@highcharts/react/series/Heatmap";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardCheck,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Wind,
  X,
} from "lucide-react";
import { useDashboard, DASHBOARD_TIME_TYPES } from "@/hook/useDashboard";
import { useStationSelections } from "@/hook/useStationSelections";
import { getAuthorizedStationsData } from "@/api/station";
import { getTaqmnStationList } from "@/api/openData";
import {
  addDashboardStation,
  getDashboardStations,
  removeDashboardStation,
} from "@/utils/stationSelectionStorage";
import BaseButton from "@/components/common/button/BaseButton";
import BaseCard from "@/components/common/card/BaseCard";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";
import BaseInput from "@/components/common/input/BaseInput";
import BaseMultiSelect from "@/components/common/select/BaseMultiSelect";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseTable from "@/components/common/table/BaseTable";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import BaseTab from "@/components/common/tab/BaseTab";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import GoogleMap from "@/components/common/map/GoogleMap";

dayjs.extend(utc);

Highcharts.SVGRenderer.prototype.symbols.windArrow = (x, y, width, height) => [
  ["M", x + width / 2, y],
  ["L", x + width, y + height],
  ["L", x + width / 2, y + height * 0.72],
  ["L", x, y + height],
  ["Z"],
];

const REPORT_TABS = [
  { value: "data", label: "資料表" },
  { value: "daily", label: "日報表" },
  { value: "monthly", label: "月報表" },
];
const BOX_TIME_OPTIONS = [
  { value: "hour", label: "每小時" },
  { value: "day", label: "每日" },
  { value: "week", label: "每週" },
  { value: "month", label: "每月" },
];
const LINE_TYPE_OPTIONS = [
  { value: "spline", label: "曲線" },
  { value: "spline-marker", label: "曲線點" },
  { value: "line", label: "折線" },
  { value: "scatter-circle", label: "點(圓形)" },
  { value: "scatter-square", label: "點(方形)" },
  { value: "scatter-diamond", label: "點(菱形)" },
  { value: "scatter-triangle", label: "點(正三角)" },
  { value: "scatter-triangle-down", label: "點(倒三角)" },
  { value: "column", label: "柱狀" },
  { value: "area", label: "折線區域" },
  { value: "areaspline", label: "曲線區域" },
];
const LINE_CHART_LAYOUT_OPTIONS = [
  { value: "normal", label: "一般" },
  { value: "multiple-axes", label: "多坐標軸" },
  { value: "split-axes", label: "分行座標軸" },
];
const EPA_DEFAULT_LINE_MODEL_VALUES = new Set(["WD", "AMB_TEMP", "PM25", "RH", "NMHC", "WS"]);
const COLORS = ["#2caffe","#544fc5","#00e272","#fe6a35","#6b8abc","#d568fb","#2ee0ca","#fa4b42","#feb56a","#91e8e1"];
const EMPTY_MAP_MARKERS = [];

const WIND_DIRECTIONS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const keyOf = ({ PJID, STID }) => `${PJID}::${STID}`;
const displayStationValue = (value) => value || "—";

const getStationInfoTitle = (station) => {
  if (!station) return "測站資料未設定";

  const values = ["EPA", "TAQMN"].includes(station.PJID)
    ? [station.County, station.STName]
    : [station.STID, station.Desc];
  const separator = ["EPA", "TAQMN"].includes(station.PJID) ? " - " : " ";

  return values.filter(Boolean).join(separator) || "測站資料未設定";
};

const windDirectionLabel = (degrees) =>
  WIND_DIRECTIONS[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
const weekdayLabel = (value) => `星期${WEEKDAYS[dayjs.utc(value).day()]}`;

const isCountModel = (model) =>
  /^Count\d+$/i.test(String(model?.value || "")) ||
  /\s+Count$/i.test(String(model?.name || model?.label || ""));

const isPm25Model = (model) => {
  if (isCountModel(model)) return false;
  if (model?.value === "PM25") return true;

  const text = `${model?.name || ""} ${model?.label || ""}`
    .replace(/₂/g, "2")
    .replace(/₅/g, "5");
  return /PM\s*2[._]?5/i.test(text) && !/(?:24\s*小時|h24)/i.test(text);
};

const getDashboardModels = (models, selectedValue) =>
  models.find((item) => item.value === selectedValue && !isCountModel(item)) ||
  models.find(isPm25Model) ||
  models.find((item) => !isCountModel(item));

const getModelChartLabel = (model, fallback = "測項") => {
  return model?.label || fallback;
};

const getLineSeriesStyle = (lineType) => {
  if (lineType === "spline-marker") {
    return { type: "spline", marker: { enabled: true, radius: 3 } };
  }
  if (lineType?.startsWith("scatter-")) {
    return {
      type: "scatter",
      marker: { enabled: true, radius: 4, symbol: lineType.replace("scatter-", "") },
    };
  }
  if (lineType === "column") return { type: "column" };
  if (lineType === "area") return { type: "area", fillOpacity: 0.25 };
  if (lineType === "areaspline") return { type: "areaspline", fillOpacity: 0.25 };
  if (lineType === "line") return { type: "line" };
  return { type: "spline" };
};

const hasSensorValue = (value) =>
  value !== null && value !== undefined && value !== "" &&
  !(typeof value === "number" && Number.isNaN(value));

const displaySensorValue = (value) => hasSensorValue(value) ? value : "--";
const displayCountValue = (value) => {
  if (!hasSensorValue(value)) return "--";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : value;
};

const createReportColumns = (rows, reportType) => {
  const timeKeys = new Set(["Date_Time"]);
  const dataKeys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))].filter(
    (key) => !timeKeys.has(key),
  );

  if (reportType === "daily") dataKeys.sort((left, right) => left.localeCompare(right));

  return [
    {
      id: "time",
      accessorKey: "Date_Time",
      accessorFn: (row) => row.Date_Time,
      header: reportType === "daily" ? "日期" : "時間",
    },
    ...dataKeys.map((key) => ({
      id: key,
      accessorKey: key,
      accessorFn: (row) => row[key],
      header: key,
    })),
  ];
};

const createDefaultReportForms = () => {
  const defaultRange = {
    startTime: dayjs().startOf("day").format("YYYY-MM-DDTHH:mm"),
    endTime: dayjs().format("YYYY-MM-DDTHH:mm"),
    timeType: "T01",
  };

  return {
    data: { ...defaultRange, modelTypes: [], flagOnly: false },
    daily: { ...defaultRange, modelType: "" },
    monthly: { ...defaultRange, modelTypes: [] },
  };
};

// 共用顯示元件

function EmptyState({ children, compact = false }) {
  return (
    <div
      className={`grid place-items-center rounded-xl border border-dashed border-border bg-secondary/30 px-5 text-center type-body text-muted-foreground ${compact ? "min-h-36" : "min-h-72"}`}
    >
      {children}
    </div>
  );
}

function LineSettingsDialog({
  open,
  onOpenChange,
  models,
  value,
  lineTypes,
  hourlyXAxis,
  chartLayout,
  onApply,
}) {
  const [draft, setDraft] = useState(value);
  const [draftLineTypes, setDraftLineTypes] = useState(lineTypes);
  const [draftHourlyXAxis, setDraftHourlyXAxis] = useState(hourlyXAxis);
  const [draftChartLayout, setDraftChartLayout] = useState(chartLayout);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setDraftLineTypes(lineTypes);
      setDraftHourlyXAxis(hourlyXAxis);
      setDraftChartLayout(chartLayout);
    }
  }, [chartLayout, hourlyXAxis, lineTypes, open, value]);

  const close = () => onOpenChange(false);

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="趨勢圖設定"
      description="選擇要在趨勢圖中顯示的測項，按下確定後才會套用。"
      confirmText="確定"
      cancelText="取消"
      onCancel={close}
      onConfirm={() => {
        onApply({
          visibleModels: draft,
          lineTypes: draftLineTypes,
          hourlyXAxis: draftHourlyXAxis,
          chartLayout: draftChartLayout,
        });
        close();
      }}
      className="sm:max-w-2xl"
    >
      <div className="mt-4 space-y-4">
        <div className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <BaseSelect
            label="圖表類型"
            value={draftChartLayout}
            options={LINE_CHART_LAYOUT_OPTIONS}
            onChange={setDraftChartLayout}
          />
          <div className="flex items-end pb-2">
            <BaseCheckbox
              value={draftHourlyXAxis ? ["hourly-x-axis"] : []}
              onChange={(values) => setDraftHourlyXAxis(values.includes("hourly-x-axis"))}
              items={[{ value: "hourly-x-axis", label: "X 軸變成小時刻度" }]}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="type-body font-semibold">顯示測項</span>
          <div className="flex gap-2">
            <BaseButton
              type="button"
              variant="outline"
              onClick={() => setDraft(models.map((item) => item.value))}
            >
              全選
            </BaseButton>
            <BaseButton type="button" variant="outline" onClick={() => setDraft([])}>
              清除
            </BaseButton>
          </div>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border grid gap-3 p-3 sm:grid-cols-2 sm:items-center">
        {models.map((item) => (
          <div key={item.value}>
            <BaseCheckbox
              value={draft}
              onChange={setDraft}
              items={[{
                value: item.value,
                label: item.label,
              }]}
            />
            <BaseSelect
              value={draftLineTypes[item.value] || "spline"}
              options={LINE_TYPE_OPTIONS}
              onChange={(lineType) =>
                setDraftLineTypes((current) => ({ ...current, [item.value]: lineType }))
              }
            />
          </div>
        ))}
        </div>
      </div>
    </BaseDialog>
  );
}

function BoxplotSettingsDialog({ open, onOpenChange, value, onApply }) {

  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const lower = Number(draft.lower);
  const upper = Number(draft.upper);
  const invalidLimits =
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    lower < 0 ||
    upper > 100 ||
    lower >= 50 ||
    upper <= 50 ||
    lower >= upper;
  const close = () => onOpenChange(false);

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="盒鬚圖設定"
      description="設定時間分組與盒體的上下百分位，按下確定後才會套用"
      confirmText="確定"
      cancelText="取消"
      confirmDisabled={invalidLimits}
      onCancel={close}
      onConfirm={() => {
        onApply(draft);
        close();
      }}
      className="sm:max-w-lg"
    >
      <div className="mt-4 space-y-5">
        <BaseSelect
          label="時間分組"
          value={draft.timeGroup}
          options={BOX_TIME_OPTIONS}
          onChange={(timeGroup) => setDraft((current) => ({ ...current, timeGroup }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <BaseInput
            type="number"
            min="0"
            max="49.99"
            step="1"
            label="下限百分位 (%)"
            value={draft.lower}
            onChange={(event) => setDraft((current) => ({ ...current, lower: event.target.value }))}
          />
          <BaseInput
            type="number"
            min="50.01"
            max="100"
            step="1"
            label="上限百分位 (%)"
            value={draft.upper}
            onChange={(event) => setDraft((current) => ({ ...current, upper: event.target.value }))}
          />
        </div>
        {invalidLimits && (
          <p className="type-body text-destructive ">
            下限需介於 0～50，上限需介於 50～100，且上限必須大於下限。
          </p>
        )}
        <p className="type-meta text-muted-foreground">
          預設下限 25%、上限 75%。盒鬚與離群值會依所設百分位的 IQR 重新計算。
        </p>
      </div>
    </BaseDialog>
  );
}

function HeatmapColorDialog({ open, onOpenChange, colors, stops, onApply }) {

  const [draftColors, setDraftColors] = useState(colors);
  const [draftStops, setDraftStops] = useState(stops);

  useEffect(() => {
    if (open) {
      setDraftColors(colors);
      setDraftStops(stops);
    }
  }, [colors, open, stops]);

  const close = () => onOpenChange(false);

  const updateColor = (index, color) => {
    setDraftColors((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? color : item)),
    );
  };
  const updateStop = (index, stop) => {
    setDraftStops((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? stop : item)),
    );
  };
  const numericStops = draftStops.map(Number);
  const invalidStops = numericStops.some(
    (stop, index) =>
      !Number.isFinite(stop) ||
      stop < 0 ||
      stop > 1 ||
      (index > 0 && stop < numericStops[index - 1]),
  );

  return (
    <BaseDialog
      open={open}
      onOpenChange={onOpenChange}
      title="熱點圖色彩設定"
      description="依低值到高值設定四色漸層，按下確定後才會更新熱點圖。"
      confirmText="確定"
      cancelText="取消"
      confirmDisabled={invalidStops}
      onCancel={close}
      onConfirm={() => {
        onApply({ colors: draftColors, stops: draftStops });
        close();
      }}
      className="sm:max-w-lg"
    >
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {draftColors.map((color, index) => (
          <div key={index} className="grid grid-cols-[3.5rem_1fr_5rem] items-end gap-2">
            <BaseInput
              label={`顏色 ${index + 1}`}
              type="color"
              aria-label={`顏色 ${index + 1} 色票`}
              value={color}
              onChange={(event) => updateColor(index, event.target.value)}
              className="w-14 cursor-pointer p-1"
            />
            <BaseInput
              value={color}
              onChange={(event) => updateColor(index, event.target.value)}
              pattern="^#[0-9A-Fa-f]{6}$"
              className="font-mono"
            />
            <BaseInput
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={draftStops[index]}
              onChange={(event) => updateStop(index, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-full border border-border">
        <div
          className="h-8"
          style={{
            background: `linear-gradient(90deg, ${draftColors
              .map((color, index) => `${color} ${numericStops[index] * 100}%`)
              .join(", ")})`,
          }}
        />
      </div>
      {invalidStops && (
        <p className="type-body mt-2 text-destructive">位置需介於 0～1，並依顏色順序由小到大。</p>
      )}
      <p className="type-meta mt-2 text-muted-foreground">左側代表低值，右側代表高值。</p>
    </BaseDialog>
  );
}

function RealtimeUpdateCountdown({ nextUpdateAt, refreshing }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!nextUpdateAt) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const timerId = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [nextUpdateAt]);

  const seconds = Math.max(0, Math.ceil((nextUpdateAt - now) / 1000));
  const countdown = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <span className="inline-flex items-center gap-1.5 type-meta text-muted-foreground">
      <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
      <span className="tabular-nums">
        {refreshing ? "更新中…" : !nextUpdateAt ? "等待更新" : seconds === 0 ? "等待更新…" : `下次更新 ${countdown}`}
      </span>
    </span>
  );
}

export default function DashboardPage() {
  // 頁面資料
  const [searchParams] = useSearchParams();
  const requestedStationApplied = useRef("");
  const [inspectionStation, setInspectionStation] = useState(null);
  const selectedStations = useStationSelections(getDashboardStations);
  const {
    activeKey,
    setActiveKey,
    activeStation,
    station: dashboardStation,
    dashboardStations,
    models,
    realtime,
    realtimeType,
    nextRealtimeUpdateAt,
    realtimeRefreshing,
    selectRealtimeType,
    analysis,
    reports,
    reportLoading,
    reportError,
    searchReport: fetchDashboardReport,
    history,
    loading,
    querying,
    error,
    query,
    setQuery: setDashboardQuery,
    search: searchDashboard,
    isEPA,
  } = useDashboard(selectedStations);

  useEffect(() => {
    const requestedKey = searchParams.get("station") || "";
    if (
      requestedKey &&
      requestedStationApplied.current !== requestedKey &&
      selectedStations.some((item) => keyOf(item) === requestedKey)
    ) {
      requestedStationApplied.current = requestedKey;
      setActiveKey(requestedKey);
    }
  }, [searchParams, selectedStations, setActiveKey]);

  // 分析圖表狀態
  const [lineSettingsOpen, setLineSettingsOpen] = useState(false);
  const [lineVisibleModels, setLineVisibleModels] = useState([]);
  const [lineTypes, setLineTypes] = useState({});
  const [lineHourlyXAxis, setLineHourlyXAxis] = useState(false);
  const [lineChartLayout, setLineChartLayout] = useState("multiple-axes");
  const [compareMode, setCompareMode] = useState(false);
  const [boxplotModel, setBoxplotModel] = useState("");
  const [heatmapModel, setHeatmapModel] = useState("");
  const [boxplotSettingsOpen, setBoxplotSettingsOpen] = useState(false);
  const [boxplotSettings, setBoxplotSettings] = useState({ timeGroup: "day", lower: "25", upper: "75"});
  const [heatmapColorsOpen, setHeatmapColorsOpen] = useState(false);
  const [heatmapColors, setHeatmapColors] = useState(["#3060cf", "#fffbbc", "#c4463a", "#c4463a"]);
  const [heatmapStops, setHeatmapStops] = useState(["0", "0.5", "0.9", "1"]);
  const [analysisControlsOpen, setAnalysisControlsOpen] = useState(false);
  const [selectedSensorValue, setSelectedSensorValue] = useState("");
  const [analysisSensorValue, setAnalysisSensorValue] = useState("");
  const [mobileReportOpen, setMobileReportOpen] = useState(false);
  const [mobileDistributionOpen, setMobileDistributionOpen] = useState(false);

  // 報表狀態
  const [reportType, setReportType] = useState("data");
  const [reportForms, setReportForms] = useState(createDefaultReportForms);

  // 新增測站
  const [stationSwitcherOpen, setStationSwitcherOpen] = useState(false);
  const [stationSwitchKeyword, setStationSwitchKeyword] = useState("");
  const [stationSearchOpen, setStationSearchOpen] = useState(false);
  const [stationKeyword, setStationKeyword] = useState("");
  const [authorizedStations, setAuthorizedStations] = useState([]);
  const [stationSearchLoading, setStationSearchLoading] = useState(false);
  const [stationSearchError, setStationSearchError] = useState(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const switchableStations = useMemo(() => {
    const keyword = stationSwitchKeyword.trim().toLocaleLowerCase();
    if (!keyword) return dashboardStations;
    return dashboardStations.filter((item) =>
      [item.STID, item.STName, item.Desc, item.IIT]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(keyword)),
    );
  }, [dashboardStations, stationSwitchKeyword]);

  const availableStations = useMemo(() => {
    const selectedKeys = new Set(selectedStations.map(keyOf));
    const keyword = stationKeyword.trim().toLocaleLowerCase();

    return authorizedStations
      .map((item) => ({
        ...item,
        PJID: String(item.PJID ?? item.ProjID ?? "").trim(),
        STID: String(item.STID ?? "").trim(),
      }))
      .filter((item) => item.PJID && item.STID && !selectedKeys.has(keyOf(item)))
      .filter((item) => {
        if (!keyword) return true;
        return [item.STID, item.STName, item.IIT, item.Desc]
          .some((value) => String(value ?? "").toLocaleLowerCase().includes(keyword));
      });
  }, [authorizedStations, selectedStations, stationKeyword]);

  const handleStationSearchToggle = async () => {
    setStationSearchOpen(true);
    setStationSearchLoading(true);
    setStationSearchError(null);
    try {
      const [authorizedResult, epaResult] = await Promise.allSettled([
        getAuthorizedStationsData({ enabled: 1 }),
        getTaqmnStationList(),
      ]);
      const authorized = authorizedResult.status === "fulfilled" && Array.isArray(authorizedResult.value)
        ? authorizedResult.value
        : [];
      const epa = epaResult.status === "fulfilled" && Array.isArray(epaResult.value)
        ? epaResult.value.map((item) => ({ ...item, PJID: "TAQMN" }))
        : [];

      if (authorizedResult.status === "rejected") {
        console.error("getAuthorizedStationsData error:", authorizedResult.reason);
      }
      if (epaResult.status === "rejected") {
        console.error("getTaqmnStationList error:", epaResult.reason);
      }
      if (!authorized.length && !epa.length && authorizedResult.status === "rejected" && epaResult.status === "rejected") {
        throw new Error("無法取得測站資料");
      }

      setAuthorizedStations([...authorized, ...epa]);
    } catch (searchError) {
      console.error("getAuthorizedStationsData error:", searchError);
      setAuthorizedStations([]);
      setStationSearchError("無法取得測站資料");
    } finally {
      setStationSearchLoading(false);
    }
  };

  const handleAddStation = (item) => {
    const stationToAdd = { PJID: item.PJID, STID: item.STID };
    const result = addDashboardStation(stationToAdd);
    if (!result.added) {
      setStationSearchError(
        result.reason === "duplicate" ? "此測站已在切換選單中" : "無法新增測站",
      );
      return;
    }

    setStationSearchOpen(false);
    setStationSwitcherOpen(false);
    setStationSwitchKeyword("");
    setStationKeyword("");
    setStationSearchError(null);
    window.setTimeout(() => setActiveKey(keyOf(stationToAdd)), 0);
  };

  const handleStationChange = (item) => {
    setActiveKey(keyOf(item));
    setStationSwitcherOpen(false);
    setStationSwitchKeyword("");
  };

  const handleDashboardRefresh = async () => {
    setManualRefreshing(true);
    try {
      await Promise.all([
        searchDashboard(boxplotSettings),
        isEPA ? Promise.resolve() : selectRealtimeType(realtimeType),
      ]);
    } finally {
      setManualRefreshing(false);
    }
  };

  // 測站資訊
  const wdModel = models.find((item) =>
    /(^|\b)WD\b|風向/i.test(`${item.name || ""} ${item.label || ""}`),
  );
  const wsModel = models.find((item) =>
    /(^|\b)WS\b|風速/i.test(`${item.name || ""} ${item.label || ""}`),
  );
  const hasWind = Boolean(wdModel && wsModel);
  const station = dashboardStation || activeStation;
  const stationLocation = [station?.County, station?.Town, station?.Area]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" - ");
  const stationTitle = getStationInfoTitle(station);

  // 即時數據
  const latestFive = realtime.slice(0, 5);
  const latest = latestFive[0];
  const realtimeModels = useMemo(
    () =>
      models
        .filter((item) => !isCountModel(item))
        .map((item) => {
          const valueIndex = String(item.value).match(/^Value(\d+)$/i)?.[1];
          const countModel = valueIndex
            ? models.find((candidate) => candidate.value === `Count${valueIndex}`)
            : null;

          return { ...item, countModel };
        }),
    [models],
  );
  const latestDateTime = latest?.Date_Time;
  const latestTimeLabel = latestDateTime && dayjs(latestDateTime).isValid()
    ? dayjs(latestDateTime).format("HH:mm")
    : "—";
  const latestAgeLabel = (() => {
    if (!latestDateTime || !dayjs(latestDateTime).isValid()) return "等待第一筆資料";
    const minutes = Math.max(0, dayjs().diff(dayjs(latestDateTime), "minute"));
    if (minutes < 1) return "剛剛更新";
    if (minutes < 60) return `${minutes} 分鐘前`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours} 小時前` : dayjs(latestDateTime).format("MM/DD HH:mm");
  })();
  const latestFiveDates = latestFive
    .map((row) => row.Date_Time)
    .filter(Boolean);
  const latestFiveAreSameDay = new Set(
    latestFiveDates.map((value) => dayjs(value).format("YYYY-MM-DD")),
  ).size <= 1;
  const sensorMetrics = realtimeModels.map((item) => {
    const parameterIndex = String(item.value).match(/^Value(\d+)$/i)?.[1];
    const countKey = item.countModel?.value || (parameterIndex ? `Count${parameterIndex}` : null);
    const recent = latestFive.map((row) => ({
      time: row.Date_Time,
      value: row[item.value],
      count: countKey ? row[countKey] : undefined,
    }));
    const current = recent[0];
    return {
      ...item,
      currentValue: displaySensorValue(current?.value),
      currentCount: current?.count,
      hasCount: recent.some((row) => row.count !== null && row.count !== undefined),
      recent,
    };
  });
  const selectedSensor = sensorMetrics.find((item) => item.value === selectedSensorValue)
    || sensorMetrics.find(isPm25Model)
    || sensorMetrics[0]
    || null;
  const defaultSensorValue = realtimeModels.find(isPm25Model)?.value
    || realtimeModels[0]?.value || "";
  const analysisSensor = realtimeModels.find((item) => item.value === analysisSensorValue)
    || realtimeModels.find(isPm25Model) || realtimeModels[0];
  const analysisTargetValue = analysisSensor?.value;

  // 分析圖表衍生資料
  const selectedBoxplotModel = getDashboardModels(models, boxplotModel);
  const selectedHeatmapModel = getDashboardModels(models, heatmapModel);
  const modelValuesKey = models.map((item) => item.value).join("|");

  // 分析圖表事件
  const applyBoxplotSettings = async (nextSettings) => {
    setBoxplotSettings(nextSettings);
    await searchDashboard(nextSettings);
  };

  const updateAnalysisCharts = async () => {
    await searchDashboard(boxplotSettings);
    setAnalysisControlsOpen(false);
  };

  useEffect(() => {
    setLineVisibleModels(
      models
        .filter((item) => !isCountModel(item) && (!isEPA || EPA_DEFAULT_LINE_MODEL_VALUES.has(item.value)))
        .map((item) => item.value),
    );
    setLineTypes(Object.fromEntries(models.map((item) => [item.value, "line"])));
  }, [activeKey, isEPA, modelValuesKey, models]);

  useEffect(() => {
    setSelectedSensorValue(defaultSensorValue);
  }, [activeKey, defaultSensorValue]);

  useEffect(() => {
    if (!realtimeModels.some((item) => item.value === selectedSensorValue)) {
      setSelectedSensorValue(defaultSensorValue);
    }
  }, [activeKey, defaultSensorValue, modelValuesKey, realtimeModels, selectedSensorValue]);

  useEffect(() => {
    setAnalysisSensorValue(defaultSensorValue);
  }, [activeKey, defaultSensorValue]);

  useEffect(() => {
    if (!analysisTargetValue) return;
    setBoxplotModel(analysisTargetValue);
    setHeatmapModel(analysisTargetValue);
  }, [analysisTargetValue]);

  useEffect(() => {
    const reportModels = models.filter((item) => !isCountModel(item));
    const dailyModelNames = reportModels.map((item) => item.name).filter(Boolean);
    const pm25ModelName = reportModels.find(isPm25Model)?.name;
    setReportForms((current) => {
      const defaultModel = pm25ModelName || dailyModelNames[0] || "";
      const validSelections = (values) => {
        const selections = values.filter((value) => dailyModelNames.includes(value));
        return selections.length ? selections : dailyModelNames;
      };
      return {
        data: { ...current.data, modelTypes: validSelections(current.data.modelTypes) },
        daily: {
          ...current.daily,
          modelType: dailyModelNames.includes(current.daily.modelType)
            ? current.daily.modelType
            : defaultModel,
        },
        monthly: { ...current.monthly, modelTypes: validSelections(current.monthly.modelTypes) },
      };
    });
  }, [models]);


  const dailyReportModelOptions = useMemo(
    () =>
      models
        .filter((item) => item.name)
        .map((item) => ({ value: item.name, label: item.label })),
    [models],
  );

  const multiReportModelOptions = dailyReportModelOptions;

  const currentReportForm = reportForms[reportType];
  const reportRangeInvalid = !currentReportForm.startTime || !currentReportForm.endTime
    || !dayjs(currentReportForm.startTime).isValid() || !dayjs(currentReportForm.endTime).isValid()
    || dayjs(currentReportForm.startTime).isAfter(dayjs(currentReportForm.endTime));
  const updateReportForm = (field, value) => {
    setReportForms((current) => ({
      ...current,
      [reportType]: { ...current[reportType], [field]: value },
    }));
  };
  const searchReport = async () => {
    if (
      !currentReportForm.startTime ||
      !currentReportForm.endTime ||
      dayjs(currentReportForm.startTime).isAfter(dayjs(currentReportForm.endTime))
    )
      return;

    await fetchDashboardReport(reportType, currentReportForm);
  };

  const reportRows = reports?.[reportType] || [];

  const columns = useMemo(
    () => createReportColumns(reportRows, reportType),
    [reportRows, reportType],
  );

  // Highcharts 設定
  const chartOptions = useMemo(() => {
    if (!history.length || !models.length) return {};

    const common = {
      chart: {
        height: 430,
        spacing: [18, 14, 10, 10],
        backgroundColor: "#ffffff",
        zooming: { type: "x" },
      },
      title: { text: null },
      credits: { enabled: false },
      accessibility: { enabled: false },
      exporting: {
        chartOptions: {
          chart: { backgroundColor: "#ffffff" },
        },
      },
      time: { useUTC: true },
      legend: { align: "center", verticalAlign: "top" },
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
      tooltip: { xDateFormat: "%Y-%m-%d %H:%M %A" },
      plotOptions: { series: { animation: false } },
      
    };

    const windPoints = analysis?.wind?.points;

    const windbarb =
      hasWind && Array.isArray(windPoints)
        ? (() => {
            const wind = windPoints;

            const arrowPoints = wind.map(([x, speed, direction]) => ({
              x,
              y: speed,
              direction,
              marker: { rotation: direction },
            }));

            return {
              ...common,
              xAxis: {
                type: "datetime",
                dateTimeLabelFormats: {
                  minute: '%H:%M',
                  hour:   '%H:%M' ,
                  day:    '%m/%d',
                  week:   '%m/%d',
                  month: '%Y-%m',
                  year:  '%Y'
                },
                crosshair: true,
              },
              yAxis: {
                title: {
                  text: `風速${wsModel.unit ? ` (${wsModel.unit})` : ""}`,
                },
                min: 0,
              },
              legend: {
                align: "center",
                verticalAlign: "top",
                itemDistance: 30,
              },
              tooltip: {
                useHTML: true,
                shared: true,
                formatter() {
                  const points = this.points ?? [this.point ?? this];
                  const speedPoint = points.find(
                    (point) => point.series?.name === "風速",
                  );
                  const directionPoint = points.find(
                    (point) => Number.isFinite(
                      point.point?.direction
                        ?? point.direction
                        ?? point.options?.direction,
                    ),
                  );
                  const speed = speedPoint?.y ?? directionPoint?.y;
                  const direction = directionPoint?.point?.direction
                    ?? directionPoint?.direction
                    ?? directionPoint?.options?.direction;

                  return `
                    ${dayjs.utc(this.x).format("YYYY-MM-DD HH:mm")} ${weekdayLabel(this.x)}<br/>
                    風速：<b>${speed}${wsModel.unit ? ` ${wsModel.unit}` : ""}</b><br/>
                    風向：<b>${direction}° (${windDirectionLabel(direction)})</b>
                  `;
                },
              },
              plotOptions: {
                series: { animation: false },
                scatter: { stickyTracking: false },
              },
              series: [
                {
                  type: "line",
                  name: "風速",
                  data: wind.map(([x, speed, direction]) => ({
                    x,
                    y: speed,
                    direction,
                  })),
                  color: "#22a7f0",
                  lineWidth: 3,
                  marker: { enabled: false },
                },
                {
                  type: "line",
                  name: "風向",
                  data: arrowPoints,
                  color: "#22a7f0",
                  marker: {
                    enabled: true,
                    symbol: "windArrow",
                    radius: 10,
                    fillColor: "#16c55b",
                    lineColor: "#16c55b",
                    lineWidth: 1,
                  },
                },
              ],
            };
          })()
        : null;

    const windrose =
      hasWind && analysis?.wind
        ? (() => {
            const wind = analysis.wind;

            const directions = ["N", "NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];

            return {
              ...common,
              chart: {
                ...common.chart,
                height: 520,
                polar: true,
                type: "column",
                zooming: {},
              },
              pane: {
                size: "72%",
                background: {
                  outerRadius: "100%",
                  innerRadius: "0%",
                  backgroundColor: "transparent",
                  borderColor: "#e2e8f0",
                  borderWidth: 1,
                },
              },
              legend: {
                align: "center",
                verticalAlign: "top",
                layout: "horizontal",
                itemDistance: 24,
                itemMarginBottom: 8,
                symbolRadius: 8,
                useHTML: true,
                labelFormatter() {
                  const hasValue = this.options.custom?.hasValue;
                  const color = hasValue ? "#334155" : "#94a3b8";

                  return `<span style="color:${color}">${this.name}</span>`;
                },
              },
              xAxis: {
                categories: directions,
                tickmarkPlacement: "on",
                lineWidth: 0,
                labels: {
                  style: { fontSize: "0.875rem" },
                },
              },
              yAxis: {
                min: 0,
                endOnTick: false,
                showLastLabel: true,
                title: { text: null },
                gridLineInterpolation: "circle",
              },
              tooltip: {
                useHTML: true,
                formatter() {
                  const percentage = wind.total
                    ? Math.trunc((this.y / wind.total) * 1000) / 10
                    : 0;

                  return `
                    <span style="color:${this.color}">●</span>
                    <b>${this.series.name}</b><br/>
                    方向：<b>${directions[this.point.x] ?? this.x}</b><br/>
                    次數：<b>${this.y}</b> (${percentage}%)
                  `;
                },
              },
              plotOptions: {
                column: {
                  stacking: "normal",
                  pointPlacement: "on",
                  groupPadding: 0,
                  pointPadding: 0,
                  borderWidth: 0,
                },
              },
              series: (wind.distribution || []).map((series, index) => {
                const hasValue = (series.data || []).some((value) => Number(value) > 0);

                return {
                  type: "column",
                  name: series.name,
                  data: series.data,
                  color: hasValue ? COLORS[index % COLORS.length] : "#cbd5e1",
                  custom: { hasValue },
                };
              }),
            };
          })()
        : null;

const seriesFor = (item) =>
  [...(analysis?.line?.[item.value] || [])].sort(
    (left, right) => Number(left[0]) - Number(right[0]),
  );

const visibleLineModels = models
  .map((item, index) => ({ item, index }))
  .filter(({ item }) => lineVisibleModels.includes(item.value));

const focusedLineModel = models
  .map((item, index) => ({ item, index }))
  .find(({ item }) => item.value === analysisTargetValue);

const displayedLineModels = compareMode
  ? visibleLineModels
  : focusedLineModel
    ? [focusedLineModel]
    : visibleLineModels.slice(0, 1);

const isSplitAxes =
  compareMode &&
  lineChartLayout === "split-axes" &&
  displayedLineModels.length > 0;

const hasSeparateLineAxes =
  compareMode &&
  lineChartLayout !== "normal" &&
  displayedLineModels.length > 0;

const splitAxisHeight = displayedLineModels.length
  ? 100 / displayedLineModels.length
  : 100;


/* ==============================
   Y Axis
============================== */

const lineYAxis = hasSeparateLineAxes
  ? displayedLineModels.map(({ item }, axisIndex) => ({
      title: {
        text: getModelChartLabel(item),
      },

      opposite: true,

      ...(isSplitAxes
        ? {
            top: `${axisIndex * splitAxisHeight}%`,
            height: `${splitAxisHeight}%`,

            offset: 0,

            // 不顯示 Y 軸線
            lineWidth: 0,

            // 不顯示 Y 軸刻度
            labels: {
              enabled: false,
            },

            tickLength: 0,
            tickWidth: 0,
          }
        : {}),
    }))
  : {
      // normal 模式完整恢復 Y 軸
      top: "0%",
      height: "100%",
      offset: 0,

      title: {
        text: null,
      },

      labels: {
        enabled: true,
      },

      lineWidth: 0,
      tickLength: 0,
    };


/* ==============================
   Line Chart
============================== */

const line = {
  ...common,

  chart: {
    ...common.chart,

    height: isSplitAxes
      ? Math.max(430, displayedLineModels.length * 180)
      : common.chart.height,

    alignTicks: !isSplitAxes,
  },

  xAxis: {
    type: "datetime",
    crosshair: true,

    // 每次模式切換都明確重新設定
    lineWidth: 1,
    tickLength: 10,

    labels: {
      enabled: true,
    },

    ...(lineHourlyXAxis
      ? {
          tickInterval: 60 * 60 * 1000,
          labels: {
            enabled: true,
            format: "{value:%m/%d %H:%M}",
            rotation: -90,
            align: "right",
          },
        }
      : {}),

    dateTimeLabelFormats: {
      minute: "%H:%M",
      hour: "%H:%M",
      day: "%Y-%m-%d",
    },
  },

  yAxis: lineYAxis,

  tooltip: {
    ...common.tooltip,
    shared: true,
  },

  series: displayedLineModels.map(
    ({ item, index }, axisIndex) => ({
      name: getModelChartLabel(item),

      data: seriesFor(item),

      color: compareMode
        ? COLORS[index % COLORS.length]
        : COLORS[0],

      yAxis: hasSeparateLineAxes
        ? axisIndex
        : 0,

      lineWidth: compareMode ? 2 : 3,

      marker: {
        enabled: false,
      },

      ...getLineSeriesStyle(lineTypes[item.value]),
    }),
  ),
};

    const selectedBoxplot =
      analysis?.boxplots?.[selectedBoxplotModel?.value] || {
        categories: [],
        data: [],
        outliers: [],
      };

    const boxplot = {
      ...common,
      xAxis: {
        categories: selectedBoxplot.categories,
        tickWidth: 1,
        tickmarkPlacement: "on",
      },
      yAxis: {
        title: {
          text: getModelChartLabel(selectedBoxplotModel, "數值分布"),
        },
      },
      series: [
        {
          type: "boxplot",
          name: getModelChartLabel(selectedBoxplotModel, "數值分布"),
          data: selectedBoxplot.data,
          color: COLORS[0],
          fillColor: "rgba(44,175,254,.18)",
          tooltip: {
            pointFormat:
              "最大值：<b>{point.high}</b><br/>" +
              "第三四分位數：<b>{point.q3}</b><br/>" +
              "中位數：<b>{point.median}</b><br/>" +
              "第一四分位數：<b>{point.q1}</b><br/>" +
              "最小值：<b>{point.low}</b>",
          },
        },
        {
          type: "scatter",
          name: "離群值",
          data: selectedBoxplot.outliers,
          color: COLORS[1],
          tooltip: {
            pointFormat: "離群值：<b>{point.y}</b>",
          },
        },
      ],
    };

    const selectedHeatmap =
      analysis?.heatmaps?.[selectedHeatmapModel?.value] || {
        days: [],
        data: [],
      };

    const heatmap = {
      ...common,
      chart: {
        ...common.chart,
        type: "heatmap",
      },
      xAxis: {
        categories: selectedHeatmap.days,
        tickWidth: 1,
        tickmarkPlacement: "on",
      },
      yAxis: {
        title: { text: '時' },
        categories: Array.from({ length: 24 }, (_, hour) => `${hour}:00`),
        tickInterval: 4,
        startOnTick: false,
        endOnTick: false,
        min: -0.5,
        max: 23.5,
      },
      colorAxis: {
        stops: heatmapColors.map((color, index) => [Number(heatmapStops[index]), color]),
      },
      tooltip: {
        formatter() {
          return `
            <b>${selectedHeatmap.days[this.point.x]} ${String(this.point.y).padStart(2, "0")}:00 ${weekdayLabel(selectedHeatmap.days[this.point.x])}</b><br/>
            ${getModelChartLabel(selectedHeatmapModel)}: ${this.point.value}
          `;
        },
      },
      series: [
        {
          type: "heatmap",
          name: getModelChartLabel(selectedHeatmapModel),
          borderWidth: 1,
          borderColor: "rgba(255,255,255,.65)",
          rowsize: 1,
          data: selectedHeatmap.data,
        },
      ],
    };

    return {
      line,
      boxplot,
      heatmap,
      windrose,
      windbarb,
    };
  }, [
    analysis,
    history,
    models,
    lineVisibleModels,
    lineTypes,
    lineHourlyXAxis,
    lineChartLayout,
    hasWind,
    heatmapColors,
    heatmapStops,
    selectedBoxplotModel,
    selectedHeatmapModel,
    analysisTargetValue,
    compareMode,
    wsModel,
  ]);

  if (!selectedStations.length)
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <BaseCard className="w-full max-w-2xl" contentClassName="p-6 sm:p-8">
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-light text-primary"><MapPin size={26} /></span>
            <h1 className="mt-5 text-2xl font-semibold text-foreground">尚未加入測站</h1>
            <p className="mx-auto mt-2 max-w-md type-body text-muted-foreground">加入測站後即可查看即時監測數據、趨勢與詳細報表。</p>
            {!stationSearchOpen && (
              <BaseButton className="mt-6" onClick={handleStationSearchToggle}><Plus size={16} /> 新增測站</BaseButton>
            )}
          </div>
          {stationSearchOpen && (
            <div className="mt-6 rounded-2xl border border-border bg-secondary/30 p-4 text-left">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div><p className="font-semibold text-foreground">新增測站</p><p className="type-meta text-muted-foreground">搜尋測站或 EPA 測站</p></div>
                <BaseButton variant="ghost" size="icon-xs" onClick={() => setStationSearchOpen(false)}><X size={15} /></BaseButton>
              </div>
              <BaseInput autoFocus value={stationKeyword} onChange={(event) => setStationKeyword(event.target.value)} placeholder="搜尋 STID 或測站名稱..." endAdornment={<Search size={16} className="text-muted-foreground" />} />
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-border bg-card p-2">
                {stationSearchLoading ? [1,2,3].map((item) => <div key={item} className="mb-2 h-14 animate-pulse rounded-xl bg-secondary last:mb-0" />) : stationSearchError ? (
                  <p className="px-3 py-8 text-center type-body text-destructive">{stationSearchError}</p>
                ) : availableStations.length ? availableStations.map((item) => (
                  <div key={keyOf(item)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary">
                    <MapPin size={16} className="shrink-0 text-primary" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate type-body font-semibold">({item.STID}) {item.IIT}</span>
                      <span className="block truncate type-meta text-muted-foreground">{item.STName || item.Desc}</span>
                    </span>
                    <BaseButton size="sm" variant="outline" onClick={() => handleAddStation(item)}>新增</BaseButton>
                  </div>
                )) : <p className="px-3 py-8 text-center type-body text-muted-foreground">沒有可新增的授權測站</p>}
              </div>
            </div>
          )}
        </BaseCard>
      </div>
    );

  return (
    <main className="space-y-8 highcharts-light">
      <header className="relative rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 type-meta font-semibold uppercase tracking-[0.16em] text-primary">
              <Activity size={15} /> Dashboard
            </div>
            <h1 className="mt-1.5 wrap-break-word text-lg font-semibold tracking-tight text-foreground sm:mt-2 sm:text-3xl">
              {isEPA ? station?.STID : station?.IIT}
              <span className="mx-2 font-normal text-muted-foreground">·</span>
              {station?.STName || station?.Desc}
            </h1>
            <div className="mt-2 hidden flex-wrap items-center gap-x-4 gap-y-1 type-body text-muted-foreground sm:flex">
              {!isEPA && <span>{station?.IIT}</span>}
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} /> {displayStationValue(stationLocation)}
              </span>
              {station?.BinVer && <span>軟體 {station.BinVer}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <BaseButton
              variant="outline"
              size="sm"
              onClick={handleDashboardRefresh}
              loading={manualRefreshing}
            >
              <RefreshCw size={15} /> 重新整理
            </BaseButton>
            <div className="relative">
              <BaseButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStationSwitcherOpen((open) => !open);
                  setStationSearchOpen(false);
                  setStationKeyword("");
                  setStationSearchError(null);
                }}
              >
                <MapPin size={15} />
                <span className="truncate"> 切換測站</span>
                <ChevronDown size={14}/>
              </BaseButton>

              {stationSwitcherOpen && (
                <>
                  <button
                    type="button"
                    aria-label="關閉測站選單"
                    className="fixed inset-0 z-30 bg-foreground/20 sm:hidden"
                    onClick={() => setStationSwitcherOpen(false)}
                  />

                  <div
                    className="
                      fixed inset-x-4 bottom-4 z-40
                      flex max-h-[70dvh] flex-col overflow-hidden
                      rounded-xl border border-border bg-card shadow-lg

                      sm:absolute sm:inset-x-auto sm:bottom-auto
                      sm:right-0 sm:top-full sm:mt-2
                      sm:w-96 sm:max-h-128
                    "
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setStationSwitcherOpen(false);
                      }
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {stationSearchOpen ? "新增測站" : "選擇測站"}
                        </p>

                        {!stationSearchOpen && (
                          <p className="text-sm text-muted-foreground">
                            點選後直接切換
                          </p>
                        )}
                      </div>

                      <BaseButton
                        variant="ghost"
                        size="icon-xs"
                        aria-label="關閉測站選單"
                        onClick={() => setStationSwitcherOpen(false)}
                      >
                        <X size={16} />
                      </BaseButton>
                    </div>

                    {!stationSearchOpen ? (
                      <>
                        {/* 搜尋 */}
                        <div className="border-b border-border p-3">
                          <BaseInput
                            autoFocus
                            aria-label="搜尋已加入測站"
                            value={stationSwitchKeyword}
                            onChange={(event) =>
                              setStationSwitchKeyword(event.target.value)
                            }
                            placeholder="搜尋已加入的測站..."
                            endAdornment={
                              <Search
                                size={15}
                                className="text-muted-foreground"
                              />
                            }
                          />
                        </div>

                        {/* 已加入測站 */}
                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                          <p className="px-2 py-1 text-sm font-medium text-muted-foreground">
                            已加入的測站
                          </p>

                          <div className="space-y-1">
                            {switchableStations.length ? (
                              switchableStations.map((item) => {
                                const active = activeKey === keyOf(item);

                                return (
                                  <div
                                    key={keyOf(item)}
                                    className="group flex items-center gap-1"
                                  >
                                    <button
                                      type="button"
                                      aria-pressed={active}
                                      className={`
                                        flex min-w-0 flex-1 items-center gap-3
                                        rounded-lg px-3 py-2.5 text-left
                                        transition-colors
                                        ${
                                          active
                                            ? "bg-accent/20 text-accent"
                                            : "hover:bg-secondary"
                                        }
                                      `}
                                      onClick={() =>
                                        handleStationChange(item)
                                      }
                                    >
                                      <span
                                        className={`size-2 shrink-0 rounded-full ${
                                          active
                                            ? "bg-accent"
                                            : "bg-muted-foreground/30"
                                        }`}
                                      />

                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-semibold">
                                          ({item.STID}) {item.IIT}
                                        </span>

                                        <span className="block truncate text-sm text-muted-foreground">
                                          {item.STName || item.Desc}
                                        </span>
                                      </span>

                                      {active && (
                                        <Check
                                          size={15}
                                          className="shrink-0"
                                        />
                                      )}
                                    </button>

                                    <BaseButton
                                      variant="ghost"
                                      size="icon-xs"
                                      className="shrink-0 text-muted-foreground hover:text-foreground"
                                      aria-label={`移除 ${getStationInfoTitle(item)}`}
                                      onClick={() =>
                                        removeDashboardStation(
                                          item.PJID,
                                          item.STID,
                                        )
                                      }
                                    >
                                      <X size={13} />
                                    </BaseButton>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                                找不到符合的測站
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-border p-2">
                          <button
                            type="button"
                            className="
                              flex w-full items-center justify-center gap-2
                              rounded-lg px-3 py-2.5
                              font-medium text-accent
                              hover:bg-accent/20
                              sm:justify-start
                            "
                            onClick={handleStationSearchToggle}
                          >
                            <Plus size={15} />
                            新增測站
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
                          <button
                            type="button"
                            className="grid size-8 place-items-center rounded-lg hover:bg-secondary"
                            onClick={() => {
                              setStationSearchOpen(false);
                              setStationKeyword("");
                              setStationSearchError(null);
                            }}
                            aria-label="返回選擇測站"
                          >
                            <ArrowLeft size={16} />
                          </button>

                          <div className="min-w-0">
                            <p className="font-semibold">
                              新增測站
                            </p>
                          </div>
                        </div>

                        <div className="p-3">
                          <BaseInput
                            autoFocus
                            aria-label="搜尋測站或 EPA 測站"
                            value={stationKeyword}
                            onChange={(event) =>
                              setStationKeyword(event.target.value)
                            }
                            placeholder="搜尋 STID 或測站名稱..."
                            disabled={stationSearchLoading}
                            endAdornment={
                              <Search
                                size={15}
                                className="text-muted-foreground"
                              />
                            }
                          />
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border p-2">
                          {stationSearchLoading ? (
                            <div className="space-y-2">
                              {[1, 2, 3].map((item) => (
                                <div
                                  key={item}
                                  className="h-14 animate-pulse rounded-lg bg-secondary"
                                />
                              ))}
                            </div>
                          ) : stationSearchError ? (
                            <p className="px-3 py-8 text-center text-sm text-destructive">
                              {stationSearchError}
                            </p>
                          ) : availableStations.length ? (
                            <div className="space-y-1">
                              {availableStations.map((item) => (
                                <div
                                  key={keyOf(item)}
                                  className="
                                    flex items-center gap-3
                                    rounded-lg px-3 py-2.5
                                    hover:bg-secondary
                                  "
                                >
                                  <MapPin
                                    size={16}
                                    className="shrink-0 text-muted-foreground"
                                  />

                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">
                                      ({item.STID}) {item.IIT}
                                    </span>

                                    <span className="block truncate text-sm text-muted-foreground">
                                      {item.STName || item.Desc }
                                    </span>
                                  </span>

                                  <BaseButton
                                    size="sm"
                                    variant="outline"
                                    className="shrink-0"
                                    onClick={() =>
                                      handleAddStation(item)
                                    }
                                  >
                                    新增
                                  </BaseButton>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                              {stationKeyword
                                ? "找不到符合的測站"
                                : "沒有其他可新增的測站"}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
           {!isEPA && (
            <BaseButton
              variant="warm"
              size="sm"
              onClick={() => setInspectionStation({ project: activeStation.PJID, station: activeStation.STID })}
              disabled={!activeStation?.PJID || !activeStation?.STID}
            >
              <ClipboardCheck size={15} /> 巡檢
            </BaseButton>
           )}
            
          </div>
        </div>
      </header>

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 type-body text-destructive ">
          {error}
        </p>
      )}

      <section id="realtime" className="scroll-mt-20 space-y-3 md:space-y-4" aria-labelledby="realtime-title">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 id="realtime-title" className="type-card-title font-semibold text-foreground">即時數據</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="type-meta font-semibold text-muted-foreground">資料間隔</span>
            <div>
              <BaseTab value={realtimeType} onChange={selectRealtimeType} items={isEPA ? [{ value: "T60", label: "T60" }] : DASHBOARD_TIME_TYPES} />
            </div>
          </div>
        </div>

      <div aria-labelledby="sensor-overview-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="sensor-overview-title" className="type-body font-semibold text-foreground">感測器最新值</h3>
            <p className="mt-0.5 type-meta text-muted-foreground">點選測項查看最近資料；下方數據分析可獨立選擇測項。更新 {latestTimeLabel}</p>
          </div>
          <RealtimeUpdateCountdown nextUpdateAt={nextRealtimeUpdateAt} refreshing={realtimeRefreshing} />
        </div>
        {loading && !latest ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-5">{[1,2,3,4,5].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-border bg-card p-3 md:h-36 md:p-4"><div className="h-3 w-16 rounded bg-secondary" /><div className="mt-4 h-8 w-20 rounded bg-secondary" /></div>)}</div>
        ) : sensorMetrics.length && latest ? (
          <>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4 md:gap-3 lg:grid-cols-5">
              {sensorMetrics.map((item, index) => {
                const selected = selectedSensor?.value === item.value;
                const isOddLast = sensorMetrics.length % 2 === 1 && index === sensorMetrics.length - 1;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedSensorValue(item.value)}
                    className={`min-w-0 rounded-xl border p-3 text-left shadow-sm transition-colors md:p-4 ${selected ? "border-primary bg-primary/5 ring-1 ring-primary/15" : "border-border bg-card hover:border-primary/50"} ${isOddLast ? "col-span-2 md:col-span-1" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 truncate type-meta font-semibold text-muted-foreground">
                        <span className={`size-2.5 shrink-0 rounded-full ${selected ? "bg-primary" : "bg-muted-foreground/35"}`} />
                        <span className="truncate">{item.name || item.label || item.value}</span>
                      </p>
                      {selected && <Check size={16} className="shrink-0 text-primary" aria-label="已選取" />}
                    </div>
                    <p className="mt-3 truncate text-2xl font-bold tabular-nums text-foreground md:mt-4 md:text-3xl">
                      {item.currentValue} <span className="text-xs font-normal text-muted-foreground md:text-sm">{item.unit || ""}</span>
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 type-meta text-muted-foreground md:mt-3">
                      {item.currentCount !== null && item.currentCount !== undefined && (
                        <span className="truncate tabular-nums"><span className="md:hidden">Count </span><span className="hidden md:inline">Count </span><span className="font-semibold text-foreground">{displayCountValue(item.currentCount)}</span></span>
                      )}
                      <span className="hidden tabular-nums md:inline">{latestTimeLabel}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedSensor && (
              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm md:mt-4">
                <h3 className="px-4 py-3 type-body font-semibold md:px-5 md:py-4">
                  {selectedSensor.name ||
                    selectedSensor.label ||
                    selectedSensor.value}{" "}
                  · 最近監測
                </h3>

                <div className="border-t border-border px-3 py-2 md:px-5 md:py-3">
                  {selectedSensor.recent.map((row, rowIndex) => (
                    <div
                      key={`${row.time}-${rowIndex}`}
                      className={`
                        grid items-center gap-3 rounded-lg px-2 py-2 type-body tabular-nums
                        ${
                          selectedSensor.hasCount
                            ? "grid-cols-[minmax(4.5rem,.8fr)_minmax(0,1fr)_minmax(4rem,.8fr)]"
                            : "grid-cols-[minmax(4.5rem,.8fr)_minmax(0,1fr)]"
                        }
                        ${
                          rowIndex === 0
                            ? "bg-secondary/70 font-semibold"
                            : "text-muted-foreground"
                        }
                      `}
                    >
                      <span>
                        {row.time && dayjs(row.time).isValid()
                          ? dayjs(row.time).format(
                              latestFiveAreSameDay ? "HH:mm" : "MM/DD HH:mm"
                            )
                          : row.time || "--"}
                      </span>

                      <span className="text-right text-foreground">
                        {displaySensorValue(row.value)}
                        {hasSensorValue(row.value) && selectedSensor.unit
                          ? ` ${selectedSensor.unit}`
                          : ""}
                      </span>

                      {selectedSensor.hasCount && (
                        <span className="text-right">
                          <span className="mr-1 text-muted-foreground">
                            Count
                          </span>
                          {displayCountValue(row.count)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <Activity className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-foreground">目前沒有監測資料</p>
            <p className="mt-1 type-body text-muted-foreground">此測站目前尚未回傳即時感測數值。</p>
            <BaseButton className="mt-4" variant="outline" onClick={handleDashboardRefresh}><RefreshCw size={15} /> 重新整理</BaseButton>
          </div>
        )}
      </div>
      </section>

      {/* 圖表查詢條件 */}
      <section id="analysis" className="scroll-mt-24 space-y-4 md:space-y-6" aria-labelledby="analysis-title">
        <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="analysis-title" className="type-card-title font-semibold text-foreground">數據分析</h2>
            <p className="mt-1 type-meta text-muted-foreground">針對目前選取的感測項目進行趨勢與分布分析</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full min-w-0 sm:w-64">
              <BaseSelect label="分析測項" value={analysisTargetValue || ""} options={realtimeModels} onChange={setAnalysisSensorValue} placeholder="請選擇分析測項" />
            </div>
            <BaseButton variant="outline" onClick={() => setAnalysisControlsOpen(true)}><SlidersHorizontal size={15} />分析條件</BaseButton>
          </div>
        </div>
        <BaseDialog
          open={analysisControlsOpen}
          onOpenChange={setAnalysisControlsOpen}
          hideFooter
          title="時間範圍與分析條件"
          description="設定分析時間與資料間隔，再更新圖表。"
        >
          <div className="mb-4 text-right">
            <span className="type-meta tabular-nums text-muted-foreground">
              {history.length.toLocaleString()} 筆 · {models.length} 項
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <BaseInput
              type="datetime-local"
              label="開始時間"
              value={query.startTime}
              onChange={(event) =>
                setDashboardQuery((value) => ({ ...value, startTime: event.target.value }))
              }
            />
            <BaseInput
              type="datetime-local"
              label="結束時間"
              value={query.endTime}
              onChange={(event) =>
                setDashboardQuery((value) => ({ ...value, endTime: event.target.value }))
              }
            />
            <BaseSelect
              label="時間類型"
              value={query.timeType}
              options={
                isEPA
                  ? DASHBOARD_TIME_TYPES.filter((item) => item.value === "T60")
                  : DASHBOARD_TIME_TYPES
              }
              onChange={(timeType) => setDashboardQuery((value) => ({ ...value, timeType }))}
              disabled={isEPA}
            />
            <div className="flex items-end">
              <BaseButton
                className="h-11 w-full"
                loading={querying}
                onClick={updateAnalysisCharts}
              >
                <Search size={16} className="mr-2" />
                更新圖表
              </BaseButton>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 type-meta ">
            <span className="rounded-full bg-secondary px-3 py-1.5 text-muted-foreground">
              {dayjs(query.startTime).format("YYYY/MM/DD HH:mm")} →{" "}
              {dayjs(query.endTime).format("YYYY/MM/DD HH:mm")}
            </span>
            {query.timeType !== "T60" && (
              <span className="text-muted-foreground">熱點圖僅在 T60 顯示</span>
            )}
            {!hasWind && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Wind size={13} />
                缺少 WD、WS，風圖暫停顯示
              </span>
            )}
          </div>
        </BaseDialog>

      {/* 分析圖表 */}
      {history.length ? (
        <div id="charts" className="scroll-mt-24 space-y-4 md:space-y-6" aria-label="目前感測項目分析圖表">
          <BaseCard
            title={`${analysisSensor?.name || analysisSensor?.label || "監測數值"} 趨勢`}
            subtitle={compareMode ? "顯示「圖表設定」中勾選的測項，可開啟設定調整" : "目前只顯示選取的測項；選擇「已選測項」可比較多個測項"}
            headerRight={
              <>
                <div className="flex gap-1 rounded-xl bg-secondary p-1" role="group" aria-label="趨勢圖顯示測項">
                  <BaseButton className="min-h-11" variant={!compareMode ? "default" : "ghost"} aria-pressed={!compareMode} onClick={() => setCompareMode(false)}>
                    只留單測項
                  </BaseButton>
                  <BaseButton className="min-h-11" variant={compareMode ? "default" : "ghost"} aria-pressed={compareMode} onClick={() => setCompareMode(true)} title="顯示圖表設定中已勾選的測項">
                    已選測項
                  </BaseButton>
                </div>
                <BaseButton variant="outline" onClick={() => setLineSettingsOpen(true)}>
                  <SlidersHorizontal size={16}/> 圖表設定
                </BaseButton>
              </>
            }
          >
            <Chart options={chartOptions.line}>
              <Exporting 
                sourceWidth={1200} 
                sourceHeight={800} 
                scale={2} 
              />
            </Chart>
          </BaseCard>
          <LineSettingsDialog
            open={lineSettingsOpen}
            onOpenChange={setLineSettingsOpen}
            models={models}
            value={lineVisibleModels}
            lineTypes={lineTypes}
            hourlyXAxis={lineHourlyXAxis}
            chartLayout={lineChartLayout}
            onApply={({
              visibleModels,
              lineTypes: nextLineTypes,
              hourlyXAxis,
              chartLayout,
            }) => {
              setLineVisibleModels(visibleModels);
              setLineTypes(nextLineTypes);
              setLineHourlyXAxis(hourlyXAxis);
              setLineChartLayout(chartLayout);
            }}
          />
          <BaseButton className="w-full md:hidden" variant="outline" onClick={() => setMobileDistributionOpen((open) => !open)} aria-expanded={mobileDistributionOpen}>{mobileDistributionOpen ? "收合分布與進階分析" : "查看分布與進階分析"}</BaseButton>
          <div className={`${mobileDistributionOpen ? "block" : "hidden"} space-y-4 md:block md:space-y-6`}>
          <BaseCard
            title={`${analysisSensor?.name || analysisSensor?.label || "監測數值"} 資料分布`}
            headerRight={
              <BaseButton variant="outline" onClick={() => setBoxplotSettingsOpen(true)}>
                <SlidersHorizontal size={16}/> 設定
              </BaseButton>
            }
          >
            <Chart options={chartOptions.boxplot}>
              <Exporting 
                sourceWidth={1200} 
                sourceHeight={800} 
                scale={2} 
              />
            </Chart>
          </BaseCard>
          <BoxplotSettingsDialog
            open={boxplotSettingsOpen}
            onOpenChange={setBoxplotSettingsOpen}
            value={boxplotSettings}
            onApply={applyBoxplotSettings}
          />
          {query.timeType === "T60" && (
            <BaseCard
              title={`${analysisSensor?.name || analysisSensor?.label || "監測數值"} 熱點圖`}
              headerRight={
                <BaseButton variant="outline" onClick={() => setHeatmapColorsOpen(true)}>
                  <SlidersHorizontal size={16}/> 設定
                </BaseButton>
              }
            >
              <Chart options={chartOptions.heatmap}>
                <Exporting 
                  sourceWidth={1200} 
                  sourceHeight={800} 
                  scale={2} 
                />
              </Chart>
            </BaseCard>
          )}
          <HeatmapColorDialog
            open={heatmapColorsOpen}
            onOpenChange={setHeatmapColorsOpen}
            colors={heatmapColors}
            stops={heatmapStops}
            onApply={({ colors, stops }) => {
              setHeatmapColors(colors);
              setHeatmapStops(stops);
            }}
          />
          {hasWind && (
            <div className="grid gap-6 xl:grid-cols-2">
              <BaseCard title="風瑰圖">
                <Chart options={chartOptions.windrose}>
                  <Exporting 
                    sourceWidth={1200} 
                    sourceHeight={800} 
                    scale={2} 
                  />
                </Chart>
              </BaseCard>
              <BaseCard title="風向風速圖">
                <Chart options={chartOptions.windbarb}>
                  <Exporting 
                    sourceWidth={1200} 
                    sourceHeight={800} 
                    scale={2} 
                  />
                </Chart>
              </BaseCard>
            </div>
          )}
          </div>
        </div>
      ) : (
        <BaseCard>
          <EmptyState>
            <div>
              <BarChart3 className="mx-auto mb-3 text-primary" />
              <p className="font-semibold text-foreground">尚未產生圖表</p>
              <p className="mt-1">設定條件後更新圖表。</p>
            </div>
          </EmptyState>
        </BaseCard>
      )}

        <div className="overflow-hidden rounded-xl border border-border bg-card" aria-label="測站資訊">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="type-body font-semibold text-foreground">測站資訊</p>
              <p className="mt-0.5 truncate type-meta text-muted-foreground">{stationTitle}{stationLocation ? ` · ${stationLocation}` : ""}</p>
            </div>
          </div>
          <div className="border-t border-border p-4 sm:p-5">
            {station?.geoLat && station?.geoLng ? (
              <GoogleMap
                key={activeKey}
                lat={station.geoLat}
                lng={station.geoLng}
                markers={EMPTY_MAP_MARKERS}
                zoom={16}
              />
            ) : (
              <EmptyState compact>此測站尚未設定座標</EmptyState>
            )}
          </div>
        </div>
      </section>

      {/* 獨立報表查詢 */}
      <section id="reports" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div><h2 className="type-card-title font-semibold text-foreground">報表</h2><p className="mt-1 type-meta text-muted-foreground">查詢、檢視及匯出歷史監測資料</p></div>
          <BaseButton className="md:hidden" variant="outline" onClick={() => setMobileReportOpen((open) => !open)} aria-expanded={mobileReportOpen}>{mobileReportOpen ? "收合查詢" : "展開查詢"}</BaseButton>
        </div>
        <div className={mobileReportOpen ? "block" : "hidden md:block"}>
        <BaseCard
          title="查詢條件"
          subtitle="先選報表類型，再設定時間與測項，按「查詢」。結果載入後即可下載 CSV 或 PDF "
        >
          <BaseTab value={reportType} onChange={setReportType} items={REPORT_TABS} />
          <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <BaseInput
                type="datetime-local"
                label="開始時間"
                value={currentReportForm.startTime}
                onChange={(event) => updateReportForm("startTime", event.target.value)}
              />
              <BaseInput
                type="datetime-local"
                label="結束時間"
                value={currentReportForm.endTime}
                onChange={(event) => updateReportForm("endTime", event.target.value)}
              />
              {reportType === "data" && (
                <BaseSelect
                  label="時間類型"
                  value={isEPA ? "T60" : currentReportForm.timeType}
                  options={
                    isEPA
                      ? DASHBOARD_TIME_TYPES.filter((item) => item.value === "T60")
                      : DASHBOARD_TIME_TYPES
                  }
                  onChange={(timeType) => updateReportForm("timeType", timeType)}
                  disabled={isEPA}
                />
              )}
              {reportType === "daily" ? (
                <BaseSelect
                  label="測項"
                  value={currentReportForm.modelType}
                  options={dailyReportModelOptions}
                  onChange={(modelType) => updateReportForm("modelType", modelType)}
                  placeholder="選擇測項"
                />
              ) : (
                <BaseMultiSelect
                  label="測項"
                  value={currentReportForm.modelTypes}
                  options={multiReportModelOptions}
                  onChange={(modelTypes) => updateReportForm("modelTypes", modelTypes)}
                  placeholder="請選擇一個或多個測項"
                />
              )}
              {reportType === "data" && !isEPA && (
                <label className="order-last flex min-h-11 items-center gap-3 self-end px-3 py-2 type-body font-medium md:col-span-2 xl:col-span-5">
                  <input
                    type="checkbox"
                    checked={currentReportForm.flagOnly}
                    onChange={(event) => updateReportForm("flagOnly", event.target.checked)}
                  />
                  顯示 Flag 欄位
                </label>
              )}
              <div className="flex items-end">
                <BaseButton
                  className="h-11 w-full"
                  loading={reportLoading}
                  onClick={searchReport}
                  disabled={reportRangeInvalid || (
                    reportType === "daily"
                      ? !currentReportForm.modelType
                      : !currentReportForm.modelTypes.length
                  )}
                >
                  <Search size={16} />
                  查詢
                </BaseButton>
              </div>
            </div>
          </div>
        </BaseCard>
        </div>
          {reportRangeInvalid && (mobileReportOpen || reportRows.length > 0) && <p role="alert" className="type-body text-destructive">請填寫有效時間，且結束時間不可早於開始時間。</p>}
          {reportError && (
            <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 type-body text-destructive ">
              {reportError}
            </p>
          )}
          <div className={mobileReportOpen || reportRows.length > 0 || reportLoading ? "block" : "hidden md:block"}>
          <BaseCard title="查詢結果" subtitle={`${reportRows.length.toLocaleString()} 筆`} headerRight={reportRows.length > 0 && <><ExportCSVButton data={reportRows} columns={columns} filename={`${activeStation?.STID || "station"}-${reportType}`} /><ExportPDFButton data={reportRows} columns={columns} filename={`${activeStation?.STID || "station"}-${reportType}`} /></>}>
            {reportRows.length ? (
              <div className="min-w-0 max-w-full overflow-x-auto"><BaseTable columns={columns} data={reportRows} /></div>
            ) : (
              <EmptyState compact>
                {reportLoading ? "載入中…" : "設定條件後查詢"}
              </EmptyState>
            )}
          </BaseCard>
          </div>
      </section>
      {inspectionStation && (
        <InspectionEntry dashboardStation={inspectionStation} onClose={() => setInspectionStation(null)} />
      )}
    </main>
  );
}
