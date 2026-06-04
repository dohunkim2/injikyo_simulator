import type { AdminConversationExport } from "./db";
import type { AdminSessionDetail, RubricFeedbackItem } from "./types";

const RUBRIC_ITEM_MAX_SCORE = 10;
const SVG_WIDTH = 1200;
const PADDING = 56;

type ZipEntry = {
  path: string;
  content: string | Uint8Array;
};

export type AdminInbodyImageExport = {
  archive: Uint8Array;
  imageCount: number;
  skippedCount: number;
};

export function buildAdminInbodyImageZip(data: AdminConversationExport): AdminInbodyImageExport {
  const imageEntries: ZipEntry[] = [];
  const manifestRows: string[][] = [
    ["team", "playerId", "nickname", "character", "runId", "grade", "score", "maxScore", "startedAt", "file"],
  ];

  for (const session of data.sessions) {
    if (!session.feedback) {
      continue;
    }

    const teamName = session.nickname || session.playerId;
    const folderName = sanitizePathSegment(`${teamName}_${shortId(session.playerId)}`);
    const fileName = sanitizePathSegment(
      `${session.characterName}_${formatFileDate(session.startedAt)}_${shortId(session.runId)}.svg`,
    );
    const path = `inbody-images/${folderName}/${fileName}`;
    const scores = getRubricTotals(session.feedback.rubricScores);

    imageEntries.push({
      path,
      content: renderInbodySvg(session),
    });
    manifestRows.push([
      teamName,
      session.playerId,
      session.nickname,
      session.characterName,
      session.runId,
      session.feedback.grade ?? "",
      formatScore(scores.total),
      formatScore(scores.max),
      session.startedAt,
      path,
    ]);
  }

  const skippedCount = data.sessionCount - imageEntries.length;
  const entries: ZipEntry[] = [
    {
      path: "README.txt",
      content: [
        "관리자 인바디 이미지 내보내기",
        `내보낸 시각: ${data.exportedAt}`,
        `전체 세션 수: ${data.sessionCount}`,
        `이미지 생성 수: ${imageEntries.length}`,
        `인바디 미저장으로 건너뛴 세션 수: ${skippedCount}`,
        "",
        "파일은 팀/닉네임별 폴더에 SVG 이미지로 저장됩니다.",
      ].join("\n"),
    },
    {
      path: "manifest.csv",
      content: manifestRows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
    },
    ...imageEntries,
  ];

  return {
    archive: createZip(entries),
    imageCount: imageEntries.length,
    skippedCount,
  };
}

function renderInbodySvg(session: AdminSessionDetail) {
  const feedback = session.feedback;

  if (!feedback) {
    throw new Error("인바디 결과가 없는 세션입니다.");
  }

  const rubricScores = feedback.rubricScores?.map(normalizeRubricItemToTen) ?? [];
  const totals = getRubricTotals(feedback.rubricScores);
  const ratio = totals.max > 0 ? Math.round((totals.total / totals.max) * 100) : 0;
  const parts: string[] = [];
  let y = PADDING;

  const push = (value: string) => parts.push(value);

  push(`<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" viewBox="0 0 ${SVG_WIDTH} {{HEIGHT}}">`);
  push(`<rect width="${SVG_WIDTH}" height="{{HEIGHT}}" rx="36" fill="#f8fafc"/>`);
  push(`<rect x="24" y="24" width="${SVG_WIDTH - 48}" height="{{HEIGHT_MINUS_48}}" rx="32" fill="#ffffff"/>`);

  push(`<text x="${PADDING}" y="${y}" fill="#94a3b8" font-size="18" font-weight="700" letter-spacing="5">CONVERSATION INBODY</text>`);
  y += 44;
  push(`<text x="${PADDING}" y="${y}" fill="#0f172a" font-size="42" font-weight="900">${escapeXml(session.nickname)}</text>`);
  y += 34;
  push(`<text x="${PADDING}" y="${y}" fill="#475569" font-size="22">${escapeXml(session.characterName)} · ${escapeXml(formatDateTime(session.startedAt))}</text>`);

  push(`<rect x="910" y="54" width="210" height="148" rx="28" fill="#0f172a"/>`);
  push(`<text x="1015" y="118" fill="#ffffff" font-size="64" font-weight="900" text-anchor="middle">${escapeXml(feedback.grade ?? "-")}</text>`);
  push(`<text x="1015" y="158" fill="#cbd5e1" font-size="22" font-weight="700" text-anchor="middle">${escapeXml(formatScore(totals.total))}/${escapeXml(formatScore(totals.max))}</text>`);
  push(`<text x="1015" y="188" fill="#94a3b8" font-size="18" text-anchor="middle">${ratio}%</text>`);

  y += 48;
  y = renderSummaryCard(push, y, "요약", feedback.summary || "저지 평가 결과");
  y = renderInfoGrid(push, y, [
    ["상태", session.success ? "성공" : "실패"],
    ["최종 호감도", `${session.finalAffection}`],
    ["사용 턴", `${session.turnsUsed}`],
    ["메시지", `${session.messageCount}`],
  ]);

  if (feedback.judgeComment) {
    y = renderSummaryCard(push, y, "Judge", feedback.judgeComment, "#ecfeff", "#155e75");
  }

  y = renderTwoColumnText(push, y, "Best Line", feedback.bestLine || "기록 없음", "Worst Line", feedback.worstLine || "기록 없음");

  if (rubricScores.length > 0) {
    y = renderSectionTitle(push, y, "루브릭 점수");
    for (const item of rubricScores) {
      y = renderRubricRow(push, y, item);
    }
  }

  y = renderTwoColumnList(push, y, "강점", feedback.strengths ?? [], "개선 포인트", feedback.improvements ?? []);

  y += PADDING;
  push("</svg>");

  const height = Math.max(900, y);
  return parts.join("\n").replaceAll("{{HEIGHT}}", `${height}`).replaceAll("{{HEIGHT_MINUS_48}}", `${height - 48}`);
}

