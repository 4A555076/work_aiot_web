import { useState, useEffect } from "react";
import dayjs from "dayjs";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseTable from "@/components/common/table/BaseTable";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTab from "@/components/common/tab/BaseTab";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";
import BaseStatus from "@/components/common/status/BaseStatus";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import { useProjectsList, useThresholdOverData, useDisconnectedData } from "@/hook/useAlarmOverview";


export default function AlarmOverviewPage() {

  const [form, setForm] = useState({ project: "" });
  const [lastUpdatedThreshold, setLastUpdatedThreshold] = useState("");
  const [lastUpdatedDisconnected, setLastUpdatedDisconnected] = useState("");
  const [tab, setTab] = useState("All");
  const [filters, setFilters] = useState(["一致性比對", "巡檢比對", "備機"]);
  const [hasSearched, setHasSearched] = useState(false);


  const {
    data: projectsListData,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: thresholdOverData,
    loading: loadingThresholdOverData,
    error: errorThresholdOverData,
    fetchThresholdOverData,
  } = useThresholdOverData();

  const {
    data: disconnectedData,
    loading: loadingDisconnectedData,
    error: errorDisconnectedData,
    fetchDisconnectedData,
  } = useDisconnectedData();

  const disconnectedColumns = [
    { accessorKey: "STID", header: "編號" },
    { accessorKey: "IIT", header: "裝置名稱" },
    { accessorKey: "Desc", header: "描述" },
    {
      accessorKey: "OffLineStatus",
      header: "狀態",
      cell: ({ row }) => {

        const status = row.original.OffLineStatus;

        return (
          <BaseStatus
            tag={
              status === "斷線中" ? "red"
                : status.includes("已下架") ? "amber"
                : "default"
            }
            text={status}
          />
        );
      },
    },
    { accessorKey: "DisconnDurationText", header: "斷線時長" },
  ];

  const thresholdOverColumns = [
    { accessorKey: "STID", header: "編號" },
    { accessorKey: "IIT", header: "裝置名稱" },
    { accessorKey: "Desc", header: "描述" },
    { accessorKey: "ITEM", header: "測項" },
    { accessorKey: "ALARM", header: "異常情形" },
    { accessorKey: "TOTALTIME", header: "異常時常" },
    { accessorKey: "CHECKTIME", header: "檢查時間" },
  ];


  const validate = () => {

    if (!form.project) {
      return "請確認已填寫：專案";
    }
    return null;
  };

  const handleSearch = async () => {
    const err = validate();

    if (err) {
      alert(err);
      return;
    }

    setHasSearched(true);
    setLastUpdatedThreshold(dayjs().format("YYYY-MM-DD HH:mm"));
    setLastUpdatedDisconnected(dayjs().format("YYYY-MM-DD HH:mm"));

    await Promise.allSettled ([
      fetchDisconnectedData({ project: form.project, tab, filters }),
      fetchThresholdOverData(form)
    ]);
  };

  const handleRefresh = async () => {
    const err = validate();

    if (err) {
      alert(err);
      return;
    }

    setLastUpdatedDisconnected(dayjs().format("YYYY-MM-DD HH:mm"));
    await fetchDisconnectedData({ project: form.project, tab, filters });
  };

  useEffect(() => {
    fetchProjectsList();
  }, []);


  return (
    <div className="space-y-8">

      <PageTitle description="即時監控測站斷線與數值異常"/>

      <BaseCard title="監控條件" subtitle="選擇專案後查詢測站連線與數值狀態">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-end">

          <BaseSelect
            label="專案"
            value={form.project}
            onChange={(val) => setForm({ ...form, project: val })}
            options={projectsListData}
            placeholder="請選擇專案"
          />

          <BaseButton
            onClick={handleSearch}        
            className="w-full sm:w-auto"
          >
            查詢
          </BaseButton>
        </div>
      </BaseCard>

      {hasSearched && (
        <>
          <BaseCard
            title="測站斷線監控"
            subtitle={`更新時間：${lastUpdatedDisconnected}`}
            headerRight={
              <div className="flex flex-wrap items-center gap-4">
                <BaseTab
                  value={tab}
                  onChange={setTab}
                  items={[
                    { label: "全部", value: "All" },
                    { label: "斷線", value: "Disconnected" },
                    { label: "下架", value: "OffLine" },
                  ]}
                />

                <div className="flex flex-row gap-2">
                  <label>不顯示:</label>
                  <BaseCheckbox
                    value={filters}
                    onChange={setFilters}
                    items={[
                      { label: "一致性比對", value: "一致性比對" },
                      { label: "備機", value: "備機" },
                      { label: "巡檢比對", value: "巡檢比對" },
                    ]}
                  />
                </div>

                <BaseButton size="sm" onClick={handleRefresh} disabled={loadingDisconnectedData}>更新</BaseButton>
              </div>
            }
          >
            <BaseApiLoaderWrapper
              isLoading={loadingDisconnectedData}
              isError={errorDisconnectedData}
            >

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="type-body text-muted-foreground ">共 {disconnectedData.length} 筆資料</p>
                <div className="flex flex-wrap items-center gap-2">
                <ExportCSVButton data={disconnectedData} columns={disconnectedColumns} filename="測站斷線監控"/>
                <ExportExcelButton data={disconnectedData} columns={disconnectedColumns} filename="測站斷線監控"/>
                <ExportPDFButton data={disconnectedData} columns={disconnectedColumns} filename="測站斷線監控"/>
                </div>
              </div>

              <BaseTable data={disconnectedData} columns={disconnectedColumns} />
            </BaseApiLoaderWrapper>
          </BaseCard>


          <BaseCard
            title="數值異常監控"
            subtitle={`更新時間：${lastUpdatedThreshold}`}
          >
            <BaseApiLoaderWrapper
              isLoading={loadingThresholdOverData}
              isError={errorThresholdOverData}
            >

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="type-body text-muted-foreground ">共 {thresholdOverData.length} 筆資料</p>
                <div className="flex flex-wrap items-center gap-2">
                <ExportCSVButton data={thresholdOverData} columns={thresholdOverColumns} filename="數值異常監控"/>
                <ExportExcelButton data={thresholdOverData} columns={thresholdOverColumns} filename="數值異常監控"/>
                <ExportPDFButton data={thresholdOverData} columns={thresholdOverColumns} filename="數值異常監控"/>
                </div>
              </div>

              <BaseTable data={thresholdOverData} columns={thresholdOverColumns} />
            </BaseApiLoaderWrapper>
          </BaseCard>
        </>
      )}
    </div>
  );
}
