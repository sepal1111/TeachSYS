// 點數卡匯入解析工具：支援 CSV 與 Excel (.xlsx) 格式
// 支援多元欄位對應（相容 kyps-scoreboard 的序列號、卡號、分數、卡片圖示等格式）
import ExcelJS from "exceljs";
import { parseCsvLine } from "./fileImport";

export interface ParsedPointCard {
  cardNo?: string;
  code: string;
  label: string;
  score: number;
  image?: string;
}

function normalizeHeader(str: string): string {
  return str.toLowerCase().replace(/[\s_\-（）\(\)]/g, "");
}

function extractCardFromMap(data: Record<string, string>): ParsedPointCard | null {
  const normMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    normMap[normalizeHeader(k)] = String(v ?? "").trim();
  }

  // 卡號 / Code
  const code =
    normMap["卡號"] ||
    normMap["qr內容"] ||
    normMap["qrcode"] ||
    normMap["code"] ||
    normMap["cardcode"] ||
    normMap["條碼"] ||
    "";

  // 分數 / Score / Value
  const scoreRaw =
    normMap["分數"] ||
    normMap["點數"] ||
    normMap["score"] ||
    normMap["value"] ||
    normMap["cardvalue"] ||
    normMap["點數值"] ||
    "";

  if (!code || !scoreRaw || !/^-?\d+$/.test(scoreRaw)) return null;

  // 名稱 / Label
  const label =
    normMap["名稱"] ||
    normMap["卡片名稱"] ||
    normMap["label"] ||
    normMap["name"] ||
    normMap["title"] ||
    code;

  // 序列號 / Card No
  const cardNo =
    normMap["序列號"] ||
    normMap["卡片編號"] ||
    normMap["序號"] ||
    normMap["cardno"] ||
    normMap["no"] ||
    "";

  // 卡片圖示 / Image
  const image =
    normMap["卡片圖示"] ||
    normMap["圖片"] ||
    normMap["圖示"] ||
    normMap["image"] ||
    normMap["cardimage"] ||
    "";

  return {
    code,
    label: label || code,
    score: parseInt(scoreRaw, 10),
    cardNo: cardNo || undefined,
    image: image || undefined,
  };
}

export function parseCsvPointCards(text: string): ParsedPointCard[] {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r\n|\r|\n/);
  const out: ParsedPointCard[] = [];

  let headerMap: string[] | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line).map((c) => c.trim());
    if (row.length < 2) continue;

    // 檢查是否為標題列
    const firstColNorm = normalizeHeader(row[0]);
    if (
      !headerMap &&
      (firstColNorm.includes("卡號") ||
        firstColNorm.includes("qr") ||
        firstColNorm.includes("code") ||
        firstColNorm.includes("序號") ||
        firstColNorm.includes("no") ||
        firstColNorm.includes("名稱"))
    ) {
      headerMap = row;
      continue;
    }

    if (headerMap) {
      const obj: Record<string, string> = {};
      headerMap.forEach((h, idx) => {
        obj[h] = row[idx] ?? "";
      });
      const card = extractCardFromMap(obj);
      if (card) out.push(card);
    } else {
      // 傳統 3 欄格式：QR內容, 名稱, 分數
      if (row.length >= 3 && /^-?\d+$/.test(row[2])) {
        out.push({
          code: row[0],
          label: row[1] || row[0],
          score: parseInt(row[2], 10),
        });
      } else if (row.length >= 2 && /^-?\d+$/.test(row[1])) {
        // 2 欄格式：卡號, 分數
        out.push({
          code: row[0],
          label: row[0],
          score: parseInt(row[1], 10),
        });
      }
    }
  }

  return out;
}

export async function parseExcelPointCards(buffer: Buffer): Promise<ParsedPointCard[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const out: ParsedPointCard[] = [];
  const rows: string[][] = [];

  worksheet.eachRow((row) => {
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      rowValues[colNumber - 1] = String(cell.value ?? "").trim();
    });
    rows.push(rowValues);
  });

  if (rows.length === 0) return [];

  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const r = rows[i];
    const joined = r.map(normalizeHeader).join(",");
    if (joined.includes("卡號") || joined.includes("code") || joined.includes("qr") || joined.includes("分數") || joined.includes("value") || joined.includes("序號")) {
      headerRowIndex = i;
      headers = r;
      break;
    }
  }

  if (headerRowIndex !== -1) {
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? "";
      });
      const card = extractCardFromMap(obj);
      if (card) out.push(card);
    }
  } else {
    // 若無明確標題，嘗試以純欄位順序解析：第 1 欄卡號，第 2 欄名稱，第 3 欄分數
    for (const r of rows) {
      if (r.length >= 3 && /^-?\d+$/.test(r[2])) {
        out.push({
          code: r[0],
          label: r[1] || r[0],
          score: parseInt(r[2], 10),
        });
      } else if (r.length >= 2 && /^-?\d+$/.test(r[1])) {
        out.push({
          code: r[0],
          label: r[0],
          score: parseInt(r[1], 10),
        });
      }
    }
  }

  return out;
}
