import { useRef, useState } from "react";
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

export function useSensorSerialList() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const requestIdRef = useRef(0);

    const fetchSensorSerialList = async (keyword = "") => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);

        try {
            const res = await getSensorComponentSerialsList({ keyword });
            if (requestId !== requestIdRef.current) return;
            setData((res || [])
                .map((item) => item.PRSN ?? item.SN ?? item.serialNumber)
                .filter(Boolean)
                .map(String));
        } catch (err) {
            if (requestId !== requestIdRef.current) return;
            console.error("error:", err);
            setError(err?.response?.data?.message || err?.message || "取得 Sensor 序號失敗");
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    };

    const clearSensorSerialList = () => {
        requestIdRef.current += 1;
        setData([]);
        setError(null);
        setLoading(false);
    };

    return {
        data,
        loading,
        error,
        fetchSensorSerialList,
        clearSensorSerialList,
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
