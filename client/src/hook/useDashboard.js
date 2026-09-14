import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { getStationDetailInfoData } from "@/api/station";
import { getTaqmnStationList } from "@/api/openData";
import {
  getStationDashboardRealtime,
  getStationDashboardLine,
  getStationDashboardBoxplot,
  getStationDashboardHeatmap,
  getStationDashboardWindRose,
  getStationDashboardWindVector,
  getStationDashboardTable,
  getStationDashboardDailyReport,
  getStationDashboardMonthlyReport,
  getEpaDashboardRealtime,
  getEpaDashboardLine,
  getEpaDashboardBoxplot,
  getEpaDashboardHeatmap,
  getEpaDashboardWindRose,
  getEpaDashboardWindVector,
  getEpaDashboardTable,
  getEpaDashboardDailyReport,
  getEpaDashboardMonthlyReport,
} from "@/api/chart";

const EPA_PROJECT_IDS = new Set(["EPA", "TAQMN"]);
const REALTIME_INTERVALS = { T01: 60_000, T05: 5 * 60_000, T60: 60 * 60_000 };
const EMPTY_REPORTS = { data: [], daily: [], monthly: [] };
const isEPA = (form) => EPA_PROJECT_IDS.has(form?.PJID);
const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback;

const millisecondsUntilNextRealtimeUpdate = (type, now = Date.now()) => {
  const interval = REALTIME_INTERVALS[type] || REALTIME_INTERVALS.T01;
  const remainder = now % interval;
  return remainder === 0 ? interval : interval - remainder;
};

const formatRows = (rows, dateFormat = "YYYY-MM-DD HH:mm") =>
  (rows || []).map((item) => {
    const date = item.Date_Time;
    const isDateOnly = dateFormat === "YYYY-MM-DD"
      && /^\d{4}-\d{2}-\d{2}$/.test(String(date));
    return {
      ...item,
      Date_Time: date
        ? isDateOnly
          ? String(date)
          : dayjs(date).utc().format(dateFormat)
        : item.period || "",
    };
  });


const formatRealtimeRows = (rows, models) =>
  formatRows(rows).map((row) => {
    const formatted = { ...row };
    (models || []).forEach((model) => {
      formatted[model.value] = row[model.value];
    });
    return formatted;
  });

const formatReportRows = (rows, reportType) =>
  formatRows(
    rows,
    reportType === "data" ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD ",
  ).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        key === "Date_Time"
        ? value 
        : value === null || value === undefined
          ? "-"
          : value,
      ]),
    ),
  );

const FEATURE_CONFIG = {
  line: {
    initialData: { history: [], line: null },
    stationRequest: getStationDashboardLine,
    epaRequest: getEpaDashboardLine,
    format: (res) => ({ history: res?.history || [], line: res?.line || null }),
    errorMessage: "趨勢圖資料載入失敗",
  },
  boxplot: {
    initialData: null,
    stationRequest: getStationDashboardBoxplot,
    epaRequest: getEpaDashboardBoxplot,
    format: (res) => res?.boxplots || null,
    errorMessage: "盒鬚圖資料載入失敗",
  },
  heatmap: {
    initialData: null,
    stationRequest: getStationDashboardHeatmap,
    epaRequest: getEpaDashboardHeatmap,
    format: (res) => res?.heatmaps || null,
    errorMessage: "熱點圖資料載入失敗",
  },
  windRose: {
    initialData: null,
    stationRequest: getStationDashboardWindRose,
    epaRequest: getEpaDashboardWindRose,
    format: (res) => res?.wind || null,
    errorMessage: "風瑰圖資料載入失敗",
  },
  windVector: {
    initialData: null,
    stationRequest: getStationDashboardWindVector,
    epaRequest: getEpaDashboardWindVector,
    format: (res) => res?.wind || null,
    errorMessage: "風向風速資料載入失敗",
  },
};

