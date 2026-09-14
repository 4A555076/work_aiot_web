import { exportToExcel } from "./exportUtils";
import BaseButton from "@/components/common/button/BaseButton";

export default function ExportExcelButton({ data, columns, filename }) {
    return (

        <BaseButton
            variant="export" 
            size="sm"
            onClick={() => exportToExcel(data, columns, filename)}
        >
            下載 Excel
        </BaseButton>
    );
}
