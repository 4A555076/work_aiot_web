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

const mapWithConcurrency = async (items, concurrency, mapper) => {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        await mapper(items[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);
};

const resizeImageForExcel = async (blob, maxWidth, maxHeight) => {
  if (typeof createImageBitmap !== "function") return blob;

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    if (scale === 1 && blob.type === "image/jpeg") return blob;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return blob;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    return await new Promise((resolve) => {
      canvas.toBlob(
        (optimizedBlob) => resolve(optimizedBlob || blob),
        "image/jpeg",
        0.82,
      );
    });
  } finally {
    bitmap.close();
  }
};

// Excel 有圖片(目前只有巡檢報表使用)
// export const exportToExcelWithImage = async (
//   data,
//   columns,
//   filename = "export",
//   imageLoader,
// ) => {

//   const imageCellWidth = 40;
//   const imageCellHeight = 360;
//   const imageMaxWidth = 240;
//   const imageMaxHeight = 320;

//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet("巡檢紀錄");

//   const filteredColumns = columns.filter(
//     (col) => col.header !== "操作"
//   );

//   const imageColumns = [
//     "East",
//     "West",
//     "South",
//     "North",
//   ];

//   const imageSources = [...new Set(
//     data.flatMap((item) => imageColumns.map((key) => item[key]).filter(Boolean)),
//   )];
//   const imageAssets = new Map();

//   // 圖片採固定併發數預先下載，避免逐張等待，也不會一次塞滿瀏覽器連線。
//   await mapWithConcurrency(imageSources, 8, async (imageSource) => {
//     try {
//       const isBase64 = imageSource.startsWith("data:image/");
//       const extension = isBase64
//         ? imageSource.match(/^data:image\/(\w+);base64,/)?.[1] || "jpeg"
//         : imageSource.split("?")[0].match(/\.([a-zA-Z0-9]+)$/)?.[1] || "jpeg";

//       if (!isBase64 && !imageLoader) {
//         throw new Error("缺少圖片下載方法");
//       }

//       if (isBase64) {
//         imageAssets.set(imageSource, {
//           buffer: base64ToUint8Array(imageSource),
//           extension: extension === "jpg" ? "jpeg" : extension,
//         });
//         return;
//       }

//       const imageBlob = await imageLoader(imageSource);
//       const optimizedBlob = await resizeImageForExcel(
//         imageBlob,
//         imageMaxWidth,
//         imageMaxHeight,
//       );
//       const buffer = new Uint8Array(await optimizedBlob.arrayBuffer());

//       imageAssets.set(imageSource, {
//         buffer,
//         extension: optimizedBlob.type === "image/jpeg"
//           ? "jpeg"
//           : extension === "jpg" ? "jpeg" : extension,
//       });
//     } catch (error) {
//       console.error("圖片下載失敗：", imageSource, error);
//       imageAssets.set(imageSource, null);
//     }
//   });

//   worksheet.addRow([
//     "",
//     "DeviceID",
//     "DeviceName",
//     "StartTime",
//   ]);


//   worksheet.addRow(
//     filteredColumns.map((col) => col.header)
//   );

//   filteredColumns.forEach((_, index) => {
//     worksheet.getColumn(index + 1).width = imageCellWidth;
//   });

//   worksheet.getRow(1).height = 25;

//   worksheet.getRow(1).eachCell((cell) => {
//     cell.font = { size: 10, name: "Calibri" };
//     cell.alignment = { vertical: "middle", horizontal: "center" };
//   });


//   worksheet.getRow(2).height = 75;

//   worksheet.getRow(2).eachCell((cell) => {
//     cell.font = { size: 10, bold: true, name: "Calibri" };
//     cell.alignment = { vertical: "middle", horizontal: "center" };
//   });

//   // 資料 
//   for (let i = 0; i < data.length; i++) {

//     const item = data[i];

//     const rowData = filteredColumns.map((col) => {
//       const key = col.accessorKey;

//       if (imageColumns.includes(key)) {
//         return "";
//       }

//       return item[key] ?? "";

//     });

//     const row = worksheet.addRow(rowData);

//     row.height = imageCellHeight;

//     row.eachCell((cell) => {
//       cell.font = { size: 10, name: "Calibri" };
//       cell.alignment = { vertical: "middle", horizontal: "center" };
//     });

//     // 加入圖片
//     for ( let colIndex = 0; colIndex < filteredColumns.length; colIndex++ ) {
//       const key = filteredColumns[colIndex].accessorKey;

//       if (!imageColumns.includes(key)) {
//         continue;
//       }

//       const imageSource = item[key];

//       if (!imageSource) {
//         continue;
//       }

