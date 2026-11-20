import { useEffect, useRef, useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getProjectsList, getStationList } from "@/api/station";
import { getSensorComponentSerialsList, updateSensorStation } from "@/api/sensor";


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

export function useSensorSerialList(keyword) {
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!keyword) return;

        let active = true;
        const timer = window.setTimeout(async () => {
            try {
                const rows = await getSensorComponentSerialsList({ keyword });
                if (!active) return;

                const data = rows
                    .map((item) => item.PRSN?.trim())
                    .filter(Boolean);
                setResult({ keyword, data });
            } catch {
                if (active) {
                    setResult({ keyword, error: "暫時無法查驗 Sensor 序號，請稍後重新輸入。" });
                }
            }
        }, 300);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [keyword]);

    const currentResult = keyword && result?.keyword === keyword ? result : null;

    return {
        data: currentResult?.data ?? [],
        loading: Boolean(keyword && !currentResult),
        error: currentResult?.error,
    };
}

export function useUpdateSensor() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchUpdateSensor = async (form) => {
        setLoading(true);
        setError(null);
        try {
            const res = await updateSensorStation(form);
            setData(res);
            return res;
        } catch (err) {
            console.error("error:", err);
            const message = err?.response?.data?.message || err?.message || "Sensor 更換失敗";
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const resetUpdateSensor = () => {
        setData(null);
        setError(null);
    };

    return {
        data,
        loading,
        error,
        fetchUpdateSensor,
        resetUpdateSensor,
    };
}