function renderSectionTitle(push: (value: string) => void, y: number, title: string) {
  const nextY = y + 38;
  push(`<text x="${PADDING}" y="${nextY}" fill="#0f172a" font-size="24" font-weight="900">${escapeXml(title)}</text>`);
  return nextY + 20;
}

function renderSummaryCard(
  push: (value: string) => void,
  y: number,
  title: string,
  content: string,
  fill = "#f1f5f9",
  color = "#334155",
) {
  const lines = wrapText(content, 58, 5);
  const height = 72 + lines.length * 30;
  push(`<rect x="${PADDING}" y="${y}" width="${SVG_WIDTH - PADDING * 2}" height="${height}" rx="24" fill="${fill}"/>`);
  push(`<text x="${PADDING + 28}" y="${y + 38}" fill="#64748b" font-size="17" font-weight="800">${escapeXml(title)}</text>`);
  lines.forEach((line, index) => {
    push(`<text x="${PADDING + 28}" y="${y + 78 + index * 30}" fill="${color}" font-size="24" font-weight="700">${escapeXml(line)}</text>`);
  });
  return y + height + 22;
}

function renderInfoGrid(push: (value: string) => void, y: number, items: Array<[string, string]>) {
  const gap = 16;
  const width = (SVG_WIDTH - PADDING * 2 - gap * (items.length - 1)) / items.length;
  const height = 118;

  items.forEach(([label, value], index) => {
    const x = PADDING + index * (width + gap);
    push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="#f8fafc" stroke="#e2e8f0"/>`);
    push(`<text x="${x + 24}" y="${y + 42}" fill="#94a3b8" font-size="18" font-weight="700">${escapeXml(label)}</text>`);
    push(`<text x="${x + 24}" y="${y + 86}" fill="#0f172a" font-size="34" font-weight="900">${escapeXml(value)}</text>`);
  });

  return y + height + 22;
}

function renderTwoColumnText(
  push: (value: string) => void,
  y: number,
  leftTitle: string,
  leftText: string,
  rightTitle: string,
  rightText: string,
) {
  const gap = 20;
  const width = (SVG_WIDTH - PADDING * 2 - gap) / 2;
  const leftLines = wrapText(leftText, 31, 5);
  const rightLines = wrapText(rightText, 31, 5);
  const height = 76 + Math.max(leftLines.length, rightLines.length) * 28;

  renderTextBox(push, PADDING, y, width, height, leftTitle, leftLines);
  renderTextBox(push, PADDING + width + gap, y, width, height, rightTitle, rightLines);

  return y + height + 22;
}

function renderTextBox(
  push: (value: string) => void,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  lines: string[],
) {
  push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="#ffffff" stroke="#e2e8f0"/>`);
  push(`<text x="${x + 24}" y="${y + 38}" fill="#64748b" font-size="17" font-weight="800">${escapeXml(title)}</text>`);
  lines.forEach((line, index) => {
    push(`<text x="${x + 24}" y="${y + 76 + index * 28}" fill="#334155" font-size="21">${escapeXml(line)}</text>`);
  });
}

function renderRubricRow(push: (value: string) => void, y: number, item: RubricFeedbackItem) {
  const lines = wrapText(item.criteria || item.comment || item.evidence || "", 76, 2);
  const height = 104 + lines.length * 24;
  const scoreRatio = Math.min(100, Math.max(0, (item.score / RUBRIC_ITEM_MAX_SCORE) * 100));
  const barWidth = SVG_WIDTH - PADDING * 2 - 48;

  push(`<rect x="${PADDING}" y="${y}" width="${SVG_WIDTH - PADDING * 2}" height="${height}" rx="24" fill="#ffffff" stroke="#e2e8f0"/>`);
  push(`<text x="${PADDING + 24}" y="${y + 38}" fill="#0f172a" font-size="22" font-weight="900">${escapeXml(item.label)}</text>`);
  push(`<text x="${SVG_WIDTH - PADDING - 24}" y="${y + 38}" fill="#0f172a" font-size="22" font-weight="900" text-anchor="end">${escapeXml(formatScore(item.score))}/10</text>`);
  push(`<rect x="${PADDING + 24}" y="${y + 58}" width="${barWidth}" height="14" rx="7" fill="#e2e8f0"/>`);
  push(`<rect x="${PADDING + 24}" y="${y + 58}" width="${(barWidth * scoreRatio) / 100}" height="14" rx="7" fill="#2563eb"/>`);
  lines.forEach((line, index) => {
    push(`<text x="${PADDING + 24}" y="${y + 100 + index * 24}" fill="#64748b" font-size="18">${escapeXml(line)}</text>`);
  });

  return y + height + 16;
}

function renderTwoColumnList(
  push: (value: string) => void,
  y: number,
  leftTitle: string,
  leftItems: string[],
  rightTitle: string,
  rightItems: string[],
) {
  const leftLines = listToLines(leftItems, 34, 6);
  const rightLines = listToLines(rightItems, 34, 6);
  const gap = 20;
  const width = (SVG_WIDTH - PADDING * 2 - gap) / 2;
  const height = 76 + Math.max(leftLines.length, rightLines.length, 1) * 28;

  renderTextBox(push, PADDING, y, width, height, leftTitle, leftLines.length > 0 ? leftLines : ["기록 없음"]);
  renderTextBox(
    push,
    PADDING + width + gap,
    y,
    width,
    height,
    rightTitle,
    rightLines.length > 0 ? rightLines : ["기록 없음"],
  );

  return y + height + 22;
}

function listToLines(items: string[], maxChars: number, maxLines: number) {
  return items.flatMap((item) => wrapText(`• ${item}`, maxChars, maxLines)).slice(0, maxLines);
}

function wrapText(value: string, maxChars: number, maxLines = Number.POSITIVE_INFINITY) {
  const source = value.replace(/\s+/g, " ").trim();
  if (!source) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const char of Array.from(source)) {
    current += char;
    if (Array.from(current).length >= maxChars) {
      lines.push(current.trim());
      current = "";
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  if (lines.length > maxLines) {
    const next = lines.slice(0, maxLines);
    next[next.length - 1] = `${next[next.length - 1].slice(0, Math.max(0, maxChars - 1))}…`;
    return next;
  }

  return lines;
}

function getRubricTotals(items?: RubricFeedbackItem[]) {
  const scores = items?.map(normalizeRubricItemToTen) ?? [];
  return {
    total: scores.reduce((sum, item) => sum + item.score, 0),
    max: scores.reduce((sum, item) => sum + item.points, 0),
  };
}

function normalizeRubricItemToTen(item: RubricFeedbackItem): RubricFeedbackItem {
  const score =
    item.points > 0 && item.points !== RUBRIC_ITEM_MAX_SCORE
      ? (item.score / item.points) * RUBRIC_ITEM_MAX_SCORE
      : item.score;

  return {
    ...item,
    points: RUBRIC_ITEM_MAX_SCORE,
    score: Math.round(Math.min(RUBRIC_ITEM_MAX_SCORE, Math.max(0, score)) * 10) / 10,
  };
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const data = typeof entry.content === "string" ? Buffer.from(entry.content, "utf8") : Buffer.from(entry.content);
    const crc = crc32(data);
    const { time, date } = getDosDateTime(new Date());

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

const CRC_TABLE = makeCrcTable();

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(value: Date) {
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  };
}

function formatScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatDateTime(value: string | number | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatFileDate(value: string | number | null) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().replace(/[:.]/g, "-");
}

function sanitizePathSegment(value: string) {
  const sanitized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  return sanitized || "unknown";
}

function shortId(value: string) {
  return value.length > 10 ? value.slice(0, 8) : value;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
