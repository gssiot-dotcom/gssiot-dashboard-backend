// services/reportNodesCsv.service.js
const mongoose   = require('mongoose');
const Building   = require('../schema/Building.model');
const Gateway    = require('../schema/Gateway.model');
const AngleNode  = require('../schema/Angle.node.model');
const AngleNodeHistory = require('../schema/Angle.node.history.model');

/** ================= 유틸 ================= */
function pad2(n){ return String(n).padStart(2,'0'); }
function fmtDate(d){ const y=d.getFullYear(), m=pad2(d.getMonth()+1), day=pad2(d.getDate()); return `${y}${m}${day}`; }

// KST 여부에 맞춰 YYYY-MM-DD HH:MM:SS로 표기
function fmtYmdHms(dateLike, useKst=false){
  if (!dateLike) return '';
  const d = new Date(dateLike);
  const t = useKst ? new Date(d.getTime() + 9*3600*1000) : d;   // KST 보정
  const y = useKst ? t.getUTCFullYear()  : t.getFullYear();
  const M = useKst ? t.getUTCMonth()+1   : t.getMonth()+1;
  const D = useKst ? t.getUTCDate()      : t.getDate();
  const h = useKst ? t.getUTCHours()     : t.getHours();
  const m = useKst ? t.getUTCMinutes()   : t.getMinutes();
  const s = useKst ? t.getUTCSeconds()   : t.getSeconds();
  return `${y}-${pad2(M)}-${pad2(D)} ${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function toCsvValue(v){
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
function rowsToCsv(rows){ return rows.map(r => r.map(toCsvValue).join(',')).join('\n'); }

/** 파일명 안전 처리 + RFC5987 (UTF-8) 인코딩 */
function encodeRFC5987ValueChars (str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A')
    .replace(/%(7C|60|5E)/g, '%25$1');
}
function toAsciiSafeFilename(str) {
  return String(str ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:"*?<>|]/g, '_')
    .replace(/"/g, '\'')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
    .replace(/[^\x20-\x7E]/g, '_');
}
function buildContentDisposition(filename) {
  const ascii = toAsciiSafeFilename(filename || 'download.csv');
  const utf8 = encodeRFC5987ValueChars(filename || 'download.csv');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** 날짜 파라미터를 KST 자정 경계로 절단(옵션) */
function toKstDate(dateLike, isEnd = false) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  // UTC 자정으로 맞춘 뒤 -9h => KST 자정과 같은 순간의 UTC 시각
  const k = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (isEnd) k.setUTCDate(k.getUTCDate() + 1);
  k.setUTCHours(k.getUTCHours() - 9);
  return k;
}

// ======= 날짜 범위 보정 헬퍼 =======
function addDaysUTC(d, days){
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}
/**
 * 쿼리에서 안전하게 날짜 범위 계산 (end는 미포함)
 * - useKst=true 이면 KST 자정 기준 절단
 * - end가 없거나 end <= start면 end = start + 1일
 */
function getDateRangeFromQuery({ start, end, useKst }) {
  let startDate, endDate;
  if (useKst) {
    startDate = toKstDate(start) || new Date('1970-01-01T00:00:00Z');
    // KST 모드에서 toKstDate(end, true)는 이미 +1일 처리된 경계(미포함)
    endDate   = end ? toKstDate(end, true) : new Date();
  } else {
    startDate = start ? new Date(start) : new Date('1970-01-01T00:00:00Z');
    endDate   = end ? new Date(end)     : new Date();
    if (!end || endDate <= startDate) endDate = addDaysUTC(startDate, 1);
  }
  if (endDate <= startDate) endDate = addDaysUTC(startDate, 1);
  return { startDate, endDate };
}

/** ================= 조회 ================= */
async function fetchBuilding(buildingId){
  const b = await Building.findById(buildingId).lean();
  if(!b) throw new Error('해당 빌딩을 찾을 수 없습니다.');
  return b;
}
async function fetchGateways(buildingId){
  return await Gateway.find(
    { building_id: new mongoose.Types.ObjectId(buildingId) },
    { _id:1, serial_number:1, zone_name:1 }
  ).lean();
}
async function fetchAngleNodes(gatewayIds){
  if (!gatewayIds?.length) return [];
  return await AngleNode.find(
    { gateway_id: { $in: gatewayIds } },
    { doorNum:1, position:1, gateway_id:1 }
  ).lean();
}

/** ================= CSV 빌더 (요청 포맷 + 중복 제거) =================
 * 출력 컬럼(기본):
 * doorNum, gateway_serial, gateway_zone, node_position, angle_x, angle_y, datetime
 * - datetime: YYYY-MM-DD HH:MM:SS (기본 KST)
 * - 완전 동일 레코드(위 7개 전부)가 중복이면 1개만 남김
 */
async function buildXYWithNodeContextCsv({
  buildingId, startDate, endDate, useKst, filenameBase
}){
  const building = await fetchBuilding(buildingId);
  const safeBuildingName = building.building_name?.trim() || 'building';

  const gateways = await fetchGateways(buildingId);
  const gwIdList = gateways.map(g => g._id);
  const gwMap = new Map(gateways.map(g => [String(g._id), g]));

  const nodes = await fetchAngleNodes(gwIdList);
  const nodeByDoor = new Map(nodes.map(n => [n.doorNum, n]));
  const gwCtxByDoor = new Map(
    nodes.map(n => {
      const gw = gwMap.get(String(n.gateway_id)) || {};
      return [n.doorNum, { serial: gw.serial_number || '', zone: gw.zone_name || '' }];
    })
  );
  const doorNums = nodes.map(n => n.doorNum);

  const rows = [];
  rows.push(['노드 번호','게이트웨이 번호','게이트웨이 위치','노드 위치','X값','Y값','시간']);

  if (!doorNums.length) {
    const csv = rowsToCsv(rows);
    const filename = `${fmtDate(startDate)}-${fmtDate(endDate)}_${safeBuildingName}_${filenameBase}.csv`;
    return { csvBuffer: csv, filename };
  }

  // 중복 제거를 위한 Set (문자열 키)
  const seen = new Set();

  const cursor = AngleNodeHistory
    .find(
      { doorNum: { $in: doorNums }, createdAt: { $gte: startDate, $lt: endDate } },
      { _id:0, doorNum:1, angle_x:1, angle_y:1, createdAt:1 }
    )
    .sort({ doorNum: 1, createdAt: 1 })
    .cursor();

  for await (const h of cursor){
    const node = nodeByDoor.get(h.doorNum) || {};
    const gw   = gwCtxByDoor.get(h.doorNum) || { serial:'', zone:'' };

    const datetime = fmtYmdHms(h.createdAt, !!useKst);
    const rec = [
      h.doorNum,
      gw.serial,
      gw.zone,
      node.position || '',
      h.angle_x ?? '',
      h.angle_y ?? '',
      datetime
    ];

    // 중복 키 구성
    const key = rec.join('|§|');
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push(rec);
  }

  const csv = rowsToCsv(rows);
  const filename = `${fmtDate(startDate)}-${fmtDate(endDate)}_${safeBuildingName}_${filenameBase}.csv`;
  return { csvBuffer: csv, filename };
}

/** ================= Express 핸들러 ================= */
async function nodesCsvHandler(req, res) {
  try {
    const { buildingId } = req.params;
    const { start, end } = req.query;

    // 기본값을 KST로 고정
    const useKst = true;

    const { startDate, endDate } = getDateRangeFromQuery({ start, end, useKst });

    const { csvBuffer, filename } = await buildXYWithNodeContextCsv({
      buildingId, startDate, endDate, useKst, filenameBase: 'nodes.xy'
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', buildContentDisposition(filename));
    res.send(csvBuffer);
  } catch (err) {
    console.error('[nodesCsvHandler] error:', err);
    res.status(500).json({ message: 'nodes csv 생성 중 오류', error: String(err?.message || err) });
  }
}



module.exports = {
  nodesCsvHandler
};