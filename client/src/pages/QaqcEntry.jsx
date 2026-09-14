import { useState, useEffect } from "react";
import dayjs from 'dayjs'
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { Calculator, ChevronRight, ClipboardCheck, Eye, Pencil, Search, Star, Trash2, Undo2 } from "lucide-react";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseTab from "@/components/common/tab/BaseTab";
import BaseButton from "@/components/common/button/BaseButton";
import BaseInput from "@/components/common/input/BaseInput";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import {
  useAddQaqcData,
  usePCBListList,
  useQaqcRecord,
  useQaqcTestSerialsData,
} from "@/hook/useQaqcEntry";

const FIXED_SENSOR_COUNT = 2;
const FIRST_INPUT_SENSOR_NO = FIXED_SENSOR_COUNT + 1; // Sensor 3

const initialAddForm = {
  description: "",
  startTime: dayjs().format("YYYY-MM-DD"),
  endTime: dayjs().add(7, "day").format("YYYY-MM-DD"),
  selectedPCB: [],
  sensors: {},
  standardSensor: null,
};

function StepHeading({ number, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm xl:h-9 xl:w-9 2xl:h-10 2xl:w-10 xl:text-base 2xl:text-lg font-bold bg-foreground text-primary-foreground`}
      >
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 type-body text-muted-foreground ">{description}</p>
        )}
      </div>
    </div>
  );
}

export default function QaqcEntryPage() {
  const [mode, setMode] = useState("add");
  const [addForm, setAddForm] = useState(initialAddForm);
  const [statusMessage, setStatusMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("idle");
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [editSearchForm, setEditSearchForm] = useState({
    startTime: dayjs().subtract(1, "month").format("YYYY-MM-DD"),
    endTime: dayjs().format("YYYY-MM-DD"),
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [loadingRecordId, setLoadingRecordId] = useState(null);
  const [recordMode, setRecordMode] = useState("view");
  const {
    data: PCBListList,
    loading,
    error,
    fetchPCBListList,
  } = usePCBListList();
  const {
    loading: addingQaqc,
    error: addQaqcError,
    addQaqc,
    resetAddQaqc,
  } = useAddQaqcData();
  const {
    data: editData,
    loading: searchingEditData,
    error: editSearchError,
    fetchQaqcTestSerialsData,
  } = useQaqcTestSerialsData();
  const {
    loading: processingRecord,
    error: recordError,
    fetchQaqc,
    updateQaqc,
    calculateQaqc,
    deleteQaqc,
    resetQaqcRecord,
  } = useQaqcRecord();

  useEffect(() => {
    fetchPCBListList();
  }, []);

  useEffect(() => {
    setAddForm((prev) => {
      const sensors = {};
      prev.selectedPCB.forEach((id) => {
        const board = PCBListList.find((item) => item.STID === id);
        if (!board) return;
        const current = prev.sensors[id] || [];
        const sensorCount = Math.max(
          Number(board.numChs || 0) - FIXED_SENSOR_COUNT,
          0,
        );

        sensors[id] = Array.from(
          { length: sensorCount },
          (_, index) =>
            current[index] || { partNo: "", batchNo: "", serialNo: "" },
        );
      });
      const standardSensor =
        prev.standardSensor && prev.selectedPCB.includes(prev.standardSensor.ID)
          ? prev.standardSensor
          : null;
      return { ...prev, sensors, standardSensor };
    });
  }, [addForm.selectedPCB, PCBListList]);

  useEffect(() => {
    if (!addForm.selectedPCB.length) {
      setActiveBoardId(null);
    } else if (!addForm.selectedPCB.includes(activeBoardId)) {
      setActiveBoardId(addForm.selectedPCB[0]);
    }
  }, [activeBoardId, addForm.selectedPCB]);

  const handleSensorChange = (id, index, field, value) => {
    setAddForm((prev) => ({
      ...prev,
      sensors: {
        ...prev.sensors,
        [id]: prev.sensors[id].map((sensor, sensorIndex) =>
          sensorIndex === index ? { ...sensor, [field]: value } : sensor,
        ),
      },
    }));
  };
  const handleSensorKeyDown = (e, currentId, currentIndex) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const allSensors = addForm.selectedPCB.flatMap((id) =>
      (addForm.sensors[id] || []).map((_, index) => ({ id, index })),
    );
    const position = allSensors.findIndex(
      ({ id, index }) => id === currentId && index === currentIndex,
    );
    const next = allSensors[position + 1];
    if (!next) return;

    setAddForm((prev) => {
      const currentSensor = prev.sensors[currentId]?.[currentIndex];
      if (!currentSensor || !prev.sensors[next.id]) return prev;
      return {
        ...prev,
        sensors: {
          ...prev.sensors,
          [next.id]: prev.sensors[next.id].map((sensor, sensorIndex) =>
            sensorIndex === next.index
              ? {
                  ...sensor,
                  partNo: currentSensor.partNo,
                  batchNo: currentSensor.batchNo,
                }
              : sensor,
          ),
        },
      };
    });

    setActiveBoardId(next.id);
    setTimeout(
      () =>
        document.getElementById(`serialNo-${next.id}-${next.index}`)?.focus(),
      0,
    );
  };
  const validate = () => {
    if (!addForm.startTime || !addForm.endTime) return "請填寫開始與結束時間";
    if (dayjs(addForm.endTime).isBefore(dayjs(addForm.startTime))) return "結束時間不可早於開始時間";
    if (!addForm.selectedPCB.length) return "請至少選擇一個電路板";
    if (!addForm.standardSensor) return "請點選星號，指定一組標準 Sensor";
    return "";
  };
  const handleResetAddForm = () => {
    setAddForm({ ...initialAddForm });
    setStatusMessage("");
    setValidationError("");
    setSubmissionStatus("idle");
    resetAddQaqc();
  };
  const handleAddSubmit = async () => {
    setStatusMessage("");
    const errorMessage = validate();
    setValidationError(errorMessage);
    try {
      const result = await addQaqc(buildPayload());
      setStatusMessage(result.message);
      setSubmissionStatus("success");
    } catch {
      setStatusMessage("");
      setSubmissionStatus("error");
    }
  };
  const handleEditSearch = async () => {
    setHasSearched(true);
    setSelectedRecordId(null);
    await fetchQaqcTestSerialsData({
      startTime: dayjs(editSearchForm.startTime).format("YYYY-MM-DD 00:00"),
      endTime: dayjs(editSearchForm.endTime).format("YYYY-MM-DD 23:59")
    });
  };
  const buildPayload = () => {
    const refSTID = addForm.standardSensor.ID;
    const refChs = addForm.standardSensor.sensorIndex + FIRST_INPUT_SENSOR_NO;
    return addForm.selectedPCB.map((STID) => {
      const pcb = PCBListList.find((item) => item.STID === STID);
      return {
        conConfig: addForm.description.trim(),
        QAID: pcb?.QAID || "",
        STID,
        PSERNO: addForm.sensors[STID].map(
          ({ partNo, batchNo, serialNo }) => `${partNo},${batchNo},${serialNo}`,
        ).join("|"),
        refSTID,
        refChs,
        startDateTime: dayjs(addForm.startTime).format("YYYY-MM-DD HH:mm"),
        endDateTime: dayjs(addForm.endTime).format("YYYY-MM-DD HH:mm"),
      };
    });
  };
  const handleViewRecord = async (SN) => {
    setStatusMessage("");
    setLoadingRecordId(SN);
    try {
      const result = await fetchQaqc(SN);
      const rows = result.data || [];
      if (!rows.length) return;
      const sensors = {};
      rows.forEach((row) => {
        row.dt_F = row.dt_F
          ? dayjs(row.dt_F).utc().format("YYYY-MM-DD HH:mm")
          : "";

        row.dt_T = row.dt_T
          ? dayjs(row.dt_T).utc().format("YYYY-MM-DD HH:mm")
          : "";

        const parsed = String(row.PSERNO || "")
          .split("|")
          .map((value) => {
            const [partNo = "", batchNo = "", serialNo = ""] = value.split(",");
            return { partNo, batchNo, serialNo };
          });

        sensors[row.STID] = Array.from(
          { length: Math.max(Number(row.numChs || 0) - FIXED_SENSOR_COUNT, 0) || parsed.length },
          (_, index) =>
            parsed[index] || {
              partNo: "",
              batchNo: "",
              serialNo: "",
            },
        );
      });
      setAddForm({
        description: rows[0].conConfig || "",
        startTime: dayjs(rows[0].dt_F).format("YYYY-MM-DDTHH:mm"),
        endTime: dayjs(rows[0].dt_T).format("YYYY-MM-DDTHH:mm"),
        selectedPCB: rows.map((row) => row.STID),
        sensors,
        standardSensor: {
          ID: rows[0].refSTID,
          sensorIndex: Math.max(Number(rows[0].refChs) - FIRST_INPUT_SENSOR_NO, 0),
        },
      });
      setSelectedRecordId(SN);
      setRecordMode("view");
    } catch {
      setSelectedRecordId(null);
    } finally {
      setLoadingRecordId(null);
    }
  };
  const handleToggleEdit = async () => {
    if (recordMode === "view") {
      setStatusMessage("");
      setRecordMode("edit");
      return;
    }
    await handleViewRecord(selectedRecordId);
  };
  const handleUpdateSubmit = async () => {
    const errorMessage = validate();
    setValidationError(errorMessage);
    if (errorMessage) return;
    try {
      const result = await updateQaqc({ SN: selectedRecordId, records: buildPayload() });
      setStatusMessage(result.message);
      setValidationError("");
      setRecordMode("view");
    } catch {
      setStatusMessage("");
    }
  };
  const handleCalculate = async () => {
    try {
      const result = await calculateQaqc(selectedRecordId);
      setStatusMessage(result.message);
    } catch {
      setStatusMessage("");
    }
  };
  const handleDelete = async () => {
    if (!window.confirm(`確定刪除 ${selectedRecordId}？刪除後無法復原`)) return;
    try {
      await deleteQaqc(selectedRecordId);
      setSelectedRecordId(null);
      setAddForm({ ...initialAddForm });
      resetQaqcRecord();
      await handleEditSearch();
    } catch {
      setStatusMessage("");
    }
  };
  const handleBackToRecords = () => {
    setSelectedRecordId(null);
    setRecordMode("view");
    setStatusMessage("");
    setValidationError("");
    resetQaqcRecord();
  };
  const isRecordView = mode === "edit" && recordMode === "view";

  return (
    <div className="space-y-8">

      <PageTitle description="依照畫面步驟新增資料，或搜尋既有紀錄進行檢視、修改與計算"/>
      <div className="rounded-2xl border border-border bg-card p-2 shadow-card">
        <BaseTab
          value={mode}
          onChange={(value) => {
            setMode(value);
            setStatusMessage("");
            setValidationError("");
            setSelectedRecordId(null);
            setRecordMode("view");
            setAddForm({ ...initialAddForm });
            resetQaqcRecord();
          }}
          items={[
            { label: "新增紀錄", value: "add" },
            { label: "修改紀錄", value: "edit" },
          ]}
        />
      </div>

      {!selectedRecordId && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <p className="type-body font-semibold text-foreground ">
            {mode === "add" ? "新增操作流程" : "修改操作流程"}
          </p>
          <div className={`mt-3 grid gap-3 ${mode === "add" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {(mode === "add"
              ? ["填寫作業說明與測試期間", "選擇本次使用的電路板", "輸入 Sensor 資料並送出"]
              : ["用日期範圍搜尋並選擇紀錄", "先檢視內容，需要變更時再按「開始編輯」"]
            ).map((text, index) => (
              <div key={text} className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 type-body shadow-sm ">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs xl:h-8 xl:w-8 2xl:h-9 2xl:w-9 xl:text-sm 2xl:text-base font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(mode === "add" || (mode === "edit" && selectedRecordId)) && (
        <div className="space-y-3">
          {mode === "edit" && (
            <div className="flex justify-end">
              <BaseButton variant="ghost" onClick={handleBackToRecords} disabled={processingRecord}>
                <Undo2/>返回搜尋結果
              </BaseButton>
            </div>
          )}
          <BaseCard
            title={mode === "add" ? "新增 QAQC 紀錄" : `測試序號: ${selectedRecordId}`}
            subtitle={mode === "edit" ? (
              <span className="flex items-center gap-2">
                <span className={`size-2 shrink-0 rounded-full ${recordMode === "edit" ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span>
                  {recordMode === "edit"
                    ? "編輯中｜可修改基本資料與 Sensor 資料"
                    : "檢視模式｜目前欄位為唯讀，若要變更內容請開始編輯"}
                </span>
              </span>
            ) : "建立新的測試紀錄並設定電路板與 Sensor 資料"}
            headerRight={mode === "edit" ? (
              <>
                <BaseButton variant="outline" onClick={handleToggleEdit} disabled={processingRecord}>
                  <Pencil className="h-4 w-4" />
                  {recordMode === "edit" ? "取消" : "編輯"}
                </BaseButton>
                <BaseButton onClick={handleCalculate} loading={processingRecord} disabled={recordMode === "edit"}>
                  <Calculator className="h-4 w-4" />
                  計算
                </BaseButton>
                <BaseButton variant="destructive" onClick={handleDelete} disabled={processingRecord || recordMode === "edit"}>
                  <Trash2 className="h-4 w-4" />
                  刪除
                </BaseButton>
              </>
            ) : null}
          >
            <div className="space-y-10">
              <section className="space-y-5 rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5">
                <StepHeading
                  number="1"
                  title={mode === "add" ? "填寫基本資料" : "基本資料"}
                  description={mode === "add" ? "填寫測試用途與資料有效期間" : "可在編輯模式調整作業說明與測試期間"}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <BaseInput
                      label="作業說明"
                      value={addForm.description}
                      disabled={isRecordView}
                      onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                      placeholder="輸入作業說明"
                    />
                  </div>
                  <BaseInput
                    label="開始日期"
                    type="datetime-local"
                    value={addForm.startTime}
                    disabled={isRecordView}
                    onChange={(e) => setAddForm({ ...addForm, startTime: e.target.value })}
                    max={addForm.endTime}
                  />
                  <BaseInput
                    label="結束日期"
                    type="datetime-local"
                    value={addForm.endTime}
                    disabled={isRecordView}
                    min={addForm.startTime}
                    onChange={(e) => setAddForm({ ...addForm, endTime: e.target.value })}
                  />
                </div>
              </section>

              {mode === "add" && (
              <section className="space-y-5 rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5">
                <StepHeading
                  number="2"
                  title="選擇電路板"
                  description="可複選；系統會依通道數自動建立 Sensor 欄位"
                />
                <BaseApiLoaderWrapper isLoading={loading} isError={error}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {PCBListList.map((board) => {
                      const checked = addForm.selectedPCB.includes(board.STID);
                      return (
                        <label
                          key={board.STID}
                          className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${mode === "edit" ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${checked ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                        >
                          <input
                            type="checkbox"
                            disabled={mode === "edit"}
                            checked={checked}
                            onChange={(e) =>
                              setAddForm((prev) => ({
                                ...prev,
                                selectedPCB: e.target.checked
                                  ? [...prev.selectedPCB, board.STID]
                                  : prev.selectedPCB.filter(
                                      (id) => id !== board.STID,
                                    ),
                              }))
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block truncate type-body font-semibold ">
                              {board.label}
                            </span>
                            <span className="type-meta text-muted-foreground ">
                              {Number(board.numChs || 0)} 個 Sensor · 前 {FIXED_SENSOR_COUNT} 個固定
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </BaseApiLoaderWrapper>
              </section>
              )}

              <section className="space-y-5 rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5">
                <StepHeading
                  number={mode === "add" ? "3" : "2"}
                  title={mode === "add" ? "填寫 Sensor 資料" : "Sensor 資料"}
                  description={isRecordView
                    ? "Sensor 1、2 為固定 Sensor；Sensor 3 起為測試 Sensor，星號為標準 Sensor"
                    : "Sensor 1、2 固定顯示且不需輸入；Sensor 3 起可填寫資料並指定標準 Sensor"}
                />
                {addForm.selectedPCB.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {addForm.selectedPCB.map((id) => {

                      const board = PCBListList.find((item) => item.STID === id);
                      const isActive = activeBoardId === id;
                      const hasStandard = addForm.standardSensor?.ID === id;
                      
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveBoardId(id)}
                          aria-pressed={isActive}
                          className={`flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left transition-colors ${isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white hover:border-primary/40"}`}
                        >
                          <span>
                            <span className="block truncate type-body font-medium ">
                              {board?.label || id}
                            </span>
                          </span>
                          {hasStandard && (
                            <Star
                              className={`h-3 w-3 shrink-0 ${isActive ? "fill-white text-white" : "fill-amber-400 text-amber-500"}`}
                              aria-label="含標準 Sensor"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!addForm.selectedPCB.length ? (
                  <div className="rounded-xl border border-dashed border-border bg-card px-5 py-10 text-center">
                    <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/60" />
                    <p className="mt-3 type-body font-medium ">
                      請先在上方選擇電路板
                    </p>
                    <p className="mt-1 type-body text-muted-foreground ">
                      選擇後會自動顯示需要填寫的 Sensor
                    </p>
                  </div>
                ) : (
                  [activeBoardId].filter(Boolean).map((id) => {
                    const board = PCBListList.find((item) => item.STID === id);
                    const sensors = addForm.sensors[id] || [];
                    return (
                      <div
                        key={id}
                        className="overflow-hidden rounded-2xl border border-border bg-card"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
                          <div>
                            <h4 className="font-semibold">
                              {board?.label || id}
                            </h4>
                            <p className="type-meta text-muted-foreground ">
                              {
                                sensors.filter(
                                  (s) => s.partNo && s.batchNo && s.serialNo,
                                ).length
                              }{" "}
                              / {sensors.length} 組已完成
                            </p>
                          </div>
                        </div>
                        <div className="grid gap-4 p-4 lg:grid-cols-3">
                          {Array.from(
                            { length: Math.min(FIXED_SENSOR_COUNT, Number(board?.numChs || 0)) },
                            (_, fixedIndex) => {
                              const sensorNo = fixedIndex + 1;

                              return (
                                <div
                                  key={`fixed-${sensorNo}`}
                                  className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/35 p-4"
                                >
                                  <div className="flex min-h-10 items-center justify-between gap-2">
                                    <div>
                                      <p className="type-body font-semibold text-foreground">
                                        Sensor #{sensorNo}
                                      </p>
                                      <p className="mt-1 type-meta text-muted-foreground">
                                        固定 Sensor，不需輸入資料
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 type-meta font-medium text-muted-foreground">
                                      固定
                                    </span>
                                  </div>
                                </div>
                              );
                            },
                          )}

                          {sensors.map((sensor, index) => {
                            const sensorNo = index + FIRST_INPUT_SENSOR_NO;
                            const isStandard =
                              addForm.standardSensor?.ID === id &&
                              addForm.standardSensor?.sensorIndex === index;

                            return (
                              <div
                                key={sensorNo}
                                className={`rounded-xl border p-4 ${isStandard ? "border-amber-400 bg-amber-50/70 dark:bg-amber-950/20" : "border-border"}`}
                              >
                                <div className="mb-4 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    disabled={isRecordView}
                                    onClick={() =>
                                      setAddForm((prev) => ({
                                        ...prev,
                                        standardSensor: isStandard
                                          ? null
                                          : { ID: id, sensorIndex: index },
                                      }))
                                    }
                                    className="flex min-h-10 items-center gap-2 rounded-lg px-2 type-body font-semibold hover:bg-muted "
                                    aria-pressed={isStandard}
                                    title="設為標準 Sensor"
                                  >
                                    <Star
                                      className={`h-5 w-5 ${isStandard ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`}
                                    />{" "}
                                    Sensor #{sensorNo}
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  <BaseInput
                                    label="品號"
                                    disabled={isRecordView}
                                    value={sensor.partNo}
                                    onChange={(e) =>
                                      handleSensorChange(
                                        id,
                                        index,
                                        "partNo",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="輸入品號"
                                  />
                                  <BaseInput
                                    label="批號"
                                    disabled={isRecordView}
                                    value={sensor.batchNo}
                                    onChange={(e) =>
                                      handleSensorChange(
                                        id,
                                        index,
                                        "batchNo",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="輸入批號"
                                  />
                                  <BaseInput
                                    id={`serialNo-${id}-${index}`}
                                    label="元件序號"
                                    disabled={isRecordView}
                                    value={sensor.serialNo}
                                    onChange={(e) =>
                                      handleSensorChange(
                                        id,
                                        index,
                                        "serialNo",
                                        e.target.value,
                                      )
                                    }
                                    onKeyDown={(e) =>
                                      handleSensorKeyDown(e, id, index)
                                    }
                                    placeholder="輸入或掃描元件序號"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
              {statusMessage && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 type-body text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  {statusMessage}
                </p>
              )}
              {validationError && (
                <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 type-body text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {validationError}
                </p>
              )}
              {addQaqcError && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 type-body text-destructive "
                >
                  {addQaqcError}
                </p>
              )}
              {recordError && mode === "edit" && (
                <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 type-body text-destructive ">
                  {recordError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                {mode === "add" && submissionStatus === "idle" && (
                  <>
                    <BaseButton variant="outline" disabled={addingQaqc} onClick={handleResetAddForm}>
                      清除
                    </BaseButton>
                    <BaseButton loading={addingQaqc} onClick={handleAddSubmit}>
                      新增
                    </BaseButton>
                  </>
                )}
                {mode === "add" && submissionStatus === "success" && (
                  <BaseButton onClick={handleResetAddForm}>
                    再新增一筆
                  </BaseButton>
                )}
                {mode === "add" && submissionStatus === "error" && (
                  <>
                    <BaseButton variant="outline" disabled={addingQaqc} onClick={handleResetAddForm}>
                      重新新增
                    </BaseButton>
                    <BaseButton loading={addingQaqc} onClick={handleAddSubmit}>
                      再次新增
                    </BaseButton>
                  </>
                )}
                {mode === "edit" && recordMode === "edit" && (
                    <BaseButton loading={processingRecord} onClick={handleUpdateSubmit}>
                    儲存所有修改
                  </BaseButton>
                )}
              </div>
            </div>
          </BaseCard>
        </div>
      )}

      {mode === "edit" && !selectedRecordId && (
        <BaseCard
          title="尋找 QAQC 紀錄"
          subtitle="輸入大約的建立日期即可搜尋；找到後先檢視內容，再決定是否編輯、計算或刪除"
        >
          <div className="space-y-6">
            <section className="space-y-5 rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5">
              <StepHeading
                number="1"
                title="設定搜尋日期"
                description="不知道確切日期時，可先使用預設的最近一個月"
              />
              <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]">
                <BaseInput
                  label="開始日期"
                  type="date"
                  value={editSearchForm.startTime}
                  onChange={(e) =>
                    setEditSearchForm({
                      ...editSearchForm,
                      startTime: e.target.value,
                    })
                  }
                />
                <BaseInput
                  label="結束日期"
                  type="date"
                  min={editSearchForm.startTime}
                  value={editSearchForm.endTime}
                  onChange={(e) =>
                    setEditSearchForm({
                      ...editSearchForm,
                      endTime: e.target.value,
                    })
                  }
                />
                <BaseButton
                  onClick={handleEditSearch}
                  loading={searchingEditData}
                  className="w-full md:w-auto"
                >
                  <Search className="h-4 w-4" />
                  搜尋紀錄
                </BaseButton>
              </div>
            </section>
            {hasSearched && (
              <section className="space-y-4">
                {editSearchError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 type-body text-destructive "
                  >
                    {editSearchError}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <StepHeading number="2" title="選擇要檢視的紀錄" description="點擊整列或右側按鈕皆可開啟" />
                  <span className="type-body text-muted-foreground ">
                    共 {editData.length} 筆
                  </span>
                </div>
                {editData.length ? (
                  <div className="space-y-2">
                    {editData.map((record) => {
                      const recordId = record.id || record.value;
                      const isSelected = selectedRecordId === recordId;

                      return (
                        <div
                          key={recordId}
                          className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleViewRecord(recordId)}
                            className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                          >
                            <span>
                              <span className="block font-semibold">
                                {record.SN || record.description || record.label}
                              </span>
                              {record.conConfig && (
                                <span className="mt-1 block type-body text-muted-foreground ">
                                  {record.conConfig}
                                </span>
                              )}
                              {record.sensors && (
                                <span className="mt-1 block type-body text-muted-foreground ">
                                  {record.startTime} ～ {record.endTime} ·{" "}
                                  {record.sensors.length} 組 Sensor
                                </span>
                              )}
                            </span>
                            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                          </button>
                          <div className="flex shrink-0 gap-2 sm:border-l sm:pl-4">
                            <BaseButton
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewRecord(recordId)}
                              loading={processingRecord && loadingRecordId === recordId}
                            >
                              <Eye className="h-4 w-4" />
                              檢視
                            </BaseButton>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed p-8 text-center type-body text-muted-foreground ">
                    此日期範圍內沒有紀錄
                  </p>
                )}
              </section>
            )}
          </div>
        </BaseCard>
      )}
    </div>
  );
}
