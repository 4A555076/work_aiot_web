import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Chart } from "@highcharts/react";
import { Exporting } from '@highcharts/react/modules/Exporting';
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import BaseMultiSelect from "@/components/common/select/BaseMultiSelect"; 
import { useProjectsList, useProjectHealthData } from "@/hook/useProjectScore";



export default function ProjectScorePage() {
  
  const [form, setForm] = useState({
    startTime: dayjs().startOf("day").format("YYYY-MM-DD HH:mm"),
    endTime: dayjs().endOf("day").format("YYYY-MM-DD HH:mm"),
    project: [], 
  });
  const [hasSearched, setHasSearched] = useState(false);

  const {
    data: projectsListData,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: ProjectHealthData,
    loading: loadingProjectHealth,
    error: errorProjectHealth,
    fetchProjectHealthData,
  } = useProjectHealthData();

  const chartOptions = {
    chart: { 
      marginTop: 50, 
      zooming: { type: 'x' },
     },
    title: { text: null },
    legend: { enabled: true },
    time: { useUTC: false },
    xAxis: {
      type: "datetime",
      crosshair: true,
      dateTimeLabelFormats: {
        minute: "%H:%M",
        hour: "%H:%M",
        day: "%Y-%m-%d",
      },
      title: { text: "日期時間" },
    },
    yAxis: {
      title: { text: "資料獲取率 (%)" },
      max: 100
    },
    tooltip: {
      shared: true,
      xDateFormat: "%Y-%m-%d %H:%M %A",
      pointFormat:'<span style="color:{series.color}">●</span> {series.name} : <b>{point.y:.2f} %</b><br/>',
    },
    credits: { enabled: false },
    lang: {
      weekdays: ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],
      contextButtonTitle: '匯出選單',
      downloadPNG: '下載 PNG',
      downloadJPEG: '下載 JPEG',
      downloadPDF: '下載 PDF',
      downloadSVG: '下載 SVG',
      downloadCSV: '下載 CSV',
      downloadXLS: '下載 XLS',
      printChart: '列印圖表',
      viewFullscreen: '全螢幕檢視',
      exitFullscreen: '退出全螢幕',
      resetZoom:'重置縮放',
      noData: '沒有資料可顯示'
    },
    series: ProjectHealthData.map((series) => ({
      id: String(series.id),
      type: "line",
      name: series.name,
      data: Array.isArray(series.data) ? series.data : [],
    })),
    
  };


  const validate = () => {
    if (!form.startTime || !form.endTime || !form.project) {
      return "請確認已填寫：開始時間、結束時間、專案";
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
    await fetchProjectHealthData(
      {
        startTime: dayjs(form.startTime).format("YYYY-MM-DD HH:mm"),
        endTime: dayjs(form.endTime).format("YYYY-MM-DD HH:mm"),
        project: form.project.join(",")
      }, 
      projectsListData
    );
  };

  useEffect(() => {
    fetchProjectsList();
  }, []);


  return (
    <div className="space-y-8">

      <PageTitle description="分析各專案於指定期間的資料獲取率趨勢"/>

      <BaseCard title="分析條件" subtitle="選擇時間範圍與一個或多個專案進行趨勢比較">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
          <BaseInput
            label="開始時間"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />

          <BaseInput
            label="結束時間"
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />

          <BaseMultiSelect
            label="專案"
            value={form.project}
            onChange={(vals) => setForm({ ...form, project: vals })}
            options={projectsListData}
            placeholder="請選擇一個或多個專案"
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
        <BaseCard title="資料獲取率分析圖表" subtitle="資料來源：專案測站歷史監測紀錄">
          <BaseApiLoaderWrapper 
            isLoading={loadingProjectHealth}
            isError={errorProjectHealth}
          >
            <div className="min-h-80 w-full overflow-hidden rounded-xl border border-border bg-card p-2 sm:min-h-105 sm:p-4">
            <Chart options={chartOptions}>
              <Exporting 
                sourceWidth={1200} 
                sourceHeight={800} 
                scale={2} 
              />
            </Chart>
            </div>
          </BaseApiLoaderWrapper>
        </BaseCard>
      )}


    </div>
  );
}