//       try {
//         const imageAsset = imageAssets.get(imageSource);
//         if (!imageAsset) continue;

//         const displaySize = {
//           width: imageMaxWidth,
//           height: imageMaxHeight,
//         };

//         const imageId =
//           workbook.addImage({
//             buffer: imageAsset.buffer,
//             extension: imageAsset.extension,
//           });

//         worksheet.addImage(
//           imageId,
//           {
//             tl: {
//               col: colIndex ,
//               row: i + 2 ,
//             },
//             ext: displaySize,
//             editAs: "oneCell",
//           }
//         );

//       }
//       catch (error) {
//         console.error( "圖片加入失敗：", key, error );
//       }
//     }
//   }

//   const excelBuffer = await workbook.xlsx.writeBuffer();

//   saveAs( new Blob([excelBuffer],{ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx` );

// };

export const exportToExcelWithImage = async (
  data,
  columns,
  filename = "export",
  imageLoader,
) => {
  const imageWidth = 240;
  const imageHeight = 320;
  const dataRowHeight = 240;

  const workbook = new ExcelJS.Workbook();

  const worksheet = workbook.addWorksheet("巡檢紀錄", {
    properties: {
      defaultRowHeight: 14.5,
    },
  });

  /**
   * 移除操作欄
   */
  const filteredColumns = columns.filter(
    (col) => col.header !== "操作"
  );

  /**
   * 前面新增「序號」欄位
   */
  const exportColumns = [
    {
      accessorKey: "__sequence",
      header: "序號",
    },
    ...filteredColumns,
  ];

  /**
   * 圖片欄位
   */
  const imageColumns = [
    "East",
    "West",
    "South",
    "North",
  ];

  /**
   * =========================================================
   * Excel → PDF 列印設定
   * =========================================================
   */
worksheet.pageSetup = {
  orientation: "landscape",

  scale: 28,

  fitToHeight: 0,

  // 左右置中
  horizontalCentered: true,

  // 上下置中
  verticalCentered: true,

  margins: {
    left: 0.1,
    right: 0.1,

    // 邊界仍然維持小
    top: 0.1,
    bottom: 0.1,

    header: 0,
    footer: 0,
  },
};
  /**
   * =========================================================
   * 圖片預載
   * =========================================================
   */
  const imageSources = [
    ...new Set(
      data.flatMap((item) =>
        imageColumns
          .map((key) => item[key])
          .filter(Boolean)
      )
    ),
  ];

  const imageAssets = new Map();

  await mapWithConcurrency(
    imageSources,
    8,
    async (imageSource) => {
      try {
        const isBase64 =
          typeof imageSource === "string" &&
          imageSource.startsWith("data:image/");

        const extension = isBase64
          ? imageSource.match(
              /^data:image\/([a-zA-Z0-9+.-]+);base64,/
            )?.[1] || "jpeg"
          : imageSource
              .split("?")[0]
              .match(/\.([a-zA-Z0-9]+)$/)?.[1] ||
            "jpeg";

        /**
         * Base64
         */
        if (isBase64) {
          imageAssets.set(imageSource, {
            buffer: base64ToUint8Array(imageSource),

            extension:
              extension === "jpg"
                ? "jpeg"
                : extension,
          });

          return;
        }

        /**
         * URL 圖片
         */
        if (!imageLoader) {
          throw new Error("缺少圖片下載方法");
        }

        const imageBlob =
          await imageLoader(imageSource);

        const optimizedBlob =
          await resizeImageForExcel(
            imageBlob,
            imageWidth,
            imageHeight,
          );

        const buffer = new Uint8Array(
          await optimizedBlob.arrayBuffer()
        );

        let optimizedExtension = extension;

        if (optimizedBlob.type === "image/jpeg") {
          optimizedExtension = "jpeg";
        }
        else if (optimizedBlob.type === "image/png") {
          optimizedExtension = "png";
        }
        else if (extension === "jpg") {
          optimizedExtension = "jpeg";
        }

        imageAssets.set(imageSource, {
          buffer,
          extension: optimizedExtension,
        });
      }
      catch (error) {
        console.error(
          "圖片下載失敗：",
          imageSource,
          error
        );

        imageAssets.set(
          imageSource,
          null
        );
      }
    }
  );

  /**
   * =========================================================
   * 共用 Border
   * =========================================================
   */
  const thinBorder = {
    top: {
      style: "thin",
    },
    left: {
      style: "thin",
    },
    bottom: {
      style: "thin",
    },
    right: {
      style: "thin",
    },
  };

  /**
   * =========================================================
   * 找欄位位置
   *
   * Excel column index 從 1 開始
   * =========================================================
   */
  const getColumnIndexByHeader = (header) => {
    const index = exportColumns.findIndex(
      (col) => col.header === header
    );

    return index >= 0
      ? index + 1
      : null;
  };

  /**
   * DeviceID → 裝置名稱
   * DeviceName → 受檢感測器編號
   * StartTime → 巡檢日期
   */
  const deviceIdColumn =
    getColumnIndexByHeader("裝置名稱");

  const deviceNameColumn =
    getColumnIndexByHeader("受檢感測器編號");

  const startTimeColumn =
    getColumnIndexByHeader("巡檢日期");

  /**
   * 找出圖片欄位位置
   */
  const imageColumnIndexes = exportColumns
    .map((col, index) => {
      if (
        imageColumns.includes(
          col.accessorKey
        )
      ) {
        return index + 1;
      }

      return null;
    })
    .filter(Boolean);

  const firstImageColumn =
    imageColumnIndexes.length > 0
      ? Math.min(...imageColumnIndexes)
      : null;

  const lastImageColumn =
    imageColumnIndexes.length > 0
      ? Math.max(...imageColumnIndexes)
      : null;

  /**
   * =========================================================
   * 第一列
   * =========================================================
   */
  const firstRow = worksheet.addRow(
    new Array(exportColumns.length).fill("")
  );

  firstRow.height = 16.65;

  /**
   * 第一列基本樣式
   */
  for (
    let colIndex = 1;
    colIndex <= exportColumns.length;
    colIndex++
  ) {
    const cell =
      firstRow.getCell(colIndex);

    cell.font = {
      name: "Times New Roman",
      size: 10,
      bold: true,
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    cell.border = thinBorder;
  }

  /**
   * =========================================================
   * 第一列欄位名稱
   *
   * DeviceID
   *     ↓
   * 裝置名稱
   *
   * DeviceName
   *     ↓
   * 受檢感測器編號
   *
   * StartTime
   *     ↓
   * 巡檢日期
   * =========================================================
   */
  if (deviceIdColumn) {
    worksheet.getCell(
      1,
      deviceIdColumn
    ).value = "DeviceID";
  }

  if (deviceNameColumn) {
    worksheet.getCell(
      1,
      deviceNameColumn
    ).value = "DeviceName";
  }

  if (startTimeColumn) {
    worksheet.getCell(
      1,
      startTimeColumn
    ).value = "StartTime";
  }

  /**
   * =========================================================
   * Note 區域
   *
   * 巡檢日期後一欄
   * 到影像紀錄前一欄
   *
   * 新版預期：
   *
   * E1:K1
   * =========================================================
   */
  if (
    startTimeColumn &&
    firstImageColumn
  ) {
    const noteStartColumn =
      startTimeColumn + 1;

    const noteEndColumn =
      firstImageColumn - 1;

    if (
      noteStartColumn <=
      noteEndColumn
    ) {
      if (
        noteStartColumn <
        noteEndColumn
      ) {
        worksheet.mergeCells(
          1,
          noteStartColumn,
          1,
          noteEndColumn
        );
      }

      worksheet.getCell(
        1,
        noteStartColumn
      ).value = "Note";

      worksheet.getCell(
        1,
        noteStartColumn
      ).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
    }
  }

  /**
   * =========================================================
   * 影像紀錄
   *
   * 新增序號之後：
   *
   * 原本 K:N
   * 會變成 L:O
   * =========================================================
   */
  if (
    firstImageColumn &&
    lastImageColumn
  ) {
    if (
      firstImageColumn <
      lastImageColumn
    ) {
      worksheet.mergeCells(
        1,
        firstImageColumn,
        1,
        lastImageColumn
      );
    }

    worksheet.getCell(
      1,
      firstImageColumn
    ).value = "影像紀錄";

    worksheet.getCell(
      1,
      firstImageColumn
    ).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
  }

  /**
   * =========================================================
   * 第二列
   *
   * 第一欄會自動變：
   * 序號
   * =========================================================
   */
  const headerRow = worksheet.addRow(
    exportColumns.map(
      (col) => col.header
    )
  );

  headerRow.height = 50;

  for (
    let colIndex = 1;
    colIndex <= exportColumns.length;
    colIndex++
  ) {
    const cell =
      headerRow.getCell(
        colIndex
      );

    cell.font = {
      name: "Times New Roman",
      size:
        colIndex <= 4
          ? 11
          : 10,
      bold: true,
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };

    cell.border = thinBorder;
  }

  /**
   * =========================================================
   * 欄寬
   * =========================================================
   *
   * A  序號
   * B  裝置名稱
   * C  受檢感測器編號
   * D  巡檢日期
   * E:K Note
   * L:O 圖片
   */
  const imageWidths = [
    36.3984375,
    36.3984375,
    36.296875,
    36.5,
  ];

  let currentImageIndex = 0;

  exportColumns.forEach(
    (col, index) => {
      const excelColumn =
        worksheet.getColumn(
          index + 1
        );

      /**
       * 序號
       */
      if (
        col.accessorKey ===
        "__sequence"
      ) {
        excelColumn.width =
          8.796875;

        return;
      }

      /**
       * 裝置名稱
       */
      if (
        col.header ===
        "裝置名稱"
      ) {
        excelColumn.width =
          34.3984375;

        return;
      }

      /**
       * 圖片
       */
      if (
        imageColumns.includes(
          col.accessorKey
        )
      ) {
        excelColumn.width =
          imageWidths[
            currentImageIndex
          ] ?? 36.4;

        currentImageIndex++;

        return;
      }

      /**
       * 其他文字欄
       */
      excelColumn.width = 40;
    }
  );

  /**
   * =========================================================
   * DATA
   * =========================================================
   */
  for (
    let rowIndex = 0;
    rowIndex < data.length;
    rowIndex++
  ) {
    const item =
      data[rowIndex];

    const rowData =
      exportColumns.map(
        (col) => {
          const key =
            col.accessorKey;

          /**
           * 序號
           */
          if (
            key === "__sequence"
          ) {
            return rowIndex + 1;
          }

          /**
           * 圖片欄位不放 URL
           */
          if (
            imageColumns.includes(
              key
            )
          ) {
            return "";
          }

          return item[key] ?? "";
        }
      );

    const row =
      worksheet.addRow(
        rowData
      );

    row.height =
      dataRowHeight;

    /**
     * =======================================================
     * DATA Cell 樣式
     * =======================================================
     */
    for (
      let colIndex = 1;
      colIndex <=
      exportColumns.length;
      colIndex++
    ) {
      const cell =
        row.getCell(
          colIndex
        );

      /**
       * A 序號
       * B 裝置名稱
       * C 受檢感測器編號
       */
      if (
        colIndex === 1 ||
        colIndex === 2 ||
        colIndex === 3
      ) {
        cell.font = {
          name: "Times New Roman",
          size: 11,
        };
      }

      /**
       * 原本 E / F
       * 加入序號後變 F / G
       */
      else if (
        colIndex === 6 ||
        colIndex === 7
      ) {
        cell.font = {
          name: "標楷體",
          size: 10,
        };
      }

      else {
        cell.font = {
          name: "Times New Roman",
          size: 10,
        };
      }

      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };

      cell.border =
        thinBorder;
    }

    /**
     * =======================================================
     * 圖片
     * =======================================================
     */
    for (
      let colIndex = 0;
      colIndex <
      exportColumns.length;
      colIndex++
    ) {
      const key =
        exportColumns[
          colIndex
        ].accessorKey;

      if (
        !imageColumns.includes(
          key
        )
      ) {
        continue;
      }

      const imageSource =
        item[key];

      if (!imageSource) {
        continue;
      }

      try {
        const imageAsset =
          imageAssets.get(
            imageSource
          );

        if (!imageAsset) {
          continue;
        }

        const imageId =
          workbook.addImage({
            buffer:
              imageAsset.buffer,

            extension:
              imageAsset.extension,
          });

        worksheet.addImage(
          imageId,
          {
            tl: {
              /**
               * colIndex 已包含新增的序號欄，
               * 所以圖片會正確往右移一欄。
               */
              col: colIndex,

              row:
                row.number - 1,
            },

            ext: {
              width:
                imageWidth,

              height:
                imageHeight,
            },

            editAs: "oneCell",
          }
        );
      }
      catch (error) {
        console.error(
          "圖片加入失敗：",
          key,
          error
        );
      }
    }
  }

  /**
   * =========================================================
   * Print Area
   *
   * 新增序號後：
   * A:O
   * =========================================================
   */
  if (
    exportColumns.length > 0
  ) {
    const lastColumn =
      worksheet.getColumn(
        exportColumns.length
      ).letter;

    const lastRow =
      worksheet.rowCount;

    worksheet.pageSetup.printArea =
      `A1:${lastColumn}${lastRow}`;
  }

  /**
   * Excel 開啟時縮放
   */
  worksheet.views = [
    {
      state: "normal",
      zoomScale: 70,
      zoomScaleNormal: 70,
    },
  ];

  /**
   * =========================================================
   * EXPORT
   * =========================================================
   */
  const excelBuffer =
    await workbook.xlsx.writeBuffer();

  saveAs(
    new Blob(
      [excelBuffer],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    ),
    `${filename}.xlsx`
  );
};