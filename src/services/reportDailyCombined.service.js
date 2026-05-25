// services/reportDailyCombined.service.js
const path = require('path');
const fs = require('fs');
const Building = require('../schema/Building.model');
const { buildTable1Map, fillHwpxZipStrictBuffer } = require('./reportTable1.service');
const { buildZonesRows, buildRowTokenMap } = require('./reportTableZones.service');

const MAX_ROWS = Number(process.env.REPORT_ZONES_MAX_ROWS || 40);

function formatYMD(d) {
  if (!d) return '';
  const dt = (d instanceof Date) ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getBuildingHeaderById(buildingId) {
  let name = '';
  let addr = '';
  if (!buildingId) return { name, addr };
  try {
    const b = await Building.findById(buildingId)
      .select('company_name company building_name name building_addr address addr')
      .lean();
    if (b) {
      name =
        b.company_name ??
        (b.company && (b.company.name ?? b.company)) ??
        b.name ??
        b.building_name ??
        '';
      addr = b.building_addr ?? b.address ?? b.addr ?? '';
    }
  } catch {}
  return { name, addr };
}

function withAliases(value, aliases) {
  const o = {};
  for (const k of aliases) o[k] = value ?? '';
  return o;
}

/**
 * - {{name}} / {{add}} / {{date}} 전부 다양한 별칭까지 함께 채움
 *   name:  NAME, name, REPORT_NAME, ReportName, report_name, reportName
 *   add :  ADD, add, ADDRESS, Address, address, report_addr, reportAddr
 *   date:  DATE, date, REPORT_DATE, ReportDate, REPORTDATE, report_date, reportDate
 */
async function buildDailyHwpxBuffer({
  t0, t1, buildingId, doorNums,
  templatePath = path.join(process.cwd(), 'REPORT_TEMPLATES', 'daily_report.hwpx'),
  extraMap = {},
  dateLabel,   // 라우트에서 label 전달(단일: YYYY-MM-DD, 기간: YYYY-MM-DD~YYYY-MM-DD)
}) {
  const { name, addr } = await getBuildingHeaderById(buildingId);
  const dateText = dateLabel ? String(dateLabel) : formatYMD(t0);

  // 헤더 기본 맵 + 별칭
  const headerMap = {
    ...withAliases(name, ['NAME','name','REPORT_NAME','ReportName','report_name','reportName']),
    ...withAliases(addr,  ['ADD','add','ADDRESS','Address','address','report_addr','reportAddr']),
    ...withAliases(dateText, ['DATE','date','REPORT_DATE','ReportDate','REPORTDATE','report_date','reportDate']),
  };

  const table1Map = await buildTable1Map({ t0, t1, buildingId, doorNums });
  const rows = await buildZonesRows({ buildingId, t0, t1 });
  const rowMap = buildRowTokenMap(rows, MAX_ROWS);

  const merged = { ...headerMap, ...extraMap, ...table1Map, ...rowMap };

  const absTpl = path.resolve(templatePath);
  if (!fs.existsSync(absTpl)) throw new Error(`템플릿 파일을 찾을 수 없습니다: ${absTpl}`);

  return fillHwpxZipStrictBuffer(absTpl, merged);
}

module.exports = { buildDailyHwpxBuffer };
