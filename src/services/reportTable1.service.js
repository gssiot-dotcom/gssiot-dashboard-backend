// services/reportTable1.service.js
const path = require('path');
const AdmZip = require('adm-zip');

const Gateway = require('../schema/Gateway.model');                  // building_id
const AngleNode = require('../schema/Angle.node.model');             // gateway_id, doorNum
const AngleNodeHistory = require('../schema/Angle.node.history.model'); // doorNum, createdAt

// Weather 스키마는 프로젝트마다 다를 수 있어 optional 로드
let Weather = null;
try { Weather = require('../schema/Weather.model'); } catch {}

// 숫자 라운딩 헬퍼
const R = (v, n = 2) => (v === 0 || Number.isFinite(v)) ? Number(Number(v).toFixed(n)) : '-';

/* ======================= 표1 데이터 빌더 ======================= */

/** buildingId → doorNum 배열 */
async function doorNumsOfBuilding(buildingId) {
  const gws = await Gateway.find({ building_id: buildingId }).select('_id').lean();
  const gwIds = gws.map(g => g._id);
  if (!gwIds.length) return [];
  const nodes = await AngleNode.find({ gateway_id: { $in: gwIds } }).select('doorNum').lean();
  return nodes.map(n => Number(n.doorNum)).filter(Number.isFinite);
}

/** 각도 통계 집계 (빌딩 ID 또는 지정 doorNums 사용) */
async function getAngleStats({ t0, t1, buildingId, doorNums }) {
  const base = { createdAt: { $gte: t0, $lte: t1 } };

  let dnums = Array.isArray(doorNums) && doorNums.length ? doorNums : null;
  if (!dnums && buildingId) {
    dnums = await doorNumsOfBuilding(buildingId);
  }

  const match = dnums && dnums.length ? { ...base, doorNum: { $in: dnums } } : base;

  const [a] = await AngleNodeHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        x_min: { $min: '$angle_x' }, x_max: { $max: '$angle_x' }, x_avg: { $avg: '$angle_x' },
        y_min: { $min: '$angle_y' }, y_max: { $max: '$angle_y' }, y_avg: { $avg: '$angle_y' },
      }
    }
  ]);
  return a || {};
}

/** 표1 맵(Weather + Angle) 생성 */
async function buildTable1Map({ t0, t1, buildingId, doorNums }) {
  // 1) Angle
  const a = await getAngleStats({ t0, t1, buildingId, doorNums });
  const angles = {
    VERT_MIN: R(a?.x_min), VERT_MAX: R(a?.x_max), VERT_AVG: R(a?.x_avg),
    HORZ_MIN: R(a?.y_min), HORZ_MAX: R(a?.y_max), HORZ_AVG: R(a?.y_avg),
  };

  // 2) Weather (프로젝트별 필드명 다를 수 있어 기본 필드 가정)
  let weather = {
    TEMP_MIN: '-', TEMP_MAX: '-', TEMP_AVG: '-',
    HUMID_MIN: '-', HUMID_MAX: '-', HUMID_AVG: '-',
    WINDSPD_MIN: '-', WINDSPD_MAX: '-', WINDSPD_AVG: '-',
    WINDDIR_MODE: '-',
  };

  if (Weather) {
    const [aggW] = await Weather.aggregate([
      { $match: { timestamp: { $gte: t0, $lte: t1 } } },
      {
        $facet: {
          stats: [{
            $group: {
              _id: null,
              t_min: { $min: '$temperature' }, t_max: { $max: '$temperature' }, t_avg: { $avg: '$temperature' },
              h_min: { $min: '$humidity' },    h_max: { $max: '$humidity' },    h_avg: { $avg: '$humidity' },
              w_min: { $min: '$wind_speed' },  w_max: { $max: '$wind_speed' },  w_avg: { $avg: '$wind_speed' },
            }
          }],
          wind_mode: [
            { $group: { _id: '$wind_direction', c: { $sum: 1 } } },
            { $sort: { c: -1 } }, { $limit: 1 }
          ]
        }
      }
    ]);

    const s = aggW?.stats?.[0] || {};
    weather = {
      TEMP_MIN: R(s.t_min), TEMP_MAX: R(s.t_max), TEMP_AVG: R(s.t_avg),
      HUMID_MIN: R(s.h_min), HUMID_MAX: R(s.h_max), HUMID_AVG: R(s.h_avg),
      WINDSPD_MIN: R(s.w_min), WINDSPD_MAX: R(s.w_max), WINDSPD_AVG: R(s.w_avg),
      WINDDIR_MODE: aggW?.wind_mode?.[0]?._id ?? '-',
    };
  }

  return { ...weather, ...angles };
}

