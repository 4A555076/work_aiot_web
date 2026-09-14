import { useState } from "react";
import dayjs from "dayjs";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import { useSensorReplacementReport } from "@/hook/useSensorReplacementReport";


const initialForm = {  
  startDateTime: "", 
  endDateTime: "",
  station: "", 
  PRSN: "",
};


export default function SensorReplacementReport() {
  const [form, setForm] = useState(initialForm);
  const [hasSearched, setHasSearched] = useState(false);

  const {
    data: sensorReplacementData,
    loading: loadingSensorReplacement,
    error: errorSensorReplacement,
    fetchSensorReplacementReport,
  } = useSensorReplacementReport();

  const columns = [
    { accessorKey: "amdDate", header: "更換時間", },
    { accessorKey: "STID", header: "編號" },
    { accessorKey: "IIT", header: "裝置名稱" },
    { accessorKey: "PRSN", header: "Sensor 序號" },
    { accessorKey: "CNAME", header: "更換人員" },
    { accessorKey: "slpC", header: "斜率" },
    { accessorKey: "itcC", header: "截距" },
  ];

  const handleSearch = async () => {
    setHasSearched(true);

    await fetchSensorReplacementReport({
      startDateTime: form.startDateTime ? dayjs(form.startDateTime).format("YYYY-MM-DD HH:mm") : "",
      endDateTime: form.endDateTime ? dayjs(form.endDateTime).format("YYYY-MM-DD HH:mm") : "",
      station: form.station.trim(),
      PRSN: form.PRSN.trim(),
    });
  };

  const handleReset = () => {
    setForm(initialForm);
    setHasSearched(false);
  };

  return (
    <div className="space-y-8">

      <PageTitle description="查詢站點的 PM₂.₅ sensor 更換歷程與校正參數"/>

      <BaseCard title="查詢條件" subtitle="可依更換時間、站點或sensor序號篩選紀錄">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <BaseInput 
            label="開始時間" 
            type="datetime-local" 
            value={form.startDateTime} 
            onChange={(e) => setForm({ ...form, startDateTime: e.target.value })} 
            max={form.endDateTime || dayjs().format("YYYY-MM-DDTHH:mm")}
          />
          <BaseInput 
            label="結束時間" 
            type="datetime-local" 
            value={form.endDateTime} 
            onChange={(e) => setForm({ ...form, endDateTime: e.target.value })}
            min={form.startDateTime}
            max={dayjs().format("YYYY-MM-DDTHH:mm")}
          />
          <BaseInput 
            label="測站" 
            value={form.station} 
            onChange={(e) => setForm({ ...form, station: e.target.value })} 
            placeholder="輸入編號/裝置名稱" 
          />
          <BaseInput 
            label="sensor 序號" 
            value={form.PRSN} 
            onChange={(e) => setForm({ ...form, PRSN: e.target.value })} 
            placeholder="輸入 sensor 序號" 
          />
        </div>
        <div className="border-t border-border flex justify-end gap-2 pt-5 mt-5">
          <BaseButton
            variant="outline"
            onClick={handleReset}   
            className="w-full sm:w-auto"
          >
            重設
          </BaseButton>
          <BaseButton
            onClick={handleSearch}   
            loading={loadingSensorReplacement}
            className="w-full sm:w-auto"
          >
            查詢
          </BaseButton>
        </div>
      </BaseCard>

      {hasSearched && (
        <BaseCard
          title="Sensor 更換紀錄"
          subtitle={`共 ${sensorReplacementData.length} 筆資料`}
          headerRight={
            <div className="flex flex-wrap gap-2">
              <ExportCSVButton data={sensorReplacementData} columns={columns} filename="Sensor 更換紀錄"/>
              <ExportExcelButton data={sensorReplacementData} columns={columns} filename="Sensor 更換紀錄"/>
              <ExportPDFButton data={sensorReplacementData} columns={columns} filename="Sensor 更換紀錄"/>
            </div>
          }
        >
          <BaseApiLoaderWrapper
            isLoading={loadingSensorReplacement}
            isError={Boolean(errorSensorReplacement)}
          >
            <BaseTable data={sensorReplacementData} columns={columns}/>
          </BaseApiLoaderWrapper>
        </BaseCard>
      )}
    </div>
  );
}
