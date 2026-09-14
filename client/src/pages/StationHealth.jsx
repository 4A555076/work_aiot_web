import { useState, useEffect } from "react";
import dayjs from "dayjs";
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseTab from "@/components/common/tab/BaseTab";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import { useProjectsList, useStationHealthData, useDisconnectionDetailsData } from "@/hook/useStationHealth";
import { History } from 'lucide-react';

export default function StationHealthPage() {

  const [form, setForm] = useState({ startTime: "", project: "" });
  const [hasSearched, setHasSearched] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStationName, setSelectedStationName] = useState("");
  const [switchGap, setSwitchGap] = useState("1");

  const {
    data: projectsListData,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: stationHealthData,
    loading: loadingStationHealth,
    error: errorStationHealth,
    fetchStationHealthData,
  } = useStationHealthData();

  const {
    data: disconnectionDetailsData,
    loading: loadingDisconnectionDetails,
    error: errorDisconnectionDetails,
    fetchDisconnectionDetailsData,
  } = useDisconnectionDetailsData();

  const columns = [
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <BaseButton 
            variant="table-action"
            size="table-icon"
            onClick={() => handleOpenDisconnectionModal(row.original)}
          >
            <History className="h-4 w-4"/>
          </BaseButton>
        </div>
      ),
    },
    { accessorKey: 'STID', header: '編號' },
    { accessorKey: 'IIT', header: '裝置名稱' },
    { accessorKey: 'Desc', header: '描述' },
    { accessorKey: 'MissingMinutes', header: '總斷線累積時數'},
    { accessorKey: 'HealthRate', header: '健康度'},
  ];

  const disconnectionColumns = [
    { accessorKey: 'StartTime', header: '開始時間' },
    { accessorKey: 'EndTime', header: '結束時間' },
    { accessorKey: 'Duration', header: '持續時間', },
  ];


  const validate = () => {
    if (!form.startTime || !form.project) {
      return "請確認已填寫：時間、專案";
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
    await fetchStationHealthData({
      startTime: dayjs(form.startTime).format("YYYYMM"),
      project: form.project,
    });
  };

  const handleOpenDisconnectionModal = async (rowOriginal) => {
    const stationId = rowOriginal.STID;
    setSelectedStationName(`(${stationId}) ${rowOriginal.IIT}`); 
    setIsModalOpen(true);

    await fetchDisconnectionDetailsData({
      startTime: dayjs(form.startTime).format("YYYYMM"),
      station: stationId,
      project: form.project,
      switchGap: switchGap,
    });
  };

  const handleModalOpenChange = (open) => {
    setIsModalOpen(open);

    if (!open) {
      setSwitchGap("1");
    }
  };

  const handleTabChange = async (newGap) => {
  
    setSwitchGap(newGap);

    const stationId = selectedStationName.match(/\((.*?)\)/)?.[1] ?? "";
    
    await fetchDisconnectionDetailsData({
      startTime: dayjs(form.startTime).format("YYYYMM"),
      station: stationId,
      project: form.project,
      switchGap: newGap,
    });
  };

  useEffect(() => {
    fetchProjectsList();
    setForm((prev) => ({
      ...prev,
      startTime: dayjs().format("YYYY-MM"),
    }));
  }, []);

  return (
    <div className="space-y-8">
      <PageTitle description="查詢並分析各測站當月健康度與資料缺失情形"/>

      <BaseCard title="查詢條件" subtitle="選擇月份與專案，分析測站健康度與資料缺失">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-end">
          <BaseInput
            label="時間"
            type="month"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            max={dayjs().format("YYYY-MM")}
          />

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
        <BaseCard title="健康度統計" subtitle={`共 ${stationHealthData.length} 筆測站資料`}>
          <BaseApiLoaderWrapper
            isLoading={loadingStationHealth}
            isError={errorStationHealth}
          >
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <ExportCSVButton data={stationHealthData} columns={columns} filename="健康度統計"/>
              <ExportExcelButton data={stationHealthData} columns={columns} filename="健康度統計"/>
              <ExportPDFButton data={stationHealthData} columns={columns} filename="健康度統計"/>
            </div>
            <BaseTable data={stationHealthData} columns={columns} />
          </BaseApiLoaderWrapper>
        </BaseCard>
      )}


      <BaseDialog
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        title={`${selectedStationName} - 斷線事件紀錄`}
        description={`顯示該測站於${dayjs(form.startTime).format("M")}月的斷線時間片段`}
        hideFooter={true}
      >

        <BaseApiLoaderWrapper
          isLoading={loadingDisconnectionDetails}
          isError={errorDisconnectionDetails}
        >
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <BaseTab
              value={switchGap}
              onChange={handleTabChange}
              items={[
                { label: "標準", value: "1" },
                { label: "詳細", value: "0" },
              ]}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <ExportCSVButton data={disconnectionDetailsData} columns={disconnectionColumns} filename={`${selectedStationName} - 斷線事件紀錄`}/>
              <ExportExcelButton data={disconnectionDetailsData} columns={disconnectionColumns} filename={`${selectedStationName} - 斷線事件紀錄`}/>
              <ExportPDFButton data={disconnectionDetailsData} columns={disconnectionColumns} filename={`${selectedStationName} - 斷線事件紀錄`}/>
            </div>  
          </div>
   
          <BaseTable data={disconnectionDetailsData}  columns={disconnectionColumns}/>
        </BaseApiLoaderWrapper>
      </BaseDialog>
    </div>
  );
}
