import { useRef, useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import {
    addDecommissionedStation,
    deleteDecommissionedStation,
    editDecommissionedStation,
    getProjectsList,
    getDecommissionedData,
    getStationList,
    getStationDisconnectedData,
} from "@/api/station";


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
                ...item,
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

export function useDecommissionedData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchDecommissionedData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                ProjID: form.project,
                STID: form.station,
                endDateTime: form.endTime,
                startDateTime: form.startTime,
                stationStatus: form.status,
            };

            const res = await getDecommissionedData(payload);
            const formatted = (res || []).map((item) => ({
                ...item,
                datOffLine: item.datOffLine ? dayjs(item.datOffLine).utc().format("YYYY-MM-DD HH:mm") : "",
                datOnLine: item.datOnLine ? dayjs(item.datOnLine).utc().format("YYYY-MM-DD HH:mm") : "",
                status: item.datOnLine ? "上架" : "下架",
            }));

            setData(formatted);
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
        fetchDecommissionedData,
    };
}

export function useAddDecommissionedStation() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const submitDecommissionedStation = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const res = await addDecommissionedStation(form);
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

    const resetAddDecommissionedStation = () => {
        setData(null);
        setError(null);
    };

    return {
        data,
        loading,
        error,
        submitDecommissionedStation,
        resetAddDecommissionedStation,
    };
}

export function useEditDecommissionedStation() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const submitEditDecommissionedStation = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const res = await editDecommissionedStation(form);
            setData(res);
            return res;
        } catch (err) {
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "編輯失敗";
            setError(errMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const resetEditDecommissionedStation = () => {
        setData(null);
        setError(null);
    };

    return {
        data,
        loading,
        error,
        submitEditDecommissionedStation,
        resetEditDecommissionedStation,
    };
}

export function useDeleteDecommissionedStation() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const submitDeleteDecommissionedStation = async (OLID) => {
        setLoading(true);
        setError(null);

        try {
            const res = await deleteDecommissionedStation({ OLID });
            setData(res);
            return res;
        } catch (err) {
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "刪除失敗";
            setError(errMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const resetDeleteDecommissionedStation = () => {
        setData(null);
        setError(null);
    };

    return {
        data,
        loading,
        error,
        submitDeleteDecommissionedStation,
        resetDeleteDecommissionedStation,
    };
}

export function useStationDisconnectedData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStationDisconnectedData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                PJID: form.project,
                STID: form.station,
            };

            const res = await getStationDisconnectedData(payload);
            setData(res || []);
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
        fetchStationDisconnectedData,
    };
}
