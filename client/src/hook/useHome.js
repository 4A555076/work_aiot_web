import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getNearbyStationsData, getAuthorizedStationsData } from "@/api/station";

export function useNearbyStationsData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchNearbyStationsData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const res = await getNearbyStationsData(form);

            setData(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error("getNearbyStationsData error:", err);
            setError(err?.response?.data?.message || err?.message || "取得附近測站失敗");
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        data,
        fetchNearbyStationsData,
    };
}

export function useAuthorizedStationsData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAuthorizedStationsData = async (form) => {
        setLoading(true);
        setError(null);

        try {
            const res = await getAuthorizedStationsData(form);

            setData(Array.isArray(res) ? res : []);
        } catch (err) {
            console.error("getAuthorizedStationsData error:", err);
            setError(err?.response?.data?.message || err?.message || "取得授權測站失敗");
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        data,
        fetchAuthorizedStationsData,
    };
}
