import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getTestIdDateRangeList, getSensorComponentSerialsList, getSensorHealthData, getSensorHealthImage } from "@/api/sensor";


export function useTestIdDateRangeList() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchTestIdDateRangeList = async (form) => {       
        setLoading(true);
        setError(null);

        try {
            const payload = {
                startDateTime: form.startTime,
                endDateTime: form.endTime
            }

            const res = await getTestIdDateRangeList(payload);

            const options = (res || []).map((item) => ({
                value: item.SN,
                label: item.SN,
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
        fetchTestIdDateRangeList,
    };
}

export function useSensorDateRangeList() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSensorDateRangeList = async (params) => {       
        setLoading(true);
        setError(null);

        try {

            const res = await getSensorComponentSerialsList(params);

            const options = (res || []).map((item) => ({
                value: item.PRSN,
                label: item.PRSN,
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
        fetchSensorDateRangeList,
    };
}

export function useSensorHealthData() {

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSensorHealthData = async (form) => {       
        setLoading(true);
        setError(null);

        try {
            const payload = {
                startDateTime: form.startTime,
                endDateTime: form.endTime,
                SN: form.SN,
                PRSN: form.PRSN,
                validValues: form.diffValue,
            };

            const res = await getSensorHealthData(payload);

            const formatted = (res || []).map((item) => ({
                ...item,
                dt_F: item.dt_F ? dayjs(item.dt_F).utc().format("YYYY-MM-DD HH:mm") : "",
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
        loading,
        error,
        data,
        fetchSensorHealthData,
    };
}


export function useSensorHealthImage() {

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSensorHealthImage = async (imagePath, title) => {       
        setLoading(true);
        setError(null);

        try {
            const res = await getSensorHealthImage({ imagePath: imagePath });
            const imageUrl = URL.createObjectURL(res);
            const imgWindow = window.open('', '_blank');
            if (imgWindow) {
  
                imgWindow.document.title = `${title}_圖表`;

                const style = imgWindow.document.createElement('style');
                style.textContent = `
                    body { margin: 0; background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; }
                    img { max-width: 100%; max-height: 100%; object-fit: contain; }
                `;
                imgWindow.document.head.appendChild(style);

                const img = imgWindow.document.createElement('img');
                img.src = imageUrl;
                img.alt = "Chart";
                
                imgWindow.document.body.appendChild(img);
                imgWindow.onbeforeunload = () => URL.revokeObjectURL(imageUrl);
            }

            setData(res);

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
        fetchSensorHealthImage,
    };
}
