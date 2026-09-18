import { exportToExcelWithImage } from "./exportUtils";
import BaseButton from "@/components/common/button/BaseButton";
import PropTypes from "prop-types";
import { useState } from "react";

export default function ExportExcelWithImageButton({ data, columns, filename, imageLoader }) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (isExporting) return;

        setIsExporting(true);
        try {
            await exportToExcelWithImage(data, columns, filename, imageLoader);
        } finally {
            setIsExporting(false);
        }
    };

    return (

        <BaseButton
            variant="export" 
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
        >
            {isExporting ? "下載中" : "下載 Excel"}
        </BaseButton>
    );
}