function useDashboardFeatureData(feature) {
  const config = FEATURE_CONFIG[feature];
  const [data, setData] = useState(config.initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (form) => {
    setLoading(true);
    setError(null);
    try {
      const request = isEPA(form) ? config.epaRequest : config.stationRequest;
      const formatted = config.format(await request(form));
      setData(formatted);
      return formatted;
    } catch (err) {
      console.error("error:", err);
      setError(errorMessage(err, config.errorMessage));
      return null;
    } finally {
      setLoading(false);
    }
  }, [config]);

  const resetData = useCallback(() => {
    setData(config.initialData);
    setLoading(false);
    setError(null);
  }, [config]);
  return { data, loading, error, fetchData, resetData };
}

function useDashboardStationMapData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (stations) => {
    setLoading(true);
    setError(null);
    try {
      const projectIds = [...new Set(stations.map(({ PJID }) => PJID))];
      const results = await Promise.allSettled(
        [
          ...projectIds
            .filter((PJID) => EPA_PROJECT_IDS.has(PJID))
            .map(async (PJID) => ({ PJID, stations: await getTaqmnStationList() })),
          ...stations
            .filter(({ PJID }) => !EPA_PROJECT_IDS.has(PJID))
            .map(async ({ PJID, STID }) => ({
              PJID,
              stations: await getStationDetailInfoData({ PJID, STID }),
            })),
        ],
      );
      const formatted = {};
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        (result.value.stations || []).forEach((station) => {
          formatted[`${result.value.PJID}::${station.STID}`] = {
            ...station,
            PJID: result.value.PJID,
          };
        });
      });
      setData(formatted);
      return formatted;
    } catch (err) {
      console.error("error:", err);
      setError(errorMessage(err, "測站資料載入失敗"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetData = useCallback(() => {
    setData({});
    setLoading(false);
    setError(null);
  }, []);
  return { data, loading, error, fetchData, resetData };
}

function useDashboardRealtimeData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (form) => {
    setLoading(true);
    setError(null);
    try {
      const res = await (isEPA(form)
        ? getEpaDashboardRealtime({ STID: form.STID })
        : getStationDashboardRealtime(form));
      const formatted = {
        ...res,
        realtimeType: res?.realtimeType || form.type,
        realtime: formatRealtimeRows(res?.realtime, res?.models),
      };
      setData(formatted);
      return formatted;
    } catch (err) {
      console.error("error:", err);
      setError(errorMessage(err, "即時資料載入失敗"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetData = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);
  return { data, loading, error, fetchData, resetData };
}

function useDashboardReportData() {
  const [data, setData] = useState(EMPTY_REPORTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (reportType, form) => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        PJID: form.PJID,
        STID: form.STID,
        startDateTime: dayjs(form.startTime).format("YYYY-MM-DD HH:mm"),
        endDateTime: dayjs(form.endTime).format("YYYY-MM-DD HH:mm"),
        timeType: (isEPA(form) || reportType === "daily") ? "T60" : form.timeType,
        ...(reportType === "daily"
          ? { modelType: form.modelType }
          : { modelTypes: form.modelTypes }),
        ...(reportType === "data" ? { flagOnly: form.flagOnly } : {}),
      };
      const stationRequests = {
        data: getStationDashboardTable,
        daily: getStationDashboardDailyReport,
        monthly: getStationDashboardMonthlyReport,
      };
      const epaRequests = {
        data: getEpaDashboardTable,
        daily: getEpaDashboardDailyReport,
        monthly: getEpaDashboardMonthlyReport,
      };
      const request = isEPA(form)
        ? epaRequests[reportType]
        : stationRequests[reportType];

      const formatted = formatReportRows(await request(payload), reportType);
      setData((current) => ({ ...current, [reportType]: formatted }));
      return formatted;
    } catch (err) {
      console.error("error:", err);
      setError(errorMessage(err, "報表資料載入失敗"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetData = useCallback(() => {
    setData(EMPTY_REPORTS);
    setLoading(false);
    setError(null);
  }, []);
  return { data, loading, error, fetchData, resetData };
}

function useDashboardData() {
  return {
    stations: useDashboardStationMapData(),
    realtime: useDashboardRealtimeData(),
    line: useDashboardFeatureData("line"),
    boxplot: useDashboardFeatureData("boxplot"),
    heatmap: useDashboardFeatureData("heatmap"),
    windRose: useDashboardFeatureData("windRose"),
    windVector: useDashboardFeatureData("windVector"),
    report: useDashboardReportData(),
  };
}

const DEFAULT_QUERY = {
  startTime: dayjs().startOf("day").format("YYYY-MM-DDTHH:mm"),
  endTime: dayjs().format("YYYY-MM-DDTHH:mm"),
  timeType: "T01",
};

const DEFAULT_BOX_SETTINGS = {
  timeGroup: "day",
  lower: "25",
  upper: "75",
};

export const DASHBOARD_TIME_TYPES = ["T01", "T05", "T60"].map((value) => ({
  value,
  label: value,
}));

const keyOf = (station) => `${station.PJID}::${station.STID}`;

const createAnalysisPayload = (station, query, box) => ({
  ...station,
  startDateTime: dayjs(query.startTime).format("YYYY-MM-DD HH:mm"),
  endDateTime: dayjs(query.endTime).format("YYYY-MM-DD HH:mm"),
  type: isEPA(station) ? "T60" : query.timeType,
  box,
});

export function useDashboard(selectedStations = []) {
  const {
    stations,
    realtime,
    line,
    boxplot,
    heatmap,
    windRose,
    windVector,
    report,
  } = useDashboardData();

  const { data: stationMap, fetchData: fetchStations, resetData: resetStations } = stations;
  const {
    error: realtimeError,
    fetchData: fetchRealtime,
    resetData: resetRealtime,
  } = realtime;
  const { data: lineData, error: lineError, fetchData: fetchLine, resetData: resetLine } = line;
  const {
    data: boxplotData,
    error: boxplotError,
    fetchData: fetchBoxplot,
    resetData: resetBoxplot,
  } = boxplot;
  const {
    data: heatmapData,
    error: heatmapError,
    fetchData: fetchHeatmap,
    resetData: resetHeatmap,
  } = heatmap;
  const {
    data: windRoseData,
    error: windRoseError,
    fetchData: fetchWindRose,
    resetData: resetWindRose,
  } = windRose;
  const {
    data: windVectorData,
    error: windVectorError,
    fetchData: fetchWindVector,
    resetData: resetWindVector,
  } = windVector;
  const {
    data: reports,
    loading: reportLoading,
    error: reportError,
    fetchData: fetchReport,
    resetData: resetReport,
  } = report;

  const [activeKey, setActiveKey] = useState("");
  const [meta, setMeta] = useState(null);
  const [realtimeCache, setRealtimeCache] = useState({});
  const [realtimeType, setRealtimeType] = useState("T01");
  const [nextRealtimeUpdateAt, setNextRealtimeUpdateAt] = useState(null);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [querying, setQuerying] = useState(false);
  const [loading, setLoading] = useState(false);
  const queryRef = useRef(query);

  const activeStation = useMemo(
    () => selectedStations.find((item) => keyOf(item) === activeKey),
    [activeKey, selectedStations],
  );

  const dashboardStations = useMemo(
    () => selectedStations.map((item) => stationMap[keyOf(item)] || item),
    [selectedStations, stationMap],
  );

  const resetAnalysis = useCallback(() => {
    resetLine();
    resetBoxplot();
    resetHeatmap();
    resetWindRose();
    resetWindVector();
  }, [resetLine, resetBoxplot, resetHeatmap, resetWindRose, resetWindVector]);

  const fetchAnalysis = useCallback(async (payload) => {
    setQuerying(true);

    try {
      await Promise.all([
        fetchLine(payload),
        fetchBoxplot(payload),
        fetchHeatmap(payload),
        fetchWindRose(payload),
        fetchWindVector(payload),
      ]);
    } finally {
      setQuerying(false);
    }
  }, [
    fetchLine,
    fetchBoxplot,
    fetchHeatmap,
    fetchWindRose,
    fetchWindVector,
  ]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!selectedStations.some((item) => keyOf(item) === activeKey)) {
      setActiveKey(selectedStations[0] ? keyOf(selectedStations[0]) : "");
    }
  }, [activeKey, selectedStations]);

  useEffect(() => {
    fetchStations(selectedStations);
    return resetStations;
  }, [selectedStations, fetchStations, resetStations]);

  useEffect(() => {
    if (!activeStation) return undefined;

    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      resetAnalysis();
      resetReport();
      setRealtimeCache({});

      const type = isEPA(activeStation) ? "T60" : "T01";
      setRealtimeType(type);

      const currentQuery = queryRef.current;
      const timeType = isEPA(activeStation) ? "T60" : currentQuery.timeType;
      if (isEPA(activeStation)) {
        setQuery((current) => ({ ...current, timeType }));
      }

      const initialQuery = {
        ...currentQuery,
        endTime: dayjs(),
        timeType,
      };
      const [result] = await Promise.all([
        fetchRealtime({ ...activeStation, type }),
        fetchAnalysis(
          createAnalysisPayload(activeStation, initialQuery, DEFAULT_BOX_SETTINGS),
        ),
      ]);

      if (mounted && result) {
        setMeta(result);
        setRealtimeCache({ [result.realtimeType]: result.realtime || [] });
      }

      if (mounted) setLoading(false);
    };

    loadDashboard();

    return () => {
      mounted = false;
      resetRealtime();
      resetAnalysis();
    };
  }, [
    activeStation,
    fetchAnalysis,
    fetchRealtime,
    resetRealtime,
    resetReport,
    resetAnalysis,
  ]);

  useEffect(() => {
    if (!activeStation) return undefined;

    let timerId;
    let refreshing = false;

    const refreshRealtime = async () => {
      if (document.visibilityState === "hidden" || refreshing) return;

      refreshing = true;
      try {
        const result = await fetchRealtime({ ...activeStation, type: realtimeType });
        if (!result) return;

        setRealtimeCache((current) => ({
          ...current,
          [result.realtimeType]: result.realtime || [],
        }));
        setMeta(result);
      } finally {
        refreshing = false;
      }
    };

    const scheduleNextRefresh = () => {
      window.clearTimeout(timerId);
      const now = Date.now();
      const delay = millisecondsUntilNextRealtimeUpdate(realtimeType, now);
      setNextRealtimeUpdateAt(now + delay);
      timerId = window.setTimeout(async () => {
        await refreshRealtime();
        scheduleNextRefresh();
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      refreshRealtime();
      scheduleNextRefresh();
    };

    scheduleNextRefresh();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeStation, realtimeType, fetchRealtime]);

  const selectRealtimeType = async (type) => {
    if (!activeStation || meta?.isEPA) return;

    setRealtimeType(type);

    const result = await fetchRealtime({ ...activeStation, type });
    if (!result) return;

    setMeta(result);
    setRealtimeCache((current) => ({
      ...current,
      [type]: result.realtime || [],
    }));
  };

  const search = async (box = DEFAULT_BOX_SETTINGS, queryOverride) => {
    const targetQuery = queryOverride || query;
    const invalidRange = dayjs(targetQuery.startTime).isAfter(dayjs(targetQuery.endTime));
    if (!activeStation || !targetQuery.startTime || !targetQuery.endTime || invalidRange) return;

    await fetchAnalysis(createAnalysisPayload(activeStation, targetQuery, box));
  };

  const searchReport = (type, form) =>
    fetchReport(type, { ...activeStation, ...form });

  const wind =
    windRoseData || windVectorData
      ? { ...(windRoseData || {}), ...(windVectorData || {}) }
      : null;

  const error =
    realtimeError ||
    lineError ||
    boxplotError ||
    heatmapError ||
    windRoseError ||
    windVectorError;

  return {
    activeKey,
    setActiveKey,
    activeStation,
    station:
      stationMap[activeKey] ||
      (meta?.station ? { ...meta.station, PJID: activeStation?.PJID } : null),
    dashboardStations,
    models: meta?.models || [],
    realtime: realtimeCache[realtimeType] || meta?.realtime || [],
    realtimeType,
    nextRealtimeUpdateAt: activeStation ? nextRealtimeUpdateAt : null,
    realtimeRefreshing: realtime.loading,
    selectRealtimeType,
    analysis: {
      line: lineData.line,
      boxplots: boxplotData,
      heatmaps: heatmapData,
      wind,
    },
    reports,
    reportLoading,
    reportError,
    searchReport,
    history: lineData.history,
    loading,
    querying,
    error,
    query,
    setQuery,
    search,
    isEPA: Boolean(meta?.isEPA),
  };
}
