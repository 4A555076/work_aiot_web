import { useState, useEffect } from "react";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import PageTitle from "@/components/common/PageTitle";
import ExportCSVButton from "@/components/common/export/ExportCSVButton";
import ExportExcelButton from "@/components/common/export/ExportExcelButton";
import ExportPDFButton from "@/components/common/export/ExportPDFButton";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import { useProjectsList, useMissingHourData } from "@/hook/useMissingHour";

export default function MissingHourPage() {
  
  const [form, setForm] = useState({ project: "" });
  const [hasSearched, setHasSearched] = useState(false);

  const {
    data: projectsListData,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: missingHourData,
    loading: loadingMissingHourData,
    error: errorMissingHourData,
    fetchMissingHourData,
  } = useMissingHourData();

  const columns = [
    { accessorKey: "STID", header: "編號" },
    { accessorKey: "IIT", header: "裝置名稱" },
    { accessorKey: "Desc", header: "描述" },
    ...Array.from({ length: 24 }, (_, i) => {
      const hour = String(i).padStart(2, "0");
      const currentHour = new Date().getHours();

      return {
        accessorKey: `dCnt${hour}`,
        header: hour,
        cell: ({ getValue }) => {
          const val = getValue();

          if (i >= currentHour) {
            return ;
          }

          const baseClass = "flex h-5 w-5 items-center justify-center rounded-sm text-xs xl:h-6 xl:w-6 2xl:h-7 2xl:w-7 xl:text-sm 2xl:text-base font-medium";

          if (val == null) {
            return (
              <div className={`${baseClass} bg-red-100 text-red-700`} title="全缺值"> ✕ </div>
            );
          }

          if (val === 0) {
            return (
              <div className={`${baseClass} bg-emerald-100 text-emerald-700`} title="無缺值"> ✓ </div>
            );
          }

          return (
            <div className={`${baseClass} bg-amber-100 text-amber-700`} title={`缺值${val} 次`}>{val}</div>
          );
        },
      };
    }),
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
    await fetchMissingHourData(form);
  };

  useEffect(() => {
    fetchProjectsList();
  }, []);

  return (
    <div className="space-y-8">

      <PageTitle description="檢查每小時資料完整性"/>

      <BaseCard title="查詢條件" subtitle="選擇專案以檢查各測站的小時資料完整性">
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

      <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 type-body text-muted-foreground ">

        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-emerald-200 bg-emerald-100 type-meta font-semibold text-emerald-700">
            ✓
          </span>
          <span>正常（無缺值）</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-sm border xl:h-6 xl:min-w-6 2xl:h-7 2xl:min-w-7 border-amber-200 bg-amber-100 px-1 type-meta font-semibold text-amber-700">
            3
          </span>
          <span>有缺值（&gt;0）</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm border border-red-200 bg-red-100 type-meta font-semibold text-red-700">
            ✕
          </span>
          <span>小時全缺值</span>
        </div>

      </div>

      {hasSearched && (
        <BaseCard title="小時資料狀態" subtitle={`共 ${missingHourData.length} 筆測站資料`}>
          <BaseApiLoaderWrapper
            isLoading={loadingMissingHourData}
            isError={errorMissingHourData}
          >

            <div className="mb-4 flex flex-wrap justify-end gap-2">
              <ExportCSVButton data={missingHourData} columns={columns} filename="小時資料狀態"/>
              <ExportExcelButton data={missingHourData} columns={columns} filename="小時資料狀態"/>
              <ExportPDFButton data={missingHourData} columns={columns} filename="小時資料狀態"/>
            </div>

            <BaseTable data={missingHourData} columns={columns} />
          </BaseApiLoaderWrapper>
        </BaseCard>
      )}
     
    </div>
  );
}
