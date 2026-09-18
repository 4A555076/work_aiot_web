import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {
    getInspectionData,
    getInspectionImage,
    getProjectsList,
} from "@/api/station";

dayjs.extend(utc);

const inspectionImageBlobCache = new Map();

const loadInspectionImage = (url) => {
    if (inspectionImageBlobCache.has(url)) {
        return inspectionImageBlobCache.get(url);
    }

    const request = getInspectionImage(url).catch((error) => {
        inspectionImageBlobCache.delete(url);
        throw error;
    });

    inspectionImageBlobCache.set(url, request);
    return request;
};

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
    const latestRequestRef = useRef(0);

    useEffect(() => () => {
        latestRequestRef.current += 1;
    }, []);

    const fetchInspectionImageBlob = useCallback(
        (url) => loadInspectionImage(url),
        [],
    );

    const fetchInspectionData = useCallback(async (form) => {
        const requestID = latestRequestRef.current + 1;
        latestRequestRef.current = requestID;
        inspectionImageBlobCache.clear();

        setLoading(true);
        setError(null);

        try {
            const inspectionData = await getInspectionData({
                startDateTime: form.startTime,
                endDateTime: form.endTime,
                PJID: form.project,
            });

            const formatted = (inspectionData || []).map((item) => ({
                ...item,
                StartDate: item.StartDate
                    ? dayjs(item.StartDate).utc().format("YYYY.MM.DD")
                    : "",
            }));

            if (latestRequestRef.current === requestID) {
                setData(formatted);
            }
            return formatted;
        } catch (requestError) {
            console.error("error:", err);
            if (latestRequestRef.current === requestID) {
                console.error("error:", err);
                const errMsg = err?.response?.data?.message || err?.message || "取得失敗";
                setError(errMsg);
            }
            return null;
        } finally {
            if (latestRequestRef.current === requestID) {
                setLoading(false);
            }
        }
    }, []);

    return {
        data,
        loading,
        error,
        fetchInspectionData,
        fetchInspectionImageBlob,
    };
}

export function useInspectionImage(url) {
    const [displayUrl, setDisplayUrl] = useState(
        url?.startsWith("data:") || url?.startsWith("blob:") ? url : null,
    );
    const [loadFailed, setLoadFailed] = useState(false);

    useEffect(() => {
        if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
            setDisplayUrl(url || null);
            setLoadFailed(false);
            return undefined;
        }

        let active = true;
        let objectUrl;

        setDisplayUrl(null);
        setLoadFailed(false);

        loadInspectionImage(url)
            .then((imageBlob) => {
                if (!active) return;
                objectUrl = URL.createObjectURL(imageBlob);
                setDisplayUrl(objectUrl);
            })
            .catch((requestError) => {
                if (active) {
                    console.error("圖片載入失敗:", requestError);
                    setLoadFailed(true);
                }
            });

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url]);

    return { displayUrl, loadFailed };
}
