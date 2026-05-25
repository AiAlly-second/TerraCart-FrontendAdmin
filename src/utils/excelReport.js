import XLSX from "xlsx-js-style";

const sanitizeSheetName = (value) => {
  const fallback = "Report";
  if (!value) return fallback;
  const cleaned = String(value).replace(/[\\/*?:[\]]/g, "").trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 31);
};

const normalizeCellValue = (value) => {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
  return value;
};

const isIsoDateString = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const buildDatePart = (filterDate) => {
  const today = new Date().toISOString().slice(0, 10);

  if (isIsoDateString(filterDate)) return filterDate;

  if (filterDate && typeof filterDate === "object") {
    const startDate = isIsoDateString(filterDate.startDate)
      ? filterDate.startDate
      : "";
    const endDate = isIsoDateString(filterDate.endDate) ? filterDate.endDate : "";

    if (startDate && endDate) {
      return startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    }
    if (startDate) return `from_${startDate}`;
    if (endDate) return `until_${endDate}`;
  }

  return today;
};

const normalizeMetadataRows = (metadata) => {
  if (!Array.isArray(metadata)) return [];

  return metadata
    .map((entry) => {
      if (Array.isArray(entry)) {
        return [normalizeCellValue(entry[0]), normalizeCellValue(entry[1])];
      }

      if (entry && typeof entry === "object") {
        return [
          normalizeCellValue(entry.label ?? entry.name ?? ""),
          normalizeCellValue(entry.value ?? ""),
        ];
      }

      return ["", normalizeCellValue(entry)];
    })
    .filter(([label, value]) => label !== "" || value !== "");
};

const applyCellStyle = (worksheet, rowIndex, colIndex, style) => {
  const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  if (!worksheet[cellRef]) {
    worksheet[cellRef] = { t: "s", v: "" };
  }
  worksheet[cellRef].s = {
    ...(worksheet[cellRef].s || {}),
    ...style,
  };
};

const getColumnWidth = (header, values) => {
  const maxLength = values.reduce((max, value) => {
    const length = String(value ?? "").length;
    return Math.max(max, length);
  }, String(header ?? "").length);

  return { wch: Math.min(44, Math.max(12, maxLength + 2)) };
};

export const buildExcelFileName = (baseName, filterDate) => {
  const safeBase = String(baseName || "report")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
  const datePart = buildDatePart(filterDate);
  return `${safeBase || "report"}-${datePart}.xlsx`;
};

export const exportRowsToExcel = ({
  rows,
  fileName,
  sheetName = "Report",
  title = "",
  metadata = [],
  total = null,
}) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return false;

  const headers = Array.from(
    list.reduce((keys, row) => {
      Object.keys(row || {}).forEach((key) => keys.add(key));
      return keys;
    }, new Set()),
  );

  const normalizedRows = list.map((row) => {
    const normalized = {};
    headers.forEach((key) => {
      normalized[key] = normalizeCellValue(row?.[key]);
    });
    return normalized;
  });

  const workbook = XLSX.utils.book_new();
  const sheetRows = [];
  const merges = [];
  const metadataRows = normalizeMetadataRows(metadata);

  if (title) {
    sheetRows.push([title]);
    merges.push({
      s: { r: 0, c: 0 },
      e: { r: 0, c: Math.max(headers.length - 1, 0) },
    });
  }

  metadataRows.forEach(([label, value]) => {
    sheetRows.push([label, value]);
  });

  if (title || metadataRows.length > 0) {
    sheetRows.push([]);
  }

  const headerRowIndex = sheetRows.length;
  sheetRows.push(headers);

  const dataStartRowIndex = sheetRows.length;
  normalizedRows.forEach((row) => {
    sheetRows.push(headers.map((header) => row[header]));
  });
  const dataEndRowIndex = Math.max(dataStartRowIndex, sheetRows.length - 1);

  let totalRowIndex = null;
  if (total) {
    const totalRow = Array(headers.length).fill("");
    const amountIndex = Math.max(
      0,
      headers.indexOf(total.column || "Total Amount (Rs)"),
    );
    const labelEndIndex = Math.max(0, amountIndex - 1);

    sheetRows.push([]);
    totalRowIndex = sheetRows.length;
    totalRow[0] = total.label || "Total";
    totalRow[amountIndex] = Number(total.value) || 0;
    sheetRows.push(totalRow);

    if (labelEndIndex > 0) {
      merges.push({
        s: { r: totalRowIndex, c: 0 },
        e: { r: totalRowIndex, c: labelEndIndex },
      });
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet["!cols"] = headers.map((header) =>
    getColumnWidth(
      header,
      normalizedRows.map((row) => row[header]),
    ),
  );
  worksheet["!merges"] = merges;
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: dataEndRowIndex, c: Math.max(headers.length - 1, 0) },
    }),
  };

  if (title) {
    applyCellStyle(worksheet, 0, 0, {
      font: { bold: true, sz: 16, color: { rgb: "111827" } },
      fill: { fgColor: { rgb: "DBEAFE" } },
      alignment: { horizontal: "center" },
    });
  }

  metadataRows.forEach((_row, index) => {
    const rowIndex = (title ? 1 : 0) + index;
    applyCellStyle(worksheet, rowIndex, 0, {
      font: { bold: true, color: { rgb: "374151" } },
    });
  });

  headers.forEach((_header, colIndex) => {
    applyCellStyle(worksheet, headerRowIndex, colIndex, {
      font: { bold: true, color: { rgb: "111827" } },
      fill: { fgColor: { rgb: "E5E7EB" } },
      alignment: { horizontal: "center" },
    });
  });

  const moneyColumns = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => /amount|price|total/i.test(header));

  for (let rowIndex = dataStartRowIndex; rowIndex <= dataEndRowIndex; rowIndex += 1) {
    moneyColumns.forEach(({ index }) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: index });
      if (worksheet[cellRef] && typeof worksheet[cellRef].v === "number") {
        worksheet[cellRef].z = "#,##0.00";
      }
    });
  }

  if (totalRowIndex !== null) {
    for (let colIndex = 0; colIndex < headers.length; colIndex += 1) {
      applyCellStyle(worksheet, totalRowIndex, colIndex, {
        font: { bold: true, color: { rgb: "111827" } },
        fill: { fgColor: { rgb: "FEF3C7" } },
      });
    }

    const amountIndex = Math.max(
      0,
      headers.indexOf(total.column || "Total Amount (Rs)"),
    );
    const amountCellRef = XLSX.utils.encode_cell({
      r: totalRowIndex,
      c: amountIndex,
    });
    if (worksheet[amountCellRef]) {
      worksheet[amountCellRef].z = "#,##0.00";
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));
  XLSX.writeFile(workbook, fileName || "report.xlsx");
  return true;
};

