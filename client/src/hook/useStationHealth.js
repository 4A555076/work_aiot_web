import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getProjectsList, getStationHealthData, getDisconnectionDetailsData } from "@/api/station";

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


export function useStationHealthData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStationHealthData = async (form) => {       
        setLoading(true);
        setError(null);

        try {
            const payload = {
                yearMonth: form.startTime,
                PJID: form.project,
            };

            const res = await getStationHealthData(payload);
            const formatted = (res || []).map((item) => {
                const totalMinutes = Number(item.MissingMinutes) || 0;

                const days = Math.floor(totalMinutes / (60 * 24));
                const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
                const minutes = totalMinutes % 60;

                const missingTime = `${days} 天 ${hours} 小時 ${minutes} 分鐘`;

                const totalMonthMinutes = dayjs(item.Month).daysInMonth() * 24 * 60;

                const healthRate = (((totalMonthMinutes - totalMinutes) / totalMonthMinutes) * 100).toFixed(2);

                return {
                    ...item,
                    MissingMinutes: missingTime,
                    HealthRate: `${healthRate}%`,
                };
            });

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
        loading,
        error,
        data,
        fetchStationHealthData,
    };
}

export function useDisconnectionDetailsData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchDisconnectionDetailsData = async (form) => {       
        setLoading(true);
        setError(null);

        try {
            const payload = {
                PJID: form.project,
                STID: form.station,
                yearMonth: form.startTime,
                switchGap: form.switchGap,
            };

            const res = await getDisconnectionDetailsData(payload);

            const formatted = (res || []).map((item) => {
                const totalMinutes = Number(item.Duration) || 0;

                const days = Math.floor(totalMinutes / (60 * 24));
                const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
                const minutes = totalMinutes % 60;

                const durationTime = `${days} 天 ${hours} 小時 ${minutes} 分鐘`;


                return {
                    ...item,
                    Duration: durationTime,
                    StartTime: item.StartTime ? dayjs(item.StartTime).utc().format("YYYY-MM-DD HH:mm") : "",
                    EndTime: item.EndTime ? dayjs(item.EndTime).utc().format("YYYY-MM-DD HH:mm") : "",
                };
            });


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
        loading,
        error,
        data,
        fetchDisconnectionDetailsData,
    };
}
