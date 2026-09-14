import { useState, useEffect } from "react";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { Check, ChevronLeft, ChevronRight, CirclePlus, ImagePlus, Trash2 } from "lucide-react";
import { useProjectsList, useStationList, useStationInfoData, useStationData, useAddInspectionData } from "@/hook/useInspectionEntry";
import BaseButton from "@/components/common/button/BaseButton";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import BaseInput from "@/components/common/input/BaseInput";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import BaseList from "@/components/common/list/BaseList";
import GoogleMap from "@/components/common/map/GoogleMap";
import {
  cabinetAndLockOptions,
  deviceFixedOptions,
  deviceModelOptions,
  exteriorConditionOptions,
  maintenanceRecordOptions,
  newEmissionSourceOptions,
  powerConnectionOptions,
  relocationAssessmentOptions,
  sensorCleaningOptions,
  sensorValueStableOptions,
  surroundingsCheckOptions,
  weatherOptions,
} from "@/constants/InspectionEntry";

const inspectionSteps = [
  { number: 1, title: "基本資料", description: "巡檢資訊與現場環境" },
  { number: 2, title: "檢查項目", description: "設備與感測器檢查" },
  { number: 3, title: "上傳照片", description: "現場照片紀錄" },
];

const name = Cookies.get("name") || "管理者";

const initialInspectionForm = {
  maintainer: name,
  inspectionDeviceId: "",
  sensorId: "",
  inspectionDate: "",
  startTime: "",
  temperature: "",
  humidity: "",
  weather: "",
  deviceModel: "",
  environmentDescription: "",
  cabinetAndLock: "",
  cabinetAndLockOther: "",
  exteriorCondition: "",
  exteriorConditionOther: "",
  powerConnection: "",
  powerConnectionOther: "",
  deviceFixed: "",
  sensorCleaning: "",
  surroundingsCheck: "",
  surroundingsCheckOther: "",
  newEmissionSource: "",
  newEmissionSourceOther: "",
  sensorValueStable: "",
  maintenanceRecord: "",
  maintenanceRecordOther: "",
  relocationAssessment: "",
  exteriorPhoto: null,
  interiorPhoto: null,
  obstructionPhoto: null,
  perimeterPhoto: null,
};

const requiredFieldsByStep = {
  1: ["maintainer", "sensorId", "inspectionDate", "startTime", "temperature", "humidity", "weather", "deviceModel"],
  2: [
    "environmentDescription", "cabinetAndLock", "exteriorCondition",
    "powerConnection", "deviceFixed", "sensorCleaning", "surroundingsCheck",
    "newEmissionSource", "sensorValueStable", "maintenanceRecord", "relocationAssessment",
  ],
  3: ["exteriorPhoto", "interiorPhoto", "obstructionPhoto", "perimeterPhoto"],
};

const otherFields = {
  cabinetAndLock: "cabinetAndLockOther",
  exteriorCondition: "exteriorConditionOther",
  powerConnection: "powerConnectionOther",
  surroundingsCheck: "surroundingsCheckOther",
  newEmissionSource: "newEmissionSourceOther",
  maintenanceRecord: "maintenanceRecordOther",
};

function getSearchValidationMessage(searchForm) {
  return searchForm.project && searchForm.station
    ? null
    : "請確認已填寫：專案、測站";
}

function createStationDataParams(project) {
  return {
    PJID: project,
    startDateTime: dayjs().subtract(1, "minute").format("YYYY-MM-DD HH:mm"),
    endDateTime: dayjs().format("YYYY-MM-DD HH:mm"),
    type: "T01",
    top: "TOP",
  };
}

function getStationName(stationId, stationOptions) {
  const stationLabel = stationOptions.find(({ value }) => value === stationId)?.label;
  return String(stationLabel ?? stationId)
    .replace(/^[（(][^）)]*[）)]\s*/, "")
    .trim();
}

