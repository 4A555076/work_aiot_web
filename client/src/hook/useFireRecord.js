import { useState } from "react";
import dayjs from 'dayjs'
import { 
    getFireReport, 
    getFireProjects 
} from "@/api/fire";


export function useFireProjects() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchFireProjects = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await getFireProjects();

            const options = (res || []).map((item) => ({
                value: item.ENID,
                label: item.PJName_TW,
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
        fetchFireProjects,
    };
}



export function useFireRecord() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchFireReport = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const payload = {
                startDateTime: form.startTime,
                endDateTime: form.endTime,
                ENID: form.project,
                squadCount: form.squadCount,
            };

            const res = await getFireReport(payload);
            const formatted = (res || []).map((item) => ({
                ...item,
                cDate: item.cDate ? dayjs(item.cDate).format("YYYY-MM-DD HH:mm") : "",
                detail: item.detail ? item.detail.split("/")[0].trim() : "",
            }));

            setData(formatted);
        } catch (err) {
            onsole.error("error:", err);

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
        fetchFireReport,
    };
}
