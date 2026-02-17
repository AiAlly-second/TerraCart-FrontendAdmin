import * as XLSX from "xlsx";

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

export const buildExcelFileName = (baseName, filterDate) => {
  const safeBase = String(baseName || "report")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
  const today = new Date().toISOString().slice(0, 10);
  const datePart =
    typeof filterDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)
      ? filterDate
      : today;
  return `${safeBase || "report"}-${datePart}.xlsx`;
};

export const exportRowsToExcel = ({ rows, fileName, sheetName = "Report" }) => {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return false;

  const normalizedRows = list.map((row) => {
    const normalized = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      normalized[key] = normalizeCellValue(value);
    });
    return normalized;
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));
  XLSX.writeFile(workbook, fileName || "report.xlsx");
  return true;
};