/* ======================= HWPX 치환 유틸 ======================= */
function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

// 중괄호 엔티티 복원
function restoreCurlyEntities(s) {
  return s.replace(/&#123;/g, '{').replace(/&#125;/g, '}');
}

// {{ R O W 1 _ Z O N E }} 같은 분할 토큰 정규화
function normalizeCurlyTokens(xml) {
  let out = restoreCurlyEntities(xml);
  out = out.replace(/\{\{[\s\S]*?\}\}/g, (m) => {
    let inner = m.slice(2, -2);
    inner = inner.replace(/<[^>]*>/g, '');
    inner = inner.replace(/&nbsp;|&#160;/gi, '');
    inner = inner.replace(/[\u200B-\u200D\uFEFF]/g, '');
    inner = inner.replace(/\s+/g, '');
    inner = inner.replace(/-/g, '');
    inner = inner.toUpperCase();
    return `{{${inner}}}`;
  });
  return out;
}

// 보안: lineSegArray 요소 제거 (네임스페이스/대소문자/셀프클로징 대응)
function stripLineSegArray(xml) {
  // <hp:lineSegArray ...> ... </hp:lineSegArray>  또는 접두사 임의
  xml = xml.replace(/<(?:\w+:)?lineSegArray\b[^>]*>[\s\S]*?<\/(?:\w+:)?lineSegArray>/gi, '');
  // <hp:lineSegArray ... />
  xml = xml.replace(/<(?:\w+:)?lineSegArray\b[^>]*\/>/gi, '');
  return xml;
}

// 다양한 변형 토큰 치환
function replaceTokenAll(xml, key, value) {
  const v = escapeXml(value);
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 정규식 이스케이프
  const patterns = [
    new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi'),
    new RegExp(`&#123;&#123;\\s*${k}\\s*&#125;&#125;`, 'gi'),
    new RegExp(`\\{\\{(?:\\s|<[^>]+>)*${k}(?:\\s|<[^>]+>)*\\}\\}`, 'gi'),
    new RegExp(`&#123;&#123;(?:\\s|<[^>]+>)*${k}(?:\\s|<[^>]+>)*&#125;&#125;`, 'gi'),
  ];
  let out = xml;
  for (const re of patterns) out = out.replace(re, v);
  return out;
}

/** HWPX(zip) 치환(메모리 버퍼 반환) — 구조 변경 없음 */
function fillHwpxZipStrictBuffer(templatePath, map) {
  const src = new AdmZip(path.resolve(templatePath));
  const dst = new AdmZip();

  // 1) 엔트리 구조 그대로 복사
  for (const e of src.getEntries()) {
    dst.addFile(e.entryName, e.getData());
  }

  // 2) 모든 XML에서 보안 필터 + 토큰 정규화 + 치환
  for (const e of dst.getEntries()) {
    if (!e.entryName.toLowerCase().endsWith('.xml')) continue;
    let xml = e.getData().toString('utf8');

    // (A) 보안 필터
    xml = stripLineSegArray(xml);

    // (B) 토큰 정규화
    xml = normalizeCurlyTokens(xml);

    // (C) 치환
    for (const [k, v] of Object.entries(map || {})) {
      xml = replaceTokenAll(xml, String(k).toUpperCase(), String(v ?? ''));
    }

    dst.updateFile(e.entryName, Buffer.from(xml, 'utf8'));
  }

  return dst.toBuffer();
}

module.exports = {
  buildTable1Map,          // ← 표1 데이터 생성
  fillHwpxZipStrictBuffer, // ← 보안 + 정규화 + 치환
};
