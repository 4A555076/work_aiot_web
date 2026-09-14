import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import {
    addQaqcData,
    calculateQaqcData,
    deleteQaqcData,
    getPCBList,
    getQaqcData,
    getQaqcTestSerialsData,
    updateQaqcData,
} from "@/api/sensor";

export function useQaqcRecord() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const run = async (action, fallbackMessage) => {
        setLoading(true);
        setError(null);
        try {
            const res = await action();
            setData(res);
            return res;
        } catch (err) {
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || fallbackMessage;
            setError(errMsg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        data,
        loading,
        error,
        fetchQaqc: (SN) => run(() => getQaqcData({ SN }), "紀錄載入失敗"),
        updateQaqc: (requestData) => run(() => updateQaqcData(requestData), "修改失敗"),
        calculateQaqc: (SN) => run(() => calculateQaqcData({ SN }), "計算啟動失敗"),
        deleteQaqc: (SN) => run(() => deleteQaqcData({ SN }), "刪除失敗"),
        resetQaqcRecord: () => {
            setData(null);
            setError(null);
        },
    };
}

export function useQaqcTestSerialsData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchQaqcTestSerialsData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const res = await getQaqcTestSerialsData({
                startDateTime: form.startTime,
                endDateTime: form.endTime,
            });
            const records = (res.data || []).map((item) => ({
                ...item,
                id: item.SN,
                value: item.SN,
                description: item.conConfig || item.SN,
            }));

            setData(records);
        } catch (err) {
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "查詢失敗";
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return { loading, error, data, fetchQaqcTestSerialsData };
}

export function useAddQaqcData() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const addQaqc = async (requestData) => {
        setLoading(true);
        setError(null);

        try {
            const res = await addQaqcData(requestData);
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

    const resetAddQaqc = () => {
        setData(null);
        setError(null);
    };

    return { loading, error, data, addQaqc, resetAddQaqc };
}

export function usePCBListList() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPCBListList = async () => {       
        setLoading(true);
        setError(null);

        try {
            const res = await getPCBList();

            const options = (res || []).map((item) => ({
                ...item,
                value: item.STID,
                label: `電路板 ${(item.STID || "").match(/\d+/g)?.join("") || item.STID}（${item.Desc || "未命名"}）`,
            }));

            setData(options);
        } catch (err) {
            console.error("error:", err);
            const errMsg = err?.response?.data?.message || err?.message || "電路板清單載入失敗";
            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        data,
        fetchPCBListList,
    };
}
