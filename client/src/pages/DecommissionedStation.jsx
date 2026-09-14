import { useState, useMemo, useEffect } from "react";
import dayjs from "dayjs";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import BaseStatus from "@/components/common/status/BaseStatus";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import { AlertTriangle, CirclePlus, Trash2, Pencil} from 'lucide-react';
import {
  useProjectsList,
  useAddDecommissionedStation,
  useDeleteDecommissionedStation,
  useEditDecommissionedStation,
  useDecommissionedData,
  useStationList,
  useStationDisconnectedData,
} from "@/hook/useDecommissionedStation";


const statusOptions = [
  { value: "all", label: "所有" },
  { value: "online", label: "上架" },
  { value: "offline", label: "下架" },
];

const toSelectOptions = (items) => items.map((item) => ({ value: item, label: item }));

const disconnectReasonOptions = toSelectOptions([
  "設備損壞",
  "設備維修汰換",
  "設備遷址",
  "設備遺失",
  "開關箱頻繁跳電",
  "道路施工",
  "颱風",
  "燈桿未供電",
  "燈桿被移除",
  "燈桿線路異常",
  "其他",
]);

const offlineReasonOptions = toSelectOptions([
  "設備_設備損害",
  "設備_設備遷址",
  "缺電_高壓電突波",
  "缺電_台電斷電",
  "缺電_道路施工",
  "缺電_短路斷線",
  "缺電_燈桿線路異常",
  "缺電_漏電斷路器跳掉",
  "缺電_交通事件",
  "網路_網路訊號不良",
  "其他_蟲害",
  "其他_沿海地區",
  "其他_天災(颱風、淹水、地震、雷擊)",
  "其他_人為破壞",
  "設備抽檢_第三方查驗",
  "設備_設備維修汰換",
]);

const initialFilters = {
  project: "",
  station: "",
  status: ["offline"],
  startTime: dayjs().subtract(6, "month").startOf("month").format("YYYY-MM-DD"),
  endTime: dayjs().endOf("day").format("YYYY-MM-DD"),
};

const initialDecommissionForm = {
  disconnectTime: "",
  onlineTime: "",
  disconnectReason: "",
  otherDisconnectReason: "",
  decommissionReason: "",
  engineer: "",
  filler: "",
};

const initialAddFormSelection = {
  project: "",
  station: "",
};

