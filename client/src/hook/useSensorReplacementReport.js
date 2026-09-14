import { useState } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { getSensorReplacementReport } from "@/api/sensor";

export function useSensorReplacementReport() {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSensorReplacementReport = async (form) => {
    setLoading(true);
    setError(null);

    try {
      const res = await getSensorReplacementReport(form);
      const formatted = (res || []).map((item) => ({
          ...item,
          amdDate: item.amdDate ? dayjs(item.amdDate).utc().format("YYYY-MM-DD HH:mm") : "",
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
    fetchSensorReplacementReport 
  };
}
