import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { MapPinned } from 'lucide-react';
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import { useFireProjects, useFireRecord } from "@/hook/useFireRecord";


export default function FireRecordPage() {
  
  const [form, setForm] = useState({
    startTime: "",
    endTime: "",
    project: "",
    squadCount: 0,
  });

  const {
    data: fireProjectsData,
    fetchFireProjects,
  } = useFireProjects();

  const {
    data: fireRecordData,
    loading: loadingFireRecord,
    error: errorFireRecord,
    fetchFireReport,
  } = useFireRecord();

  const columns = [
    {
      id: "action",
      header: "操作",
      cell: ({ row }) => {
        const Event = row.original.Event;
        const SN = row.original.SN;

        const handleOpen = () => {
          if (!Event || !SN) return;

          const url = `http://125.227.111.238:81/iot/${Event}/${SN}`;
          window.open(url, "_blank", "noopener,noreferrer");
        };

        return (
          <BaseButton
            aria-label={`開啟 ${Event || ""} 地圖`}
            onClick={handleOpen}
            variant="table-action"
            size="table-icon"
          >
            <MapPinned/>
          </BaseButton>
        );
      },
    },
    { accessorKey: "cDate", header: "案件時間" },
    { accessorKey: "district", header: "地點" },
    { accessorKey: "detail", header: "詳細" },
    { accessorKey: "status", header: "執行狀況" },
    { accessorKey: "squadCount", header: "出勤分隊數" },
    { accessorKey: "durationMinute", header: "持續時間" },
    { accessorKey: "Ack", header: "Ack" },
    { accessorKey: "WGS84", header: "經緯度" },
  ];

  const validate = () => {

    if (!form.startTime || !form.endTime || !form.project) {
      return "請確認已填寫：開始時間、結束時間、事件類型";
    }
    return null;
  };

  const handleSearch = async () => {
    const err = validate();

    if (err) {
      alert(err);
      return;
    }

    await fetchFireReport({
      startTime: dayjs(form.startTime).format("YYYY-MM-DD HH:mm"),
      endTime: dayjs(form.endTime).format("YYYY-MM-DD HH:mm"),
      project: form.project,
      squadCount: form.squadCount ? form.squadCount : 0,
    });
  };

  useEffect(() => {
    fetchFireProjects();

    setForm((prev) => ({
      ...prev,
      startTime: dayjs().subtract(3, "day").startOf("day").format("YYYY-MM-DD HH:mm"),
      endTime: dayjs().endOf("day").format("YYYY-MM-DD HH:mm"),
    }));
  }, []);

  useEffect(() => {
    if (!fireProjectsData?.length) return;

    setForm((prev) => ({
      ...prev,
      project: fireProjectsData[0].value ?? fireProjectsData[0],
    }));

    fetchFireReport({
      ...form,
      project: fireProjectsData[0].value ?? fireProjectsData[0],
    });
  }, [fireProjectsData]);


  return (
    <div className="space-y-8">
      
      <PageTitle description="火災出勤與事件紀錄" />

      <BaseCard title="查詢條件" subtitle="依時間、事件類型與出動分隊數篩選火災紀錄">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <BaseInput
            label="開始時間"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            max={form.endTime}
          />

          <BaseInput
            label="結束時間"
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            min={form.startTime}
            max={dayjs().endOf("day").format("YYYY-MM-DD HH:mm")}
          />

          <BaseSelect
            label="事件類型"
            value={form.project}
            onChange={(val) => setForm({ ...form, project: val })}
            options={fireProjectsData}
          />

          <BaseInput
            label="出動分隊數(選填)≥"
            type="number"
            value={form.squadCount ? form.squadCount : ''}
            onChange={(e) => setForm({ ...form, squadCount: e.target.value })}
            placeholder="選填"
          />
        </div>

        <div className="mt-5 flex justify-end border-t border-border pt-5">
          <BaseButton
            onClick={handleSearch}   
            className="w-full sm:w-auto"
          >
            查詢
          </BaseButton>
        </div>
      </BaseCard>

      <BaseCard
        title="火災紀錄列表"
        subtitle={`共 ${fireRecordData.length} 筆資料`}
        headerRight={
          <div className="flex flex-wrap gap-2">
            <ExportCSVButton data={fireRecordData} columns={columns} filename="火災紀錄"/>
            <ExportExcelButton data={fireRecordData} columns={columns} filename="火災紀錄"/>
            <ExportPDFButton data={fireRecordData} columns={columns} filename="火災紀錄"/>
          </div>
        }
      >
        <BaseApiLoaderWrapper
          isLoading={loadingFireRecord}
          isError={errorFireRecord}
        >
          <BaseTable data={fireRecordData} columns={columns}/>
        </BaseApiLoaderWrapper>
      </BaseCard>

    </div>
  );
}