function createStationInspectionValues(stationData, stationId, stationOptions) {
  const measurements = stationData.flatMap(
    (station) => station.measurements ?? []
  );
  const getMeasurementValue = (measurementName) =>
    measurements.find(
      ({ measurement }) => measurement?.name === measurementName
    )?.measurement?.value ?? "";

  return {
    sensorId: getStationName(stationId, stationOptions),
    inspectionDate: dayjs(stationData[0].Date_Time).format("YYYY-MM-DD"),
    startTime: dayjs(stationData[0].Date_Time).format("HH:mm"),
    temperature: getMeasurementValue("TMP"),
    humidity: getMeasurementValue("HUM"),
  };
}

function isEmptyField(value) {
  return value == null || (typeof value === "string" && !value.trim());
}

function getMissingInspectionFields(inspectionForm, stepNumber) {
  const missingFields = requiredFieldsByStep[stepNumber].filter(
    (field) => isEmptyField(inspectionForm[field])
  );

  if (stepNumber === 2) {
    Object.entries(otherFields).forEach(([field, otherField]) => {
      if (inspectionForm[field] === "其他" && isEmptyField(inspectionForm[otherField])) {
        missingFields.push(otherField);
      }
    });
  }

  return missingFields;
}

function normalizeInspectionForm(inspectionForm) {
  const payload = { ...inspectionForm };

  Object.entries(otherFields).forEach(([field, otherField]) => {
    if (payload[field] === "其他") payload[field] = payload[otherField].trim();
    delete payload[otherField];
  });

  return payload;
}

function createInspectionFormData(inspectionForm) {
  const payload = normalizeInspectionForm(inspectionForm);
  const formData = new FormData();

  formData.append("data", JSON.stringify({
    inspectionID: payload.inspectionDeviceId,
    IIT: payload.sensorId,
    startDate: payload.inspectionDate,
    startTime: payload.startTime,
    weather: payload.weather,
    TMP: payload.temperature,
    HUM: payload.humidity,
    modelType: payload.deviceModel,
    environmental: payload.environmentDescription,
    outside: payload.exteriorCondition,
    electricity: payload.powerConnection,
    fixedCheck: payload.deviceFixed,
    lockCheck: payload.cabinetAndLock,
    clean: payload.sensorCleaning,
    surrounding1M: payload.surroundingsCheck,
    surrounding50M: payload.newEmissionSource,
    valueStable: payload.sensorValueStable,
    fixRecord: payload.maintenanceRecord,
    migrate: payload.relocationAssessment,
  }));

  formData.append("east", payload.exteriorPhoto);
  formData.append("west", payload.interiorPhoto);
  formData.append("south", payload.obstructionPhoto);
  formData.append("north", payload.perimeterPhoto);

  return formData;
}

function SectionTitle({ number, children }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm xl:h-8 xl:w-8 2xl:h-9 2xl:w-9 xl:text-base 2xl:text-lg font-bold text-primary">
        {number}
      </span>
      <h3 className="font-semibold text-foreground">{children}</h3>
    </div>
  );
}

function SelectWithOther({
  label,
  value,
  otherValue,
  onChange,
  onOtherChange,
  options,
  error,
  otherError,
}) {
  return (
    <div className="space-y-3">
      <BaseSelect
        label={label}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue);
          if (nextValue !== "其他") onOtherChange("");
        }}
        options={options}
        error={error}
      />
      {value === "其他" && (
        <BaseInput
          label="其他說明"
          value={otherValue}
          onChange={(event) => onOtherChange(event.target.value)}
          placeholder="請輸入其他內容"
          error={otherError}
        />
      )}
    </div>
  );
}

