import { useRef, useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { addInspectionData, getProjectsList, getStationList, getStationDetailInfoData, getStationData, getStationModelData } from "@/api/station";
import { transformStationData } from "@/utils/transformStationData";

export function useProjectsList() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchProjectsList = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await getProjectsList();

            const options = (res || []).map((item) => ({
                value: item.PJID,
                label: `(${item.PJID}) ${item.PJName_TW}`,
            }));

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
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const requestIdRef = useRef(0);

    const fetchStationList = async (form) => {
        if (!form.project) return;

        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);

        try {
            const payload = {
                PJID: form.project,
                enabled: 1
            };

            const res = await getStationList(payload);

            if (requestId !== requestIdRef.current) return;

            const options = (res || []).map((item) => ({
                value: item.STID,
                label: `(${item.STID}) ${item.IIT}`,
            }));

            setData(options);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
            setError(errMsg);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    };

    return {
        data,
        loading,
        error,
        fetchStationList,
    };
}

export function useStationInfoData() {
    const [data, setData] = useState([]);
    const [geo, setGeo] = useState({ lat: null, lng: null });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const requestIdRef = useRef(0);

    const fetchStationInfoData = async (form) => {
        if (!form.project || !form.station) return;

        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);

        try {
            const payload = {
                PJID: form.project,
                STID: form.station
            };

            const res = await getStationDetailInfoData(payload);

            if (requestId !== requestIdRef.current) return;

            if (!Array.isArray(res) || res.length === 0) {
                setData([]);
                return;
            }

            const station = res[0];

            setGeo({
                lat: station.geoLat ? Number(station.geoLat) : null,
                lng: station.geoLng ? Number(station.geoLng) : null,
            });

            const mapped = [
                {
                    label: "專案",
                    value: station.ProjID && station.PJName_TW
                    ? `(${station.ProjID}) ${station.PJName_TW}`
                    : "",
                },
                {
                    label: "編號",
                    value: station.STID ?? "",
                },
                {
                    label: "裝置名稱",
                    value: station.IIT ?? "",
                },
                {
                    label: "座標位置",
                    value: (station.geoLat && station.geoLng)
                    ? `${station.geoLat}, ${station.geoLng}`
                    : "",
                },
                {
                    label: "行政區劃",
                    value: (station.County || station.Town)
                    ? `${station.County ?? ""}${station.Town ?? ""}`
                    : "",
                },
                {
                    label: "區域類型",
                    value: station.AreaType ?? "",
                },
                {
                    label: "韌體版本",
                    value: station.BinVer ?? "",
                },
                {
                    label: "更新間隔",
                    value: station.StuFreq ?? "",
                },
                {
                    label: "預計更新時間",
                    value: station.KinUpDateTime && dayjs(station.KinUpDateTime).isValid()
                    ? dayjs(station.KinUpDateTime)
                        .utc()
                        .format("YYYY-MM-DD HH:mm")
                    : "",
                },
            ];

            setData(mapped);
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
            setError(errMsg);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    };

    return {
        data,
        geo,
        loading,
        error,
        fetchStationInfoData,
    };
}

export function useStationData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStationData = async (STID, params) => {
        setLoading(true);
        setError(null);

        try {
            const [stationData, modelData] = await Promise.all([
                getStationData(STID, params),
                getStationModelData(STID, params),
            ]);

            const result = transformStationData(stationData, modelData);

            setData(result);
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
        fetchStationData,
    };
}

export function useAddInspectionData() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const addInspection = async (params) => {
        setLoading(true);
        setError(null);

        try {
            const res = await addInspectionData(params);
            setData(res);
            return res;
        } catch (err) {
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "新增失敗";
            setError(errMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const resetAddInspection = () => {
        setData(null);
        setError(null);
    };

    return {
        data,
        loading,
        error,
        addInspection,
        resetAddInspection,
    };
}
