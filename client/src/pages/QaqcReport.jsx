import { useState, useEffect } from "react";
import dayjs from "dayjs";
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseStatus from "@/components/common/status/BaseStatus";
import BaseCheckbox from "@/components/common/checkbox/BaseCheckbox";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import { ChartLine  } from 'lucide-react';
import { 
  useTestIdDateRangeList, 
  useSensorDateRangeList, 
  useSensorHealthData, 
  useSensorHealthImage 
} from "@/hook/useQaqcReport";


export default function QaqcReportPage() {
  

  const initialForm = {
    startTime: dayjs().subtract(3, "month").startOf("month").format("YYYY-MM-DD"),
    endTime: dayjs().format("YYYY-MM-DD"),
    SN: "",
    PRSN: "",
    enableDiff: ["isValue"],
    diffValue: "50",
  };

  const [form, setForm] = useState(initialForm);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    data: testIdDateRangeList,
    fetchTestIdDateRangeList,
  } = useTestIdDateRangeList();

  const {
    data: sensorDateRangeList,
    fetchSensorDateRangeList
    } = useSensorDateRangeList();


  const {
    data: sensorHealthData,
    loading: loadingSensorHealth,
    error: errorSensorHealth,
    fetchSensorHealthData,
  } = useSensorHealthData();

  const {
    fetchSensorHealthImage,
  } = useSensorHealthImage();



  const columns = [
    { accessorKey: 'SN', header: '測試序號' },
    { accessorKey: 'PSERNO', header: '品號' },
    { accessorKey: 'BACHNO', header: '批號' },
    { accessorKey: 'PRSN', header: '元件序號' },
    { accessorKey: 'dt_F', header: '測試日期(dt_F)' },
    { accessorKey: 'slpC', header: 'slop' },
    { accessorKey: 'itcC', header: 'intercept' },
    { accessorKey: 'r2C', header: 'R' },
    { accessorKey: 'stdC', header: 'stdC' },
    { accessorKey: 'healthyC', header: '健康度(%)' },
    {
      accessorKey: "status",
      header: "狀態",
      cell: ({ row }) => {

        const status = row.original.status;

        return (
          <BaseStatus
            tag={
              status.includes("優良") ? "green"
                : status.includes("良好") ? "blue"
                : status.includes("堪用") ? "amber"
                : status.includes("不良") ? "orange"
                : status.includes("廢品") ? "red"
                : "default"
            }
            text={status}
          />
        );
      },
    },
    {
      id: "action",
      header: "圖表",
      cell: ({ row }) => {

        const handleOpen = async () => {
          const imagePath = `${row.original.SN}\\${row.original.SN}_${row.original.PRSN}.jpg`;
          const title = row.original.PRSN;

          await fetchSensorHealthImage(imagePath,title);
        };

        return (
          <BaseButton
            aria-label={`查看 ${row.original.PRSN} 品檢圖表`}
            onClick={handleOpen}
            size="table-icon"
            variant="table-action"
          >
            <ChartLine />
          </BaseButton>
        );
      },
    },
    { accessorKey: 'rangeMin', header: 'Min' },
    { accessorKey: 'rangeMax', header: 'Max' },
    { accessorKey: 'tagSTID', header: 'tagSTID' },
    { accessorKey: 'tagChs', header: 'tagChs' },
  ];

  const validate = () => {

    if (!form.startTime || !form.endTime) {
      return "請確認已填寫：開始時間、結束時間";
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
    await fetchSensorHealthData(form);
  };

  const handleReset = () => {
    setForm(initialForm);
    setHasSearched(false);
  };

  useEffect(()=>{
    fetchTestIdDateRangeList({
      startTime: form.startTime, 
      endTime: form.endTime
    });
  },[form.startTime, form.endTime]);

  useEffect(() => {
    if (!form.SN) {
      setForm((prev) => ({ ...prev, PRSN: "" }));
      return;
    }

    fetchSensorDateRangeList({ SN: form.SN });
  }, [form.SN]);


  return (
    <div className="space-y-8">
      <PageTitle description="提供 Sensor 入庫後的性能測試紀錄與品檢報告下載" />

      <BaseCard title="查詢條件" subtitle="依測試日期、測試序號或元件序號查詢品檢報告">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <BaseInput
            label="開始時間"
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
            max={dayjs().format("YYYY-MM-DD")}
          />

          <BaseSelect
            label="測試序號"
            value={form.SN}
            onChange={(val) => setForm({ ...form, SN: val })}
            options={testIdDateRangeList}
            placeholder="請選擇測試序號"
          />

          {form.SN ? (
            <BaseSelect
              label="元件序號"
              value={form.PRSN}
              onChange={(val) => setForm({ ...form, PRSN: val })}
              options={sensorDateRangeList}
              placeholder="請選擇元件序號"
            />
          ) : (
            <BaseInput
              label="元件序號"
              type="text"
              value={form.PRSN}
              onChange={(e) => setForm({ ...form, PRSN: e.target.value })}
              placeholder="掃描 / 輸入元件序號"
            />
          )}

          <div className="space-y-2">
            <BaseCheckbox
              value={form.enableDiff} // 傳入陣列
              onChange={(val) => setForm({ ...form, enableDiff: val })} 
              multiple={false}
              items={[{ value: "isValue", label: "啟用濃度差值" }]}
            />
            <BaseInput
              label=""
              type="text"
              value={form.diffValue}
              onChange={(e) => setForm({ ...form, diffValue: e.target.value })}
              placeholder="數值"
              disabled={form.enableDiff.length === 0}
            />
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <BaseButton 
            onClick={handleReset}
            variant="outline"
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

      {hasSearched &&
        <BaseCard title="健康度結果報告" subtitle={`共 ${sensorHealthData.length} 筆品檢資料`}>
          <BaseApiLoaderWrapper
            isLoading={loadingSensorHealth}
            isError={errorSensorHealth}
          >
            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <ExportCSVButton data={sensorHealthData} columns={columns} filename="Sensor品質測試報告"/>
              <ExportExcelButton data={sensorHealthData} columns={columns} filename="Sensor品質測試報告"/>
              <ExportPDFButton data={sensorHealthData} columns={columns} filename="Sensor品質測試報告"/>
            </div>

            <BaseTable data={sensorHealthData} columns={columns} />
          </BaseApiLoaderWrapper>
        </BaseCard>
      }
    </div>
  );
}
