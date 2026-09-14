import { useRef, useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getProjectsList, getStationList } from "@/api/station";
import { getTaqmnStationList } from "@/api/openData";


export function useProjectsList() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchProjectsList = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await getProjectsList();

            const options = [
                {
                    id: "TAQMN",
                    PJID: "TAQMN",
                    projectName: "環境部空氣品質監測網",
                    name: "環境部空氣品質監測網",
                },
                ...(res || []).map((item) => ({
                    id: item.PJID,
                    PJID: String(item.PJID),
                    projectName: item.PJName_TW || item.PJName || item.PJID,
                    name: `(${item.PJID}) ${item.PJName_TW}`,
                }))
            ];

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
};


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
            const isTAQMN = form.project === "TAQMN";
            const res = isTAQMN
            ? await getTaqmnStationList()
            : await getStationList({
                PJID: form.project,
                enabled: form.enabled,
            });

            if (requestId !== requestIdRef.current) return;

            const options = (res || []).map((item) => ({
                id: item.STID,
                PJID: form.project,
                STID: item.STID,
                name: isTAQMN
                    ? `${item.County}-${item.STName}`
                    : `(${item.STID}) ${item.IIT}`,
                lat: item.geoLat,
                lng: item.geoLng,
                desc: isTAQMN ? item.STID : item.Desc,
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
