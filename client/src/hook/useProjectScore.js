import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getProjectsList, getProjectHealthData } from "@/api/station";

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


export function useProjectHealthData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchProjectHealthData = async (form, projectOptions = []) => {       
        setLoading(true);
        setError(null);

        try {

            const payload = {
                startDate: form.startTime,
                endDate: form.endTime,
                PJIDList: form.project
            }
            const res = await getProjectHealthData(payload);

            if (!res || res.length === 0) {
                setData([]);
                return;
            }

            const projectIds = Object.keys(res[0]).filter((key) => key !== "Date_Time");

            const seriesMap = projectIds.reduce((acc, id) => {
                const matchedProject = projectOptions.find(opt => String(opt.value) === String(id));
                const seriesName = matchedProject ? matchedProject.label : `專案 ${id}`;

                acc[id] = { 
                    id, 
                    name: seriesName,
                    data: [] 
                };
                return acc;
            }, {});

            res.forEach((item) => {
                const timestamp = new Date(dayjs(item.Date_Time).utc().format("YYYY-MM-DD HH:mm")).getTime();
                projectIds.forEach((id) => {
                    if (item[id] !== undefined) {
                        seriesMap[id].data.push([timestamp, item[id]]);
                    }
                });
            });

            setData(Object.values(seriesMap));
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
        fetchProjectHealthData,
    };
}