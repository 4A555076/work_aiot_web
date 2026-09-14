import { exportToPDF } from "./exportUtils";
import BaseButton from "@/components/common/button/BaseButton";

export default function ExportPDFButton({ data, columns, filename }) {
  return (
    <BaseButton
        variant="export" 
        size="sm"
        onClick={() => exportToPDF(data, columns, filename)}
    >
        下載 PDF
    </BaseButton>
  );
}