function PhotoInput({ id, label, file, onChange, onRemove, error }) {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className={`rounded-2xl border bg-card p-4 ${error ? "border-destructive" : "border-border"}`}>
      <p className="mb-3 type-body font-semibold leading-relaxed text-foreground ">{label}</p>
      {file ? (
        <div className="space-y-3">
          <img src={previewUrl} alt={`${label}預覽`} className="h-48 w-full rounded-xl border border-border object-cover" />
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate type-meta text-muted-foreground ">{file.name}</p>
            <BaseButton type="button" variant="outline" size="sm" onClick={onRemove}>
              <Trash2 className="mr-1 h-4 w-4" />移除
            </BaseButton>
          </div>
        </div>
      ) : (
        <label htmlFor={id} className="flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-input bg-secondary/30 px-4 text-center transition-colors hover:border-primary hover:bg-primary/5">
          <ImagePlus className="mb-3 h-8 w-8 text-primary" />
          <span className="type-body font-medium ">點擊選擇圖片</span>
        </label>
      )}
      <input
        id={id}
        className="hidden"
        type="file"
        accept="image/*,.heic"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </div>
  );
}

export default function InspectionEntryPage() {
  return <InspectionEntry />;
}

export function InspectionEntry({ dashboardStation = null, onClose }) {
  const [form, setForm] = useState(() => dashboardStation || { project: "", station: "" });
  const [hasSearched, setHasSearched] = useState(false);
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [step, setStep] = useState(1);
  const [inspectionForm, setInspectionForm] = useState(initialInspectionForm);
  const [invalidFields, setInvalidFields] = useState(new Set());
  const [initializing, setInitializing] = useState(Boolean(dashboardStation));

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
    data: stationInfoData,
    geo,
    loading: loadingStationInfoData,
    error: errorStationInfoData,
    fetchStationInfoData,
  } = useStationInfoData();

  const { data: stationData, loading: loadingStationData, error: errorStationData, fetchStationData } = useStationData();
  const {
    data: addedInspectionData,
    error: addInspectionError,
    addInspection,
    loading: addingInspection,
  } = useAddInspectionData();

  const handleSearch = async () => {
    const validationMessage = getSearchValidationMessage(form);

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    setHasSearched(true);
    setShowInspectionForm(false);
    setStep(1);
    await fetchStationInfoData({
      project: form.project,
      station: form.station,
    });
  };

  useEffect(() => {
    if (dashboardStation) {
      let cancelled = false;
      const openDashboardInspection = async () => {
        await fetchStationList({ project: dashboardStation.project });
        if (cancelled) return;
        await fetchStationData(dashboardStation.station, createStationDataParams(dashboardStation.project));
        if (!cancelled) setInitializing(false);
      };
      openDashboardInspection();
      return () => { cancelled = true; };
    }
    fetchProjectsList();
  }, []);

  useEffect(() => {
    if (dashboardStation) return;
    if (!form.project) {
      setForm((prev) => ({ ...prev, station: "" }));
      return;
    }

    fetchStationList({ project: form.project });
    setForm((prev) => ({ ...prev, station: "" }));
  }, [form.project]);

  useEffect(() => {
    if (!Array.isArray(stationData) || stationData.length === 0) return;

    const stationInspectionValues = createStationInspectionValues(
      stationData,
      form.station,
      StationListData
    );

    setInspectionForm((previous) => ({
      ...previous,
      ...stationInspectionValues,
    }));
    setShowInspectionForm(true);
    setStep(1);
  }, [stationData]);

  useEffect(() => {
    if (!addedInspectionData) return;

    alert(addedInspectionData.message || "巡檢資料新增成功");
    setShowInspectionForm(false);
    setStep(1);
    setInspectionForm({ ...initialInspectionForm });
    setInvalidFields(new Set());
    if (dashboardStation) onClose?.();
  }, [addedInspectionData]);

  useEffect(() => {
    if (addInspectionError) alert(addInspectionError);
  }, [addInspectionError]);

  const updateInspectionForm = (name, value) => {
    setInspectionForm((previous) => ({ ...previous, [name]: value }));
    setInvalidFields((previous) => {
      const next = new Set(previous);
      next.delete(name);
      return next;
    });
  };

  const handleNextStep = () => {
    const missingFields = getMissingInspectionFields(inspectionForm, step);
    if (missingFields.length > 0) {
      setInvalidFields(new Set(missingFields));
      alert("請填寫所有必填欄位。");
      return;
    }

    setInvalidFields(new Set());
    setStep((current) => current + 1);
  };

  const handleInspectionFormOpenChange = (open) => {
    setShowInspectionForm(open);

    if (!open) {
      setStep(1);
      setInspectionForm({ ...initialInspectionForm });
      setInvalidFields(new Set());
      if (dashboardStation) onClose?.();
    }
  };

  const handleAddInspection = () => {
    fetchStationData(form.station, createStationDataParams(form.project));
  };

  const handleSubmit = async () => {
    const missingFields = getMissingInspectionFields(inspectionForm, 3);

    if (missingFields.length > 0) {
      setInvalidFields(new Set(missingFields));
      alert("請填寫所有必填欄位。");
      return;
    }

    const requestData = createInspectionFormData(inspectionForm);

    try {
      await addInspection(requestData);
    } catch {
      // Error text is exposed by the hook and handled by the effect above.
    }
  };

  return (
    <div className="space-y-8">
      {!dashboardStation && <>
      <PageTitle description="提交現場巡檢與設備狀態"/>
      <BaseCard title="選擇巡檢測站" subtitle="先選擇專案與測站，以載入現場巡檢所需資訊">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-end">
          <BaseSelect
            label="專案"
            value={form.project}
            onChange={(val) => setForm({ ...form, project: val })}
            options={projectsListData}
            placeholder="請選擇專案"
          />
          <BaseSelect
            label="測站"
            value={form.station}
            onChange={(val) => setForm({ ...form, station: val })}
            options={StationListData}
            placeholder={!form.project ? "請先選擇專案" : "請選擇測站"}
            disabled={!form.project || loadingStationList}
          />
          <BaseButton 
            onClick={handleSearch} 
            className="w-full sm:w-auto"
          >
            查詢
          </BaseButton>

        </div>
      </BaseCard>

      {errorStationData && <p className="type-body text-destructive">{errorStationData}</p>}

      {hasSearched && (
        <BaseApiLoaderWrapper
          isLoading={loadingStationInfoData || loadingStationData || (Boolean(dashboardStation) && loadingStationList)}
          isError={errorStationInfoData}
        >
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">

            {stationInfoData?.length > 0 && (
              <div className="flex justify-stretch xl:col-span-3 sm:justify-end">
                <BaseButton
                  className="w-full sm:w-auto"
                  onClick={handleAddInspection}
                >
                  <CirclePlus className="mr-1 h-5 w-5"/>新增測站巡檢
                </BaseButton>
              </div>
            )}

            <div className="xl:col-span-2">
              <BaseCard title="基本資料" subtitle="測站與設備資訊">
                <BaseList items={stationInfoData}/>
              </BaseCard> 
            </div>

            <div className="xl:col-span-1">
              <BaseCard title="位置" subtitle="測站座標">
                {geo.lat && geo.lng ? (
                  <GoogleMap lat={geo.lat} lng={geo.lng} />
                ) : (
                  <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 type-body text-muted-foreground ">無座標資料</div>
                )}
              </BaseCard>
            </div>

            <div className="xl:col-span-2">
              <BaseCard title="環境照片" subtitle="">
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/40 type-body text-muted-foreground ">無環境照片</div>
              </BaseCard> 
            </div>

          </div>
                
        </BaseApiLoaderWrapper>
      )}
      </>}

      {dashboardStation && !showInspectionForm && (
        <BaseDialog open onOpenChange={(open) => { if (!open) onClose?.(); }} title="新增巡檢" hideFooter>
          <p className="type-body">專案：{form.project} · 測站：{form.station}</p>
          <p className="mt-3 type-body" role="status">
            {initializing || loadingStationData ? "載入巡檢資料中…" : errorStationData || "目前沒有可用的測站資料，請稍後重試。"}
          </p>
          {!initializing && !loadingStationData && <BaseButton className="mt-4" onClick={handleAddInspection}>重新載入</BaseButton>}
        </BaseDialog>
      )}

      <BaseDialog
        open={showInspectionForm}
        onOpenChange={handleInspectionFormOpenChange}
        title="新增巡檢表單"
        description={`步驟 ${step} / ${inspectionSteps.length}・${inspectionSteps[step - 1].description}`}
        hideFooter
        className="sm:max-w-5xl"
      >
        <form onSubmit={(event) => event.preventDefault()} className="space-y-6">
            <ol className="grid grid-cols-3 gap-2" aria-label="表單進度">
              {inspectionSteps.map((item) => {
                const isActive = step === item.number;
                const isComplete = step > item.number;
                return (
                  <li key={item.number} className="relative">
                    <button
                      type="button"
                      onClick={() => setStep(item.number)}
                      className={`flex w-full flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition-colors ${
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm 2xl:h-9 2xl:w-9 xl:text-base 2xl:text-lg font-bold ${
                        isActive || isComplete ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"
                      }`}>
                        {isComplete ? <Check className="h-4 w-4" /> : item.number}
                      </span>
                      <span className="type-body font-semibold ">{item.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>

            {step === 1 && (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <BaseInput 
                  label="維護人員" 
                  name="maintainer" 
                  value={inspectionForm.maintainer} 
                  error={invalidFields.has("maintainer")}
                  readOnly 
                  className="bg-secondary"
                />
                <BaseInput 
                  label="巡檢測站(裝置名稱)" 
                  name="inspectionDeviceId" 
                  value={inspectionForm.inspectionDeviceId} 
                  onChange={(event) => updateInspectionForm("inspectionDeviceId", event.target.value)} 
                  placeholder="請輸入巡檢測站(裝置名稱)" 
                />
                <BaseInput 
                  label="受檢測站(裝置名稱)" 
                  name="sensorId" 
                  value={inspectionForm.sensorId} 
                  error={invalidFields.has("sensorId")}
                  readOnly 
                  className="bg-secondary" 
                />
                <BaseInput 
                  label="巡檢日期" 
                  name="inspectionDate" 
                  type="date" 
                  value={inspectionForm.inspectionDate} 
                  error={invalidFields.has("inspectionDate")}
                  readOnly 
                  className="bg-secondary" 
                />
                <BaseInput 
                  label="開始時間" 
                  name="startTime" 
                  type="time" 
                  value={inspectionForm.startTime} 
                  error={invalidFields.has("startTime")}
                  readOnly 
                  className="bg-secondary" 
                />
                <BaseInput 
                  label="溫度" 
                  name="temperature" 
                  value={inspectionForm.temperature} 
                  error={invalidFields.has("temperature")}
                  readOnly 
                  className="bg-secondary" 
                  endAdornment={<span className="px-2 type-body text-muted-foreground">°C</span>} 
                />
                <BaseInput 
                  label="相對溼度" 
                  name="humidity" 
                  value={inspectionForm.humidity} 
                  error={invalidFields.has("humidity")}
                  readOnly 
                  className="bg-secondary" 
                  endAdornment={<span className="px-2 type-body text-muted-foreground">%</span>} 
                />
                <BaseSelect 
                  label="天氣" 
                  value={inspectionForm.weather} 
                  error={invalidFields.has("weather")}
                  onChange={(value) => updateInspectionForm("weather", value)} 
                  options={weatherOptions} placeholder="請選擇天氣" 
                />
                <BaseSelect 
                  label="設備型號" 
                  value={inspectionForm.deviceModel} 
                  error={invalidFields.has("deviceModel")}
                  onChange={(value) => updateInspectionForm("deviceModel", value)} 
                  options={deviceModelOptions} placeholder="請選擇設備型號" 
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-7">
                <section className="space-y-4">
                  <SectionTitle number="一">周圍環境描述</SectionTitle>
                  <BaseInput 
                    label="環境描述" 
                    name="environmentDescription" 
                    value={inspectionForm.environmentDescription} 
                    error={invalidFields.has("environmentDescription")}
                    onChange={(event) => updateInspectionForm("environmentDescription", event.target.value)} 
                    placeholder="請描述測站周圍環境" 
                  />
                </section>
                <section className="space-y-5">
                  <SectionTitle number="二">設備外觀檢查</SectionTitle>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <SelectWithOther 
                      label="箱體開關及鎖頭檢查" 
                      value={inspectionForm.cabinetAndLock} 
                      otherValue={inspectionForm.cabinetAndLockOther} 
                      error={invalidFields.has("cabinetAndLock")}
                      otherError={invalidFields.has("cabinetAndLockOther")}
                      onChange={(value) => updateInspectionForm("cabinetAndLock", value)} 
                      onOtherChange={(value) => updateInspectionForm("cabinetAndLockOther", value)} 
                      options={cabinetAndLockOptions} 
                    />
                    <SelectWithOther 
                      label="設備本體外部狀況" 
                      value={inspectionForm.exteriorCondition} 
                      otherValue={inspectionForm.exteriorConditionOther} 
                      error={invalidFields.has("exteriorCondition")}
                      otherError={invalidFields.has("exteriorConditionOther")}
                      onChange={(value) => updateInspectionForm("exteriorCondition", value)} 
                      onOtherChange={(value) => updateInspectionForm("exteriorConditionOther", value)} 
                      options={exteriorConditionOptions} 
                    />
                    <SelectWithOther 
                      label="設備電源接續狀況" 
                      value={inspectionForm.powerConnection} 
                      otherValue={inspectionForm.powerConnectionOther} 
                      error={invalidFields.has("powerConnection")}
                      otherError={invalidFields.has("powerConnectionOther")}
                      onChange={(value) => updateInspectionForm("powerConnection", value)} 
                      onOtherChange={(value) => updateInspectionForm("powerConnectionOther", value)} 
                      options={powerConnectionOptions} 
                    />
                    <fieldset className={`space-y-2 rounded-xl border p-3 ${invalidFields.has("deviceFixed") ? "border-destructive" : "border-transparent"}`}>
                      <legend className="type-body font-semibold text-foreground ">設備固定檢查</legend>
                      <BaseCheckbox
                        value={inspectionForm.deviceFixed ? [inspectionForm.deviceFixed] : []}
                        onChange={(value) => updateInspectionForm("deviceFixed", value[0] || "")}
                        items={deviceFixedOptions}
                        multiple={false}
                      />
                    </fieldset>
                  </div>
                </section>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <section className="space-y-4">
                    <SectionTitle number="三">感測器清潔</SectionTitle>
                    <BaseSelect 
                      value={inspectionForm.sensorCleaning} 
                      error={invalidFields.has("sensorCleaning")}
                      onChange={(value) => updateInspectionForm("sensorCleaning", value)} 
                      options={sensorCleaningOptions} 
                    />
                  </section>
                  <section className="space-y-4">
                    <SectionTitle number="四">設備周邊檢查</SectionTitle>
                    <SelectWithOther 
                      value={inspectionForm.surroundingsCheck} 
                      otherValue={inspectionForm.surroundingsCheckOther} 
                      error={invalidFields.has("surroundingsCheck")}
                      otherError={invalidFields.has("surroundingsCheckOther")}
                      onChange={(value) => updateInspectionForm("surroundingsCheck", value)} 
                      onOtherChange={(value) => updateInspectionForm("surroundingsCheckOther", value)} 
                      options={surroundingsCheckOptions} 
                    />
                  </section>
                  <section className="space-y-4">
                    <SectionTitle number="五">設備周邊 50 公尺新增排放源</SectionTitle>
                    <SelectWithOther 
                      value={inspectionForm.newEmissionSource} 
                      otherValue={inspectionForm.newEmissionSourceOther} 
                      error={invalidFields.has("newEmissionSource")}
                      otherError={invalidFields.has("newEmissionSourceOther")}
                      onChange={(value) => updateInspectionForm("newEmissionSource", value)} 
                      onOtherChange={(value) => updateInspectionForm("newEmissionSourceOther", value)} 
                      options={newEmissionSourceOptions} 
                    />
                  </section>
                  <section className="space-y-4">
                    <SectionTitle number="六">確認感測器數值是否穩定</SectionTitle>
                    <BaseSelect 
                      value={inspectionForm.sensorValueStable} 
                      error={invalidFields.has("sensorValueStable")}
                      onChange={(value) => updateInspectionForm("sensorValueStable", value)} 
                      options={sensorValueStableOptions} 
                    />
                  </section>
                  <section className="space-y-4">
                    <SectionTitle number="七">維運檢修紀錄</SectionTitle>
                    <SelectWithOther 
                      value={inspectionForm.maintenanceRecord} 
                      otherValue={inspectionForm.maintenanceRecordOther} 
                      error={invalidFields.has("maintenanceRecord")}
                      otherError={invalidFields.has("maintenanceRecordOther")}
                      onChange={(value) => updateInspectionForm("maintenanceRecord", value)} 
                      onOtherChange={(value) => updateInspectionForm("maintenanceRecordOther", value)} 
                      options={maintenanceRecordOptions} 
                    />
                  </section>
                  <section className="space-y-4">
                    <SectionTitle number="八">感測器遷移評估</SectionTitle>
                    <BaseSelect 
                      value={inspectionForm.relocationAssessment} 
                      error={invalidFields.has("relocationAssessment")}
                      onChange={(value) => updateInspectionForm("relocationAssessment", value)} 
                      options={relocationAssessmentOptions} 
                    />
                  </section>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <PhotoInput 
                  id="exteriorPhoto" 
                  label="設備外觀檢查（設備外觀照）" 
                  file={inspectionForm.exteriorPhoto} 
                  error={invalidFields.has("exteriorPhoto")}
                  onChange={(file) => updateInspectionForm("exteriorPhoto", file)} 
                  onRemove={() => updateInspectionForm("exteriorPhoto", null)} 
                />
                <PhotoInput 
                  id="interiorPhoto" 
                  label="設備內檢查清理照" 
                  file={inspectionForm.interiorPhoto} 
                  error={invalidFields.has("interiorPhoto")}
                  onChange={(file) => updateInspectionForm("interiorPhoto", file)} 
                  onRemove={() => updateInspectionForm("interiorPhoto", null)} 
                />
                <PhotoInput 
                  id="obstructionPhoto" 
                  label="設備遮蔽檢查（整支燈桿照）" 
                  file={inspectionForm.obstructionPhoto} 
                  error={invalidFields.has("obstructionPhoto")}
                  onChange={(file) => updateInspectionForm("obstructionPhoto", file)} 
                  onRemove={() => updateInspectionForm("obstructionPhoto", null)} 
                />
                <PhotoInput 
                  id="perimeterPhoto" 
                  label="周界 50 公尺排放檢查（若無，放另一角度燈桿照）" 
                  file={inspectionForm.perimeterPhoto} 
                  error={invalidFields.has("perimeterPhoto")}
                  onChange={(file) => updateInspectionForm("perimeterPhoto", file)} 
                  onRemove={() => updateInspectionForm("perimeterPhoto", null)} 
                />
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
              <BaseButton 
                type="button" 
                variant="outline" 
                disabled={step === 1} 
                onClick={() => setStep((current) => current - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一步
              </BaseButton>
              {step < inspectionSteps.length ? (
                <BaseButton 
                  type="button" 
                  onClick={handleNextStep}
                >
                  下一步
                  <ChevronRight className="ml-1 h-4 w-4" />
                </BaseButton>
              ) : (
                <BaseButton type="button" loading={addingInspection} onClick={handleSubmit}>新增</BaseButton>
              )}
            </div>
        </form>
      </BaseDialog>

    </div>
  );
}
