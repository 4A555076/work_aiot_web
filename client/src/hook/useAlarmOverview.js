import { useState } from "react";
import dayjs from 'dayjs'
import { 
    getProjectsList, 
    getThresholdOverData, 
    getDisconnectedData 
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

            const errMsg =
                err?.response?.data?.message ||
                err?.message ||
                "載入失敗";

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


export function useThresholdOverData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchThresholdOverData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const res = await getThresholdOverData({ PJID: form.project });
            const formatted = (res || []).map((item) => ({
                ...item,
                CHECKTIME: item.CHECKTIME ? dayjs(item.CHECKTIME).format("YYYY-MM-DD HH:mm") : "",
            }));

            setData(formatted);
        } catch (err) {
            console.error("error:", err);

            const errMsg =
                err?.response?.data?.message ||
                err?.message ||
                "載入失敗";

            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return {
        data,
        loading,
        error,
        fetchThresholdOverData,
    };
}


export function useDisconnectedData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchDisconnectedData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                PJID: form.project,
                filterKeywords: form.filters,
                filterStatus: form.tab,
            };

            const res = await getDisconnectedData(payload);
            const formatted = (res || []).map((item) => ({
                ...item,
                CHECKTIME: item.CHECKTIME ? dayjs(item.CHECKTIME).format("YYYY-MM-DD HH:mm") : "",
            }));

            setData(formatted);
        } catch (err) {
            console.error("error:", err);

            const errMsg =
                err?.response?.data?.message ||
                err?.message ||
                "載入失敗";

            setError(errMsg);
        } finally {
            setLoading(false);
        }
    };

    return {
        data,
        loading,
        error,
        fetchDisconnectedData,
    };
}