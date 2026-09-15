import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import NotoSansTC from "@/assets/fonts/NotoSansTC-normal";

const addFont = (doc) => {
  doc.addFileToVFS("NotoSansTC.ttf", NotoSansTC);
  doc.addFont("NotoSansTC.ttf", "NotoSansTC", "normal");
  doc.setFont("NotoSansTC");
};


// CSV
export const exportToCSV = (data, columns, filename = "export") => {

  const filteredColumns = columns.filter( (col) => col.header !== "操作");
  const headers = filteredColumns.map((col) => col.header);
  const rows = data.map((row) => {
    const newRow = {};
    filteredColumns.forEach((col) => {
      const dataKey = col.accessorKey ; 
      newRow[col.header] = row[dataKey];
    });
    return newRow;
  });


  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const csv = XLSX.utils.sheet_to_csv(ws);

  // "\ufeff" 解決 Excel 中文亂碼
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }); 
  saveAs(blob, `${filename}` + ".csv");
};

// Excel
export const exportToExcel = (data, columns, filename = "export.xlsx") => {

  const filteredColumns = columns.filter( (col) => col.header !== "操作");
  const headers = filteredColumns.map((col) => col.header);
  const keys = filteredColumns.map((col) => col.accessorKey);
  const rows = data.map((item) => keys.map((key) => item?.[key] ?? ""));
  
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  XLSX.writeFile(wb, `${filename}` + ".xlsx");
};

// PDF
export const exportToPDF = (data, columns, filename = "export.pdf") => {
  const doc = new jsPDF("l", "mm", "a4");

  addFont(doc);

  const filteredColumns = columns.filter( (col) => col.header !== "操作");
  const headers = filteredColumns.map((col) => col.header);
  const keys = filteredColumns.map((col) => col.accessorKey);
  const rows = data.map((item) => keys.map((key) => item?.[key] ?? ""));

  autoTable(doc, {
    head: [headers],
    body: rows,
    styles: {
      font: "NotoSansTC",
      fontStyle: "normal",
    },
    headStyles: {
      font: "NotoSansTC",
      fontStyle: "normal", 
    },
    bodyStyles: {
      font: "NotoSansTC",
      fontStyle: "normal",
    },
  });

  doc.save(`${filename}`+ ".pdf");
};


const base64ToUint8Array = (base64String) => {
  const base64 = base64String.replace(
    /^data:image\/\w+;base64,/,
    ""
  );

  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
};

// Excel 有圖片(目前只有巡檢報表使用)
export const exportToExcelWithImage = async ( data, columns, filename = "export" ) => {

  const imageCellWidth = 40;
  const imageCellHeight = 360;
  const imageMaxWidth = 240;
  const imageMaxHeight = 320;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("巡檢紀錄");

  const filteredColumns = columns.filter(
    (col) => col.header !== "操作"
  );

  const imageColumns = [
    "East",
    "West",
    "South",
    "North",
  ];

  worksheet.addRow([
    "",
    "DeviceID",
    "DeviceName",
    "StartTime",
  ]);


  worksheet.addRow(
    filteredColumns.map((col) => col.header)
  );

  filteredColumns.forEach((_, index) => {
    worksheet.getColumn(index + 1).width = imageCellWidth;
  });

  worksheet.getRow(1).height = 25;

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { size: 10, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });


  worksheet.getRow(2).height = 75;

  worksheet.getRow(2).eachCell((cell) => {
    cell.font = { size: 10, bold: true, name: "Calibri" };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // 資料 
  for (let i = 0; i < data.length; i++) {

    const item = data[i];

    const rowData = filteredColumns.map((col) => {
      const key = col.accessorKey;

      if (imageColumns.includes(key)) {
        return "";
      }

      return item[key] ?? "";

    });

    const row = worksheet.addRow(rowData);

    row.height = imageCellHeight;

    row.eachCell((cell) => {
      cell.font = { size: 10, name: "Calibri" };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // 加入圖片
    for ( let colIndex = 0; colIndex < filteredColumns.length; colIndex++ ) {
      const key = filteredColumns[colIndex].accessorKey;

      if (!imageColumns.includes(key)) {
        continue;
      }

      const imageBase64 = item[key];

      if (!imageBase64) {
        continue;
      }

      try {
        const extension = imageBase64.match(/^data:image\/(\w+);base64,/)?.[1] || "jpeg";
        const displaySize = {
          width: imageMaxWidth,
          height: imageMaxHeight,
        };

        const imageId =
          workbook.addImage({
            buffer: base64ToUint8Array(imageBase64),
            extension: extension === "jpg" ? "jpeg" : extension,
          });

        worksheet.addImage(
          imageId,
          {
            tl: {
              col: colIndex ,
              row: i + 2 ,
            },
            ext: displaySize,
            editAs: "oneCell",
          }
        );

      }
      catch (error) {
        console.error( "圖片加入失敗：", key, error );
      }
    }
  }

  const excelBuffer = await workbook.xlsx.writeBuffer();

  saveAs( new Blob([excelBuffer],{ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx` );

};

