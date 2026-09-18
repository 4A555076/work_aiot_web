import { exportToExcelWithImage } from "./exportUtils";
import BaseButton from "@/components/common/button/BaseButton";
import { useState } from "react";

export default function ExportExcelWithImageButton({ data, columns, filename, imageLoader }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (isExporting) return;

        setIsExporting(true);
        try {
            await exportToExcelWithImage(data, columns, filename, imageLoader);
        } catch (error) {
            console.error("Excel 匯出失敗:", error);
            alert("Excel 匯出失敗，請稍後再試");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <BaseButton
                variant="export"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
            >
                下載 Excel
            </BaseButton>

            {isExporting && (
                <p className="text-sm text-muted-foreground">
                    Excel 產生中，請稍候…
                </p>
            )}
        </div>
       
    );
}
