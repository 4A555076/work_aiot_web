import { exportToCSV } from "./exportUtils";
import BaseButton from "@/components/common/button/BaseButton";

export default function ExportCSVButton({ data, columns, filename }) {
    return (

        <BaseButton
            variant="export" 
            size="sm"
            onClick={() => exportToCSV(data, columns, filename)}
        >
            下載 CSV
        </BaseButton>
    );
}
