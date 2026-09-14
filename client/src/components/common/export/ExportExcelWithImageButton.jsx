import { exportToExcelWithImage } from "./exportUtils";
import BaseButton from "@/components/common/button/BaseButton";

export default function ExportExcelWithImageButton({ data, columns, filename }) {
    return (

        <BaseButton
            variant="export" 
            size="sm"
            onClick={() => exportToExcelWithImage(data, columns, filename)}
        >
            下載 Excel
        </BaseButton>
    );
}
