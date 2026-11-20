import { useState } from "react";
import dayjs from 'dayjs'
import { 
    getTestIdDateRangeList, 
    getSensorComponentSerialsList, 
    getSensorHealthData, 
    getSensorHealthImage 
} from "@/api/sensor";


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
                dt_F: item.dt_F ? dayjs(item.dt_F).format("YYYY-MM-DD HH:mm") : "",
            }));

            setData(formatted);
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
        fetchSensorHealthData,
    };
}


export function useSensorHealthImage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSensorHealthImage = async ({ SN, PRSN }) => {

    const imgWindow = window.open("", "_blank");

    if (!imgWindow) {
      setError("無法開啟圖片視窗，請允許瀏覽器開啟彈出視窗");
      return;
    }

    setLoading(true);
    setError(null);

    let imageUrl = null;

    try {
      imgWindow.document.title = `${PRSN}_圖表`;

      // 先顯示載入文字
      const loadingText = imgWindow.document.createElement("p");
      loadingText.textContent = "圖片載入中...";
      loadingText.style.cssText =
        "color: white; font-family: sans-serif; text-align: center;";

      const style = imgWindow.document.createElement("style");
      style.textContent = `
        body {
          margin: 0;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }

        img {
          max-width: 100%;
          max-height: 100vh;
          object-fit: contain;
        }
      `;

      imgWindow.document.head.appendChild(style);
      imgWindow.document.body.style.background = "#000";
      imgWindow.document.body.appendChild(loadingText);

      const res = await getSensorHealthImage({ SN, PRSN });

      if (!(res instanceof Blob) || !res.type.startsWith("image/")) {
        throw new Error("伺服器未回傳有效圖片");
      }

      imageUrl = URL.createObjectURL(res);

      const img = imgWindow.document.createElement("img");
      img.src = imageUrl;
      img.alt = `${PRSN} 品檢圖表`;

      // 替換載入文字
      imgWindow.document.body.replaceChildren(img);

      // 視窗關閉時釋放圖片資源
      imgWindow.addEventListener(
        "pagehide",
        () => URL.revokeObjectURL(imageUrl),
        { once: true }
      );

      setData(res);
    } catch (err) {
      console.error("Sensor health image error:", err);

      const errMsg =
        err?.response?.data?.message ||
        err?.message ||
        "圖片載入失敗";

      setError(errMsg);

      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }

      if (!imgWindow.closed) {
        const errorText = imgWindow.document.createElement("p");
        errorText.textContent = errMsg;
        errorText.style.color = "white";
        imgWindow.document.body.replaceChildren(errorText);
      }
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
