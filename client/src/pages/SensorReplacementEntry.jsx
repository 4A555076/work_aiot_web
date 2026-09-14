import { useState, useEffect } from "react";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import { Scanner } from "@yudiel/react-qr-scanner";
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { Camera, ImageUp } from "lucide-react";
import { useProjectsList, useSensorSerialList, useStationList, useUpdateSensor } from "@/hook/useSensorReplacementEntry";


export default function SensorReplacementEntryPage() {
  const [form, setForm] = useState({
    project: "",
    station: "",
    sensor: "",
  });

  const [openScanner, setOpenScanner] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [showSerialMenu, setShowSerialMenu] = useState(false);
  const [sensorKeyword, setSensorKeyword] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  const {
    data: projectsListData,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: StationListData,
    loading: loadingStationList,
    fetchStationList,
  } = useStationList();

  const {
    data: sensorSerialList,
    loading: loadingSensorSerialList,
    error: sensorSerialError,
    fetchSensorSerialList,
    clearSensorSerialList,
  } = useSensorSerialList();
  const {
    loading: updatingSensor,
    error: updateSensorError,
    fetchUpdateSensor,
  } = useUpdateSensor();

  const canEnterSensor = Boolean(form.project && form.station);

  useEffect(() => {
    fetchProjectsList();
  }, []);

  useEffect(() => {
    if (!form.project) {
      setForm((prev) => ({ ...prev, station: "" }));
      return;
    }

    fetchStationList({ project: form.project });
    setForm((prev) => ({ ...prev, station: "" }));
  }, [form.project]);

  useEffect(() => {
    const keyword = sensorKeyword.trim();

    if (!canEnterSensor || !keyword) {
      clearSensorSerialList();
      return;
    }

    const timer = window.setTimeout(() => {
      fetchSensorSerialList(keyword);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [sensorKeyword, canEnterSensor]);

  const normalizedSensor = form.sensor.trim().toLowerCase();
  const filteredSensorSerials = sensorSerialList.filter((serial) =>
    serial.toLowerCase().includes(normalizedSensor)
  );
  const sensorGuideText = !form.project
    ? "請先選擇專案"
    : !form.station
      ? "請先選擇測站"
      : "可直接輸入序號，或使用下方條碼辨識";

  const handleScan = (result) => {
    if (!result?.[0]?.rawValue) return;

    setForm((prev) => ({ ...prev, sensor: result[0].rawValue }));
    setSensorKeyword("");
    setOpenScanner(false); 
  };

  const handlePhotoScan = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setReadingPhoto(true);
    setPhotoError("");

    try {
      const detector = new BarcodeDetector();
      const results = await detector.detect(file);
      const serial = results?.[0]?.rawValue;

      if (!serial) {
        setPhotoError("無法辨識到條碼，請換一張較清晰的照片或使用其他方法");
        return;
      }

      setForm((prev) => ({ ...prev, sensor: serial }));
      setSensorKeyword("");
    } catch (error) {
      console.error("照片條碼辨識失敗:", error);
      setPhotoError("照片條碼辨識失敗，請重試或改用相機掃描");
    } finally {
      setReadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    const newSensorSn = form.sensor.trim();
    if (!form.project || !form.station || !newSensorSn) return;

    setSubmitMessage("");
    try {
      const response = await fetchUpdateSensor({
        PJID: form.project,
        STID: form.station,
        newSensorSn,
      });
      setSubmitMessage(response?.message || "Sensor 更換成功");
      setForm((prev) => ({ ...prev, sensor: "" }));
      setSensorKeyword("");
      clearSensorSerialList();
    } catch {
      // Error text is exposed by the hook and rendered below.
    }
  };

  return (
    <div className="space-y-8">
      <PageTitle description="本功能目前僅開放 PM₂.₅。選定測站並完成序號輸入或掃描後，系統將自動覆寫參數"/>

      <div className="space-y-5">
        <BaseCard
          title={
            <span className="flex items-center gap-2">
              <b className="grid size-7 place-items-center rounded-full bg-primary text-xs xl:size-8 2xl:size-9 xl:text-sm 2xl:text-base text-primary-foreground">1</b>
              選擇更換位置
            </span>
          }
          subtitle="請依序選擇專案與測站"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <BaseSelect
              label="專案"
              value={form.project}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, project: val, station: "", sensor: "" }));
                setSensorKeyword("");
              }}
              options={projectsListData}
              placeholder="請選擇專案"
            />

            <BaseSelect
              label="測站"
              value={form.station}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, station: val, sensor: "" }));
                setSensorKeyword("");
              }}
              options={StationListData}
              placeholder={!form.project ? "請先選擇專案" : "請選擇測站"}
              disabled={!form.project || loadingStationList}
            />
          </div>
        </BaseCard>

        <BaseCard
          title={
            <span className="flex items-center gap-2">
              <b className="grid size-7 place-items-center rounded-full bg-primary text-xs xl:size-8 2xl:size-9 xl:text-sm 2xl:text-base text-primary-foreground">2</b>
              輸入新 Sensor 序號
            </span>
          }
          subtitle={sensorGuideText}
          className={canEnterSensor ? "" : "opacity-75"}
        >
          <div className="space-y-3">
            <div
              className="space-y-2"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setShowSerialMenu(false);
              }}
            >
              <div className="relative">
                <BaseInput
                  label="直接輸入搜尋"
                  disabled={!canEnterSensor}
                  value={form.sensor}
                  onFocus={() => canEnterSensor && setShowSerialMenu(true)}
                  onChange={(e) => {
                    setForm({ ...form, sensor: e.target.value });
                    setSensorKeyword(e.target.value);
                    setShowSerialMenu(true);
                  }}
                  placeholder={!canEnterSensor ? sensorGuideText : loadingSensorSerialList ? "序號清單載入中..." : "直接輸入搜尋"}
                />

                {canEnterSensor && showSerialMenu && !loadingSensorSerialList && (
                  <div
                    role="listbox"
                    className="absolute inset-x-0 top-full z-40 mt-2 max-h-40 overflow-y-auto rounded-xl border border-border bg-white p-1.5 shadow-xl"
                  >
                    {filteredSensorSerials.length > 0 ? filteredSensorSerials.map((serial) => (
                      <button
                        key={serial}
                        type="button"
                        role="option"
                        aria-selected={form.sensor === serial}
                        className="flex w-full items-center rounded-lg px-3 py-2.5 text-left type-body hover:bg-input/30 "
                        onClick={() => {
                          setForm((prev) => ({ ...prev, sensor: serial }));
                          setSensorKeyword("");
                          setShowSerialMenu(false);
                        }}
                      >
                        <span className="min-w-0 break-all">{serial}</span>
                      </button>
                    )) : (
                      <div className="px-3 py-6 text-center type-body text-muted-foreground ">
                        沒有結果
                      </div>
                    )}
                  </div>
                )}
              </div>
              {sensorSerialError && <p className="type-meta text-destructive ">{sensorSerialError}</p>}
            </div>

            <div className="relative flex items-center py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="px-3 type-meta text-muted-foreground ">或使用條碼辨識</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <BaseButton 
                type="button" 
                variant="secondary" 
                disabled={!canEnterSensor} 
                onClick={() => setOpenScanner(true)}
              >
                <Camera className="h-4 w-4" />
                相機掃描
              </BaseButton>

              <BaseButton 
                type="button" 
                variant="outline" 
                disabled={!canEnterSensor} 
                loading={readingPhoto} 
                onClick={() => document.getElementById("sensor-photo-input")?.click()}
              >
                <ImageUp className="h-4 w-4" />
                選擇條碼照片
              </BaseButton>
            </div>

            <input 
              id="sensor-photo-input" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handlePhotoScan} 
            />
            
            {photoError && <p className="type-meta text-destructive ">{photoError}</p>}
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 truncate text-muted-foreground">
                {form.sensor.trim() ? `目前序號：${form.sensor}` : "輸入序號後即可確認更換"}
              </p>
              <BaseButton
                className="w-full px-8 sm:w-auto"
                disabled={!canEnterSensor || !form.sensor.trim()}
                loading={updatingSensor}
                onClick={handleSubmit}
              >
                確定更換
              </BaseButton>
            </div>
            {updateSensorError && <p className="type-body text-destructive ">{updateSensorError}</p>}
            {submitMessage && <p className="type-body text-emerald-700 ">{submitMessage}</p>}
          </div>
        </BaseCard>
      </div>

      {openScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-center type-section-title font-bold ">掃描 Sensor 條碼</h2>
              <p className="mt-1 text-center type-body text-muted-foreground ">請將條碼置於掃描框中央</p>
            </div>

            <Scanner
              constraints={{
                facingMode: "environment",
              }}
              onScan={handleScan}
              onError={(err) => console.log(err)}
            />

            <BaseButton
              variant="destructive"
              className="w-full"
              onClick={() => setOpenScanner(false)}
            >
              關閉
            </BaseButton>
          </div>
        </div>
      )}
    </div>
  );
}
