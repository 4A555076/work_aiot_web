import { useCallback, useEffect, useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getProjectsList, getInspectionData, getInspectionImage } from "@/api/station";


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

    const fetchInspectionImageBlob = useCallback(
        (url, signal) => getInspectionImage(url, signal),
        [],
    );

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
        fetchInspectionImageBlob,
    };
}

export function useInspectionImage(url) {
    const [displayUrl, setDisplayUrl] = useState(url?.startsWith("data:") ? url : null);
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
            setDisplayUrl(url || null);
            setLoadFailed(false);
            return undefined;
        }

        const controller = new AbortController();
        let objectUrl;

        setDisplayUrl(null);
        setLoadFailed(false);
        getInspectionImage(url, controller.signal)
            .then((blob) => {
                objectUrl = URL.createObjectURL(blob);
                setDisplayUrl(objectUrl);
            })
            .catch((error) => {
                if (error?.code !== "ERR_CANCELED") {
                    console.error("圖片載入失敗:", error);
                    setLoadFailed(true);
                }
            });

        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url]);

    return { displayUrl, loadFailed };
}
