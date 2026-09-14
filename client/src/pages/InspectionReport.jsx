import { useState, useEffect } from "react";
import dayjs from "dayjs";
import BaseInput from "@/components/common/input/BaseInput";
import BaseButton from "@/components/common/button/BaseButton";
import BaseTable from "@/components/common/table/BaseTable";
import PageTitle from "@/components/common/PageTitle";
import BaseCard from "@/components/common/card/BaseCard";
import BaseSelect from "@/components/common/select/BaseSelect";
import BaseApiLoaderWrapper from "@/components/common/api/ApiLoaderWrapper";
import ExportExcelWithImageButton from "@/components/common/export/ExportExcelWithImageButton";
import { useProjectsList, useInspectionData } from "@/hook/useInspectionReport";
import BaseDialog from "@/components/common/dialog/BaseDialog";
import { Download, Expand } from "lucide-react";

const getImageExtension = (url) => {
  const mimeType = url.match(/^data:image\/([^;]+);base64,/)?.[1];
  if (mimeType) return mimeType === "jpeg" ? "jpg" : mimeType;

  const extension = url.split("?")[0].match(/\.([a-zA-Z0-9]+)$/)?.[1];
  return extension || "jpg";
};

const downloadImage = async (url, filename) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("圖片下載失敗");

    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("圖片下載失敗:", error);
    alert("圖片下載失敗，請稍後再試");
  }
};

const ImageCell = ({ url, alt, filename }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!url) {
    return <span className="text-muted-foreground">暫無圖片</span>;
  }

  return (
    <div className="flex flex-row gap-2">
      <img src={url} className="h-32 w-24 object-cover" alt={alt} />
      <div className="flex flex-col gap-2">
        <BaseButton
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-7 w-7 p-0"
          onClick={() => setIsPreviewOpen(true)}
          aria-label={`放大${alt}`}
          title="放大圖片"
        >
          <Expand className="h-3.5 w-3.5" />
          <span className="sr-only">放大圖片</span>
        </BaseButton>
        <BaseDialog
          open={isPreviewOpen}
          onOpenChange={setIsPreviewOpen}
          title={alt}
          hideFooter
          className="sm:max-w-5xl"
        >
          <div className="flex items-center justify-center overflow-auto rounded-lg bg-black/5 p-2">
            <img
              src={url}
              className="max-h-[60vh] max-w-full object-contain"
              alt={`${alt}放大預覽`}
            />
          </div>
          <div className="flex justify-end mt-4">
            <BaseButton
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-8 w-8 p-0"
              onClick={() => downloadImage(url, filename)}
              aria-label={`下載${alt}`}
              title="下載圖片"
            >
              <Download className="h-4 w-4" />
              <span className="sr-only">下載圖片</span>
            </BaseButton>
          </div>
        </BaseDialog>
        <BaseButton
          type="button"
          variant="outline"
          size="icon-sm"
          className="h-7 w-7 p-0"
          onClick={() => downloadImage(url, filename)}
          aria-label={`下載${alt}`}
          title="下載圖片"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="sr-only">下載圖片</span>
        </BaseButton>
      </div>
    </div>
  );
};