export default function DecommissionedStationPage() {

  const [form, setForm] = useState(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addFormStep, setAddFormStep] = useState(1); // 1: 選擇測站, 2: 填寫資料
  const [addForm, setAddForm] = useState(initialAddFormSelection);
  const [decommissionForm, setDecommissionForm] = useState(initialDecommissionForm);
  const [hasLoadedDisconnectedInfo, setHasLoadedDisconnectedInfo] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [editForm, setEditForm] = useState(initialDecommissionForm);
  const [deletingRow, setDeletingRow] = useState(null);

  const {
    data: searchProjectsListData,
    loading: loadingSearchProjectsList,
    fetchProjectsList: fetchSearchProjectsList,
  } = useProjectsList();

  const {
    data: searchStationListData,
    loading: loadingSearchStationList,
    fetchStationList: fetchSearchStationList,
  } = useStationList();

  const {
    data: addProjectsListData,
    loading: loadingAddProjectsList,
    fetchProjectsList: fetchAddProjectsList,
  } = useProjectsList();

  const {
    data: addStationListData,
    loading: loadingAddStationList,
    fetchStationList: fetchAddStationList,
  } = useStationList();

  const {
    data: decommissionedData,
    loading: loadingDecommissionedData,
    error: errorDecommissionedData,
    fetchDecommissionedData,
  } = useDecommissionedData();

  const {
    data: stationDisconnectedData,
    loading: loadingDisconnectedInfo,
    error: disconnectedInfoError,
    fetchStationDisconnectedData,
  } = useStationDisconnectedData();

  const {
    loading: addingDecommissionedStation,
    submitDecommissionedStation,
  } = useAddDecommissionedStation();

  const {
    loading: editingDecommissionedStation,
    submitEditDecommissionedStation,
  } = useEditDecommissionedStation();

  const {
    loading: deletingDecommissionedStation,
    submitDeleteDecommissionedStation,
  } = useDeleteDecommissionedStation();

  const disconnectedInfo = stationDisconnectedData[0] || null;
  const selectedProject = addProjectsListData.find(
    (item) => item.value === addForm.project
  );
  const selectedStation = addStationListData.find(
    (item) => item.value === addForm.station
  );
  

  const validate = () => {
    if (!form.status[0]) {
      return "請確認已填寫：狀態";
    }
    return null;
  };

  const validateAddSelection = () => {
    if (!addForm.project || !addForm.station) {
      return "請確認已填寫：專案、測站";
    }
    return null;
  };

  const validateAddForm = () => {
    if (
      !decommissionForm.disconnectTime || 
      !decommissionForm.disconnectReason || 
      !decommissionForm.decommissionReason || 
      !decommissionForm.engineer ||
      (decommissionForm.disconnectReason === "其他" && !decommissionForm.otherDisconnectReason.trim()) 
    ) {
      return "請確認已填寫：斷線時間、斷線原因、下架原因、工程師";
    }
    return null;
  };

  const handleSearch = async () => {
    const err = validate();

    if (err) {
      alert(err);
      return;
    }

    await fetchDecommissionedData({
      project: form.project || null,
      station: form.station || null,
      endTime: form.endTime || null,
      startTime: form.startTime || null,
      status: form.status[0],
    });
  };

  const handleReset = () => {
    setForm(initialFilters);
  };

  const handleModalOpenChange = (open) => {
    setIsModalOpen(open);
    
    if (!open) {
      setTimeout(() => {
        setAddFormStep(1);
        setAddForm(initialAddFormSelection);
        setDecommissionForm(initialDecommissionForm);
        setHasLoadedDisconnectedInfo(false);
      }, 300);
    }
  };

  const handleDecommissionFormChange = (key, value) => {
    setDecommissionForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === "disconnectReason" && value !== "其他") {
        next.otherDisconnectReason = "";
      }

      return next;
    });
  };

  const handleAddProjectChange = (value) => {
    setAddForm({ project: value, station: "" });
    setAddFormStep(1);
    setDecommissionForm((prev) => ({ ...prev, disconnectTime: "" }));
    setHasLoadedDisconnectedInfo(false);
  };

  const handleAddStationChange = (value) => {
    setAddForm((prev) => ({ ...prev, station: value }));
    setAddFormStep(1);
    setDecommissionForm((prev) => ({ ...prev, disconnectTime: "" }));
    setHasLoadedDisconnectedInfo(false);
  };

  const handleAddSubmit = async () => {
    const err = validateAddForm();

    if (err) {
      alert(err);
      return;
    }

    const [typeOffLine = "", ...reasonParts] = (decommissionForm.decommissionReason || "").split("_");
    const cleanDecommissionReason = reasonParts.join("_");
    const restDecommissionForm = { ...decommissionForm };
    delete restDecommissionForm.otherDisconnectReason;

    const payload = {
      datOffLine: restDecommissionForm.disconnectTime
        ? dayjs(restDecommissionForm.disconnectTime).format("YYYY-MM-DD HH:mm")
        : null,
      datOnLine: restDecommissionForm.onlineTime
        ? dayjs(restDecommissionForm.onlineTime).format("YYYY-MM-DD HH:mm")
        : null,
      ProjID: addForm.project,
      STID: addForm.station,
      logType: (restDecommissionForm.disconnectTime && restDecommissionForm.onlineTime) ? 1 : 0,
      STAgencyEID: restDecommissionForm.engineer,
      EID: restDecommissionForm.filler || null,
      typeOffLine,
      noteOffLine: decommissionForm.disconnectReason === "其他" ? decommissionForm.otherDisconnectReason.trim() : decommissionForm.disconnectReason,
      noteDiabled: cleanDecommissionReason,
    };

    try {
      const result = await submitDecommissionedStation(payload);
      handleModalOpenChange(false);
      await handleSearch();

      if (result?.message) {
        alert(result.message);
      }
    } catch (error) {
      alert(error?.response?.data?.message || error?.message || "新增失敗");
    }
  };

  const handleAddDialogConfirm = () => {
    if (addFormStep === 1) {
      const err = validateAddSelection();

      if (err) {
        alert(err);
        return;
      }

      setAddFormStep(2);
      return;
    }

    handleAddSubmit();
  };

  const handleAddDialogCancel = () => {
    if (addFormStep === 2) {
      setAddFormStep(1);
      setHasLoadedDisconnectedInfo(false);
      return;
    }

    handleModalOpenChange(false);
  };

  const handleEditOpen = (row) => {
    const isPresetDisconnectReason = disconnectReasonOptions.some(
      (option) => option.value === row.noteOffLine
    );

    setEditingRow(row);
    setEditForm({
      disconnectTime: row.datOffLine? dayjs(row.datOffLine).format("YYYY-MM-DDTHH:mm") : "",
      onlineTime: row.datOnLine ? dayjs(row.datOnLine).format("YYYY-MM-DDTHH:mm") : "",
      disconnectReason: isPresetDisconnectReason ? row.noteOffLine : "其他",
      otherDisconnectReason: isPresetDisconnectReason ? "" : (row.noteOffLine || ""),
      decommissionReason: [row.typeOffLine, row.noteDiabled].filter(Boolean).join("_"),
      engineer: row.STAgencyEID || "",
      filler: row.EID || "",
    });
  };

  const handleEditOpenChange = (open) => {
    if (!open) {
      setEditingRow(null);
      setEditForm(initialDecommissionForm);
    }
  };

  const handleEditFormChange = (key, value) => {
    setEditForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "disconnectReason" && value !== "其他"
        ? { otherDisconnectReason: "" }
        : {}),
    }));
  };

  const handleEditSubmit = async () => {
    const isInvalid =
      !editForm.disconnectTime ||
      !editForm.disconnectReason ||
      !editForm.decommissionReason ||
      !editForm.engineer ||
      (editForm.disconnectReason === "其他" && !editForm.otherDisconnectReason.trim());

    if (isInvalid) {
      alert("請確認已填寫：斷線時間、斷線原因、下架原因、工程師");
      return;
    }

    const [typeOffLine = "", ...reasonParts] = editForm.decommissionReason.split("_");
    const payload = {
      OLID: editingRow.OLID,
      datOnLine: editForm.onlineTime? dayjs(editForm.onlineTime).format("YYYY-MM-DD HH:mm") : null,
      STAgencyEID: editForm.engineer,
      EID: editForm.filler || null,
      logType: editForm.onlineTime ? 1 : 0,
      typeOffLine,
      noteOffLine: editForm.disconnectReason === "其他"
        ? editForm.otherDisconnectReason.trim()
        : editForm.disconnectReason,
      noteDiabled: reasonParts.join("_"),
    };

    try {
      const result = await submitEditDecommissionedStation(payload);
      handleEditOpenChange(false);
      await handleSearch();

      if (result?.message) {
        alert(result.message);
      }
    } catch (error) {
      alert(error?.response?.data?.message || error?.message || "編輯失敗");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingRow?.OLID) {
      alert("缺少下架紀錄識別碼，無法刪除");
      return;
    }

    try {
      const result = await submitDeleteDecommissionedStation(deletingRow.OLID);
      setDeletingRow(null);
      await handleSearch();

      if (result?.message) {
        alert(result.message);
      }
    } catch (error) {
      alert(error?.response?.data?.message || error?.message || "刪除失敗");
    }
  };

  useEffect(() => {
    fetchSearchProjectsList();
    fetchAddProjectsList();
    fetchDecommissionedData({
      project: form.project || null,
      station: form.station || null,
      endTime: form.endTime || null,
      startTime: form.startTime || null,
      status: form.status[0],
    });
  }, []);

  useEffect(() => {
    if (!form.project) return;

    fetchSearchStationList({ project: form.project });
    setForm((prev) => ({ ...prev, station: "" }));

  }, [form.project]);

  useEffect(() => {
    if (!addForm.project) return;

    fetchAddStationList({ project: addForm.project });
    setAddForm((prev) => ({ ...prev, station: "" }));
    setDecommissionForm((prev) => ({ ...prev, disconnectTime: "" }));

  }, [addForm.project]);

  useEffect(() => {
    if (addFormStep !== 2 || !addForm.project || !addForm.station) {
      setDecommissionForm((prev) => ({ ...prev, disconnectTime: "" }));
      setHasLoadedDisconnectedInfo(false);
      return;
    }

    let active = true;

    const fetchData = async () => {
      setHasLoadedDisconnectedInfo(false);
      await fetchStationDisconnectedData({
        project: addForm.project,
        station: addForm.station,
      });

      if (active) {
        setHasLoadedDisconnectedInfo(true);
      }
    };

    fetchData();

    return () => {
      active = false;
    };
  }, [addFormStep, addForm.project, addForm.station]);

  useEffect(() => {
    if (!hasLoadedDisconnectedInfo) {
      setDecommissionForm((prev) => ({ ...prev, disconnectTime: "" }));
      return;
    }

    setDecommissionForm((prev) => ({
      ...prev,
      disconnectTime: disconnectedInfo?.LastUpdateTime
        ? dayjs(disconnectedInfo.LastUpdateTime).format("YYYY-MM-DDTHH:mm")
        : "",
    }));
  }, [disconnectedInfo, hasLoadedDisconnectedInfo]);


  const columns = useMemo(
    () => [
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <BaseButton
              aria-label={`刪除 ${row.original.STID || "測站"}`}
              variant="table-action-destructive"
              size="table-icon"
              onClick={() => setDeletingRow(row.original)}
            >
              <Trash2 className="h-4 w-4"/>
            </BaseButton>
            <BaseButton
              aria-label={`編輯 ${row.original.STID || "測站"}`}
              variant="table-action"
              size="table-icon"
              onClick={() => handleEditOpen(row.original)}
            >
              <Pencil className="h-4 w-4"/>
            </BaseButton>
          </div>
        ),
      },
      { accessorKey: "DeviceID", header: "裝置編號" },
      { accessorKey: "STID", header: "編號" },
      { accessorKey: "IIT", header: "裝置名稱" },
      { accessorKey: "datOffLine", header: "斷線時間" },
      { accessorKey: "noteOffLine", header: "斷線原因" },
      { accessorKey: "STAgencyEID", header: "工程師" },
      { accessorKey: "datOnLine", header: "上線時間" },
      {
        accessorKey: "status",
        header: "狀態",
        cell: ({ getValue }) => {
          
          const status = getValue();
          const isOnline = status === "上架";
          
          return (
            <BaseStatus tag={isOnline ? "green" : "red"} text={status}/>
          );
        },
      },
      { accessorKey: "EID", header: "填寫人" },
    ],
    []
  );

  const isOtherDisconnectReasonInvalid =
    decommissionForm.disconnectReason === "其他" &&
    !decommissionForm.otherDisconnectReason.trim();

  return (
    <div className="space-y-8">

      <PageTitle
        description="管理與追蹤已下架或待下架的測站"
        actions={
          <BaseButton onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
            <CirclePlus className="mr-1 h-5 w-5"/>新增下架測站
          </BaseButton>
        }
      />

      <BaseCard title="查詢條件" subtitle="依專案、測站、狀態與日期範圍篩選下架紀錄">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
          <BaseSelect
            label="專案"
            value={form.project}
            onChange={(val) => setForm({ ...form, project: val })}
            options={searchProjectsListData}
            placeholder="請選擇專案"
            disabled={loadingSearchProjectsList}
          />

          <BaseSelect
            label="測站"
            value={form.station}
            onChange={(val) => setForm({ ...form, station: val })}
            options={searchStationListData}
            placeholder={!form.project ? "請先選擇專案" : "請選擇測站"}
            disabled={!form.project || loadingSearchStationList}
          />

          <div>
            <label className="mb-2 block type-body font-semibold text-foreground ">狀態</label>
            <BaseCheckbox
              value={form.status}
              onChange={(val) => setForm({ ...form, status: val })}
              items={statusOptions}
              multiple={false}
            />
          </div>

          <BaseInput
            label="起始時間"
            type="date"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            max={form.endTime}
          />

          <BaseInput
            label="結束時間"
            type="date"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            min={form.startTime}
            max={dayjs().endOf("day").format("YYYY-MM-DD")}
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <BaseButton 
            variant="outline" 
            onClick={handleReset}
            className="w-full sm:w-auto"
          >
            重置
          </BaseButton>
          <BaseButton 
            onClick={handleSearch}
            className="w-full sm:w-auto"
          >
            查詢
          </BaseButton>
        </div>
      </BaseCard>

      
      <BaseCard 
        title="下架測站列表" 
        subtitle={`共 ${decommissionedData.length} 筆資料`}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCSVButton data={decommissionedData} columns={columns} filename="下架測站列表"/>
            <ExportExcelButton data={decommissionedData} columns={columns} filename="下架測站列表"/>
            <ExportPDFButton data={decommissionedData} columns={columns} filename="下架測站列表"/>
          </div>
        }
      >
        <BaseApiLoaderWrapper
          isLoading={loadingDecommissionedData}
          isError={errorDecommissionedData}
        >
          <BaseTable data={decommissionedData} columns={columns}/>
        </BaseApiLoaderWrapper>
      </BaseCard>

      
      <BaseDialog
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        title="新增下架測站"
        description="請先選擇專案與測站以載入基本資料，再填寫下架資訊。"
        onConfirm={handleAddDialogConfirm}
        onCancel={handleAddDialogCancel}
        confirmText={addFormStep === 1 ? "下一步" : "新增"}
        cancelText={addFormStep === 1 ? "取消" : "上一步"}
        loading={addFormStep === 2 && (loadingDisconnectedInfo || addingDecommissionedStation)}
      >
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-secondary p-3 type-body ">
          <span className="grid size-7 place-items-center rounded-full bg-primary font-bold text-primary-foreground">1</span>
          <span className={addFormStep === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>選擇測站</span>
          <span className="h-px flex-1 bg-border" />
          <span className={`grid size-7 place-items-center rounded-full font-bold ${addFormStep === 2 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>2</span>
          <span className={addFormStep === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>填寫下架資訊</span>
        </div>
        {addFormStep === 1 && (
        <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2">
          <BaseSelect
            label="專案"
            placeholder="請選擇專案"
            options={addProjectsListData}
            value={addForm.project}
            onChange={handleAddProjectChange}
            disabled={loadingAddProjectsList}
          />
          <BaseSelect
            label="測站"
            placeholder={!addForm.project ? "請先選擇專案" : "請選擇測站"}
            options={addStationListData}
            value={addForm.station}
            onChange={handleAddStationChange}
            disabled={!addForm.project || loadingAddProjectsList || loadingAddStationList}
          />
        </div>
        )}

        {addFormStep === 2 && (
          <BaseApiLoaderWrapper
            isLoading={loadingDisconnectedInfo}
            isError={disconnectedInfoError}
            className="mt-4 min-h-48"
          >
            <div className="space-y-6">

              <BaseCard title="下架資訊">
                <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3">
                  <div className="flex flex-col gap-2 type-body sm:flex-row sm:items-center sm:gap-6 ">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="shrink-0 text-muted-foreground">專案</div>
                      <div
                        className="truncate font-semibold text-foreground"
                        title={selectedProject?.label}
                      >
                        {selectedProject?.label || addForm.project}
                      </div>
                    </div>
                    <span className="hidden h-4 w-px bg-sky-200 sm:block" aria-hidden="true" />
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="shrink-0 text-muted-foreground">測站</div>
                      <div
                        className="truncate font-semibold text-foreground"
                        title={selectedStation?.label}
                      >
                        {selectedStation?.label || addForm.station}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <BaseInput
                      label="斷線時間"
                      type="datetime-local"
                      value={decommissionForm.disconnectTime}
                      onChange={(e) => handleDecommissionFormChange("disconnectTime", e.target.value)}
                      readOnly={Boolean(disconnectedInfo)}
                      required={!disconnectedInfo}
                    />
                    {disconnectedInfo && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-1 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 type-meta duration-200 ">
                        <p className="font-medium text-amber-900">
                          目前已斷線：{disconnectedInfo.DisconnDurationText}
                        </p>
                      </div>
                    )}
                  </div>
                  <BaseInput
                    label="上線時間"
                    type="datetime-local"
                    value={decommissionForm.onlineTime}
                    onChange={(e) => handleDecommissionFormChange("onlineTime", e.target.value)}
                  />
                  <div className="space-y-3">
                    <BaseSelect
                      label="斷線原因"
                      placeholder="請選擇斷線原因"
                      options={disconnectReasonOptions}
                      value={decommissionForm.disconnectReason}
                      onChange={(val) => handleDecommissionFormChange("disconnectReason", val)}
                    />
                    {decommissionForm.disconnectReason === "其他" && (
                      <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <BaseInput
                          label="其他原因"
                          value={decommissionForm.otherDisconnectReason}
                          onChange={(e) => handleDecommissionFormChange("otherDisconnectReason", e.target.value)}
                          placeholder="請輸入其他原因"
                          error={isOtherDisconnectReasonInvalid ? "其他原因為必填" : ""}
                          required
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <BaseSelect
                      label="下架原因"
                      placeholder="請選擇下架原因"
                      options={offlineReasonOptions}
                      value={decommissionForm.decommissionReason}
                      onChange={(val) => handleDecommissionFormChange("decommissionReason", val)}
                    />
                  </div>
                  <BaseInput
                    label="工程師"
                    placeholder="請輸入負責工程師"
                    value={decommissionForm.engineer}
                    onChange={(e) => handleDecommissionFormChange("engineer", e.target.value)}
                  />
                  <BaseInput
                    label="填寫人"
                    placeholder="請輸入填寫人"
                    value={decommissionForm.filler}
                    onChange={(e) => handleDecommissionFormChange("filler", e.target.value)}
                  />
                </div>
              </BaseCard>
            </div>
          </BaseApiLoaderWrapper>
        )}
      </BaseDialog>

      <BaseDialog
        open={Boolean(editingRow)}
        onOpenChange={handleEditOpenChange}
        title="編輯下架測站"
        description="修改下架測站資料後儲存。"
        onConfirm={handleEditSubmit}
        onCancel={() => handleEditOpenChange(false)}
        confirmText="修改"
        cancelText="取消"
        loading={editingDecommissionedStation}
      >
        {editingRow && (
          <div className="space-y-5">
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3">
              <div className="flex flex-col gap-2 type-body sm:flex-row sm:gap-6 ">
                <div className="flex gap-2">
                  <div className="text-muted-foreground">測站</div>
                  <div className="font-semibold">({editingRow.STID}) {editingRow.IIT || "-"}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <BaseInput
                label="斷線時間 (不可修改)"
                type="datetime-local"
                value={editForm.disconnectTime}
                readOnly
                className="bg-secondary"
              />
              <BaseInput
                label="上線時間"
                type="datetime-local"
                value={editForm.onlineTime}
                onChange={(e) => handleEditFormChange("onlineTime", e.target.value)}
              />
              <div className="space-y-3">
                <BaseSelect
                  label="斷線原因"
                  options={disconnectReasonOptions}
                  value={editForm.disconnectReason}
                  onChange={(value) => handleEditFormChange("disconnectReason", value)}
                />
                {editForm.disconnectReason === "其他" && (
                  <BaseInput
                    label="其他原因"
                    value={editForm.otherDisconnectReason}
                    onChange={(e) => handleEditFormChange("otherDisconnectReason", e.target.value)}
                    required
                  />
                )}
              </div>
              <BaseSelect
                label="下架原因"
                options={offlineReasonOptions}
                value={editForm.decommissionReason}
                onChange={(value) => handleEditFormChange("decommissionReason", value)}
              />
              <BaseInput
                label="工程師"
                value={editForm.engineer}
                onChange={(e) => handleEditFormChange("engineer", e.target.value)}
                required
              />
              <BaseInput
                label="填表人員"
                value={editForm.filler}
                onChange={(e) => handleEditFormChange("filler", e.target.value)}
              />
            </div>
          </div>
        )}
      </BaseDialog>

      <BaseDialog
        open={Boolean(deletingRow)}
        onOpenChange={(open) => {
          if (!open) setDeletingRow(null);
        }}
        title="刪除紀錄"
        description="此操作無法復原。"
        onConfirm={handleDeleteSubmit}
        onCancel={() => setDeletingRow(null)}
        confirmText="刪除"
        confirmVariant="destructive"
        cancelText="取消"
        loading={deletingDecommissionedStation}
        className="sm:max-w-xl"
      >
        {deletingRow && (
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-linear-to-br from-red-50 to-orange-50 p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-600 shadow-sm ring-4 ring-white">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="font-semibold text-red-950">確定要刪除嗎？</p>
                <p className="mt-1 type-body leading-relaxed text-red-700 ">
                  刪除後將無法復原
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-3">
                <Trash2 className="size-4 text-muted-foreground" aria-hidden="true" />
                <p className="type-body font-semibold text-foreground ">紀錄資訊</p>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border type-body sm:grid-cols-2 sm:divide-x sm:divide-y-0 ">
                <div className="px-4 py-3">
                  <div className="type-meta font-medium text-muted-foreground ">測站</div>
                  <div className="mt-1 truncate font-semibold text-foreground">
                    ({deletingRow.STID}) {deletingRow.IIT}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="type-meta font-medium text-muted-foreground ">斷線時間</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {deletingRow.datOffLine}
                  </div>
                  <p className="mt-0.5 truncate type-meta text-muted-foreground ">
                    編號: {deletingRow.OLID}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </BaseDialog>
    </div>
  );
}
