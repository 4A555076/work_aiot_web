import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getProjectsList, getInspectionData } from "@/api/station";


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

export function useInspectionData() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchInspectionData = async (form) => {

        setLoading(true);
        setError(null);

        try {
            const payload = {
                startDateTime: form.startTime,
                endDateTime: form.endTime,
                PJID: form.project,
            };

            const res = await getInspectionData(payload);

            const formatted = (res || []).map((item) => ({
                ...item,
                StartDate: item.StartDate ? dayjs(item.StartDate).utc().format("YYYY.MM.DD") : "",
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
        fetchInspectionData,
    };
}