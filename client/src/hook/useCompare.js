import { useState } from "react";
import { getProjectsList, getStationList, getStationData, getStationModelData } from "@/api/station";
import { getTaqmnStationList, getTAQMNStationData } from "@/api/openData";
import { createStationModelOptions } from "@/utils/normalizeStationModel";

const TAQMN_ITEMS = [
  { value: "SO2", label: "二氧化硫" },
  { value: "NO", label: "一氧化氮" },
  { value: "NOx", label: "氮氧化物" },
  { value: "NO2", label: "二氧化氮" },
  { value: "CO", label: "一氧化碳" },
  { value: "O3", label: "臭氧" },
  { value: "CH4", label: "甲烷" },
  { value: "NMHC", label: "非甲烷碳氫化合物" },
  { value: "THC", label: "總碳氫化合物" },
  { value: "PM10", label: "懸浮微粒 PM₁₀" },
  { value: "PM25", label: "細懸浮微粒 PM₂.₅" },

  { value: "WS", label: "風速" },
  { value: "WD", label: "風向" },
  { value: "WST10Vct", label: "10分鐘向量平均風速" },
  { value: "WDT10Vct", label: "10分鐘向量平均風向" },

  { value: "UVB", label: "紫外線 B" },
  { value: "AMB_TEMP", label: "大氣溫度" },
  { value: "RAINFALL", label: "雨量" },
  { value: "RH", label: "相對濕度" },
  { value: "PH_RAIN", label: "雨水酸鹼值" },
  { value: "RAIN_COND", label: "雨水導電度" },
  { value: "CO2", label: "二氧化碳" },
  { value: "SHELT_TEMP", label: "測站室內溫度" },
  { value: "PRESSURE", label: "大氣壓力" },
  { value: "RAIN_INT", label: "降雨強度" },

  { value: "O3h8", label: "臭氧 8 小時移動平均" },
  { value: "PM25h24", label: "細懸浮微粒 24 小時移動平均" },
  { value: "PM10h24", label: "懸浮微粒 24 小時移動平均" },

  { value: "PSI", label: "空氣污染指標" },
  { value: "AQI", label: "空氣品質指標" },
];



export function useProjectsList() {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProjectsList = async () => {
    setLoading(true);
    setError(null);

    try {
        const res = await getProjectsList();

        const options = [
          {
            value: "TAQMN",
            label: "環境部空氣品質監測網",
          },
          ...(res || []).map((item) => ({
            value: String(item.PJID),
            label: `(${item.PJID}) ${item.PJName_TW}`,
          })),
        ];

        setData(options);
    } catch (err) {
        console.error("error:", err);
        const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
        setError(errMsg);
    } finally {
        setLoading(false);
    }
  };

  return {
    loading,
    error,
    data,
    fetchProjectsList,
  };
}

export function useStationList() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStationList = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const isTAQMN = form.project === "TAQMN";
            const res = isTAQMN
              ? await getTaqmnStationList()
              : await getStationList({ PJID: form.project, enabled: 1 });

            const options = (res || []).map((item) => isTAQMN
              ? {
                value: String(item.STID),
                label: `${item.County}-${item.STName}`,
                Desc: item.STID,
                County: item.County,
                geoLat: item.geoLat,
                geoLng: item.geoLng,
              }
              : {
                value: String(item.STID),
                label: `(${item.STID}) ${item.IIT}`,
                Desc: item.Desc,
              });

            setData((current) => ({
              ...current,
              [form.project]: options,
            }));
        } catch (err) {
          console.error("error:", err);
          const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
          setError(errMsg);
        } finally {
          setLoading(false);
        }
    };

    return {
        data,
        loading,
        error,
        fetchStationList,
    };
}

export function useStationModelData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStationModelData = async (STID, params) => {
    setLoading(true);
    setError(null);

    try {
      let options = TAQMN_ITEMS;

      if (params.PJID !== "TAQMN") {
        const res = await getStationModelData(STID, params);
        options = createStationModelOptions(res);
      }

      const cacheKey = `${params.PJID}::${STID}`;
      setData((current) => ({
        ...current,
        [cacheKey]: options,
      }));
    } catch (err) {
        console.error("error:", err);
        const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
        setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    fetchStationModelData,
  };
}

export function useCompareChartData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  const fetchChartData = async (paramsList) => {
    setLoading(true);
    setError(null);

    try {
      const res = await Promise.allSettled(
        paramsList.map(({ STID, PJID, ...params }) => PJID === "TAQMN"
          ? getTAQMNStationData(STID, params)
          : getStationData(STID, { PJID, ...params })),
      );

      setData(res);
    } catch (err) {
        console.error("error:", err);
        const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
        setError(errMsg);
    } finally {
        setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    fetchChartData,
  };
}