export default function InspectionReportPage() {

  const [form, setForm] = useState({
    startTime: "",
    endTime: "",
    project: "",
  });

  const [hasSearched, setHasSearched] = useState(false);

  const {
    data: ProjectsList,
    fetchProjectsList,
  } = useProjectsList();

  const {
    data: inspectionData,
    loading: loadingInspection,
    error: errorInspection,
    fetchInspectionData,
  } = useInspectionData();

  const columns = [
    { accessorKey: 'IIT', header: '裝置名稱' },
    { accessorKey: 'InspectionID', header: '受檢感測器編號' },
    { accessorKey: 'StartDate', header: '巡檢日期' },
    { accessorKey: 'StartTime', header: '開始時間' },
    { accessorKey: 'Environmental', header: '周圍環境描述' },
    { accessorKey: 'Outside', header: '設備本體外部狀況' },
    { accessorKey: 'Electricity', header: '設備電源接續現況' },
    { accessorKey: 'FixedCheck', header: '設備固定檢查' },
    { accessorKey: 'LockCheck', header: '箱體開關及鎖頭檢查' },
    { accessorKey: 'Clean', header: '感測器清潔' },
    { accessorKey: 'Surrounding1M', header: '設備周邊檢查' },
    { accessorKey: 'Surrounding50M', header: '設備周邊50公尺新增排放源' },
    { accessorKey: 'ValueStable', header: '確認感測器數值是否穩定' },
    { accessorKey: 'FixRecord', header: '維運檢修紀錄' },
    { accessorKey: 'Migrate', header: '感測器選移評估' },
    {
      accessorKey: 'East',
      id: 'East',
      header: '設備外觀檢查',
      cell: ({ getValue }) => {
        const url = getValue();
        const extension = url ? getImageExtension(url) : "jpg";
        return <ImageCell url={url} alt="設備外觀檢查" filename={`設備外觀檢查.${extension}`} />;
      }
    },
    {
      accessorKey: 'West',
      id: 'West',
      header: '設備內檢查清理',
      cell: ({ getValue }) => {
        const url = getValue();
        const extension = url ? getImageExtension(url) : "jpg";
        return <ImageCell url={url} alt="設備內檢查清理" filename={`設備內檢查清理.${extension}`} />;
      }
    },
    {
      accessorKey: 'South',
      id: 'South',
      header: '設備周邊遮蔽檢查',
      cell: ({ getValue }) => {
        const url = getValue();
        const extension = url ? getImageExtension(url) : "jpg";
        return <ImageCell url={url} alt="設備周邊遮蔽檢查" filename={`設備周邊遮蔽檢查.${extension}`} />;
      }
    },
    {
      accessorKey: 'North',
      id: 'North',
      header: '周界50公尺排放源',
      cell: ({ getValue }) => {
        const url = getValue();
        const extension = url ? getImageExtension(url) : "jpg";
        return <ImageCell url={url} alt="周界50公尺排放源" filename={`周界50公尺排放源.${extension}`} />;
      }
    }
  ];

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
    await fetchInspectionData({
      startTime: dayjs(form.startTime).format("YYYY-MM-DD"),
      endTime: dayjs(form.endTime).format("YYYY-MM-DD"),
      project: form.project,
    });
  };

  useEffect(() => {
    fetchProjectsList();

    setForm((prev) => ({
      ...prev,
      startTime: dayjs().subtract(3, "day").startOf("day").format("YYYY-MM-DD"),
      endTime: dayjs().endOf("day").format("YYYY-MM-DD"),
    }));
  }, []);



  return (
    <div className="space-y-8">

        <PageTitle description="查看巡檢紀錄"/>

        <BaseCard title="查詢條件" subtitle="選擇日期範圍與專案查看巡檢紀錄">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-end">
            <BaseInput
              label="開始時間"
              type="date"
              value={form.startTime}
              onChange={(e) =>setForm({ ...form, startTime: e.target.value })}
              max={dayjs().format("YYYY-MM-DD")}
            />

            <BaseInput
              label="結束時間"
              type="date"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              min={form.startTime}
              max={dayjs().endOf("day").format("YYYY-MM-DD")}
            />

            <BaseSelect
              label="專案"
              value={form.project}
              onChange={(val) => setForm({ ...form, project: val })}
              options={ProjectsList}
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
          <BaseCard 
            title="巡檢紀錄列表" 
            subtitle={`共 ${inspectionData.length} 筆巡檢資料`}
            headerRight={
               <ExportExcelWithImageButton data={inspectionData} columns={columns} filename="巡檢紀錄"/>
            }
          >
            <BaseApiLoaderWrapper
                isLoading={loadingInspection}
                isError={errorInspection}
            > 
              <BaseTable data={inspectionData} columns={columns}/>
            </BaseApiLoaderWrapper>
        </BaseCard>
        )}

    </div>
  );
}
