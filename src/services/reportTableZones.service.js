// services/reportTableZones.service.js
const mongoose = require('mongoose');
const Gateway = require('../schema/Gateway.model');                  // building_id
const AngleNode = require('../schema/Angle.node.model');             // gateway_id, doorNum, position
const AngleNodeHistory = require('../schema/Angle.node.history.model'); // doorNum, position, createdAt

const O = (id) => new mongoose.Types.ObjectId(id);
const roundOrDash = (v, n = 3) =>
  (v === 0 || Number.isFinite(v)) ? Number(Number(v).toFixed(n)) : '-';

/** 빌딩에 연결된 게이트웨이 ID 목록 */
async function gatewayIdsOfBuilding(buildingId) {
  const rows = await Gateway.find({ building_id: O(buildingId) }).select('_id').lean();
  return rows.map(r => r._id);
}

/** 빌딩 내 설치된 구역(position) 라벨 목록
 *  - 표시용 원본 라벨(display)과 매칭용 정규화 라벨(norm) 모두 보존
 */
async function discoverZones({ buildingId }) {
  const gwIds = await gatewayIdsOfBuilding(buildingId);
  if (!gwIds.length) return [];

  const rows = await AngleNode.aggregate([
    { $match: { gateway_id: { $in: gwIds }, position: { $type: 'string', $ne: '' } } },
    {
      $group: {
        _id: { $toLower: { $trim: { input: '$position' } } }, // norm
        display: { $first: '$position' },                     // 원본
      }
    },
  ]);

  return rows
    .filter(r => r?._id)
    .map(r => ({ norm: r._id, display: r.display }))
    .sort((a, b) => a.norm.localeCompare(b.norm));
}

/** 특정 구역(정규화 라벨)의 doorNum 배열 (빌딩 내에서만) */
async function doorNumsOfZone({ buildingId, zoneNorm }) {
  const gwIds = await gatewayIdsOfBuilding(buildingId);
  if (!gwIds.length) return [];
  const rows = await AngleNode.aggregate([
    { $match: { gateway_id: { $in: gwIds }, position: { $type: 'string', $ne: '' } } },
    { $addFields: { _pos_norm: { $toLower: { $trim: { input: '$position' } } } } },
    { $match: { _pos_norm: zoneNorm } },
    { $group: { _id: '$doorNum' } }, // 중복 제거
  ]);
  return rows
    .map(r => r?._id)
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(Number);
}

/** doorNum 집합으로 History 집계 (createdAt 범위) */
async function aggHistoryByDoorNums({ doorNums, t0, t1 }) {
  if (!Array.isArray(doorNums) || !doorNums.length) return null;
  const [g] = await AngleNodeHistory.aggregate([
    { $match: { doorNum: { $in: doorNums }, createdAt: { $gte: t0, $lte: t1 } } },
    {
      $group: {
        _id: null,
        x_min: { $min: '$angle_x' }, x_max: { $max: '$angle_x' }, x_avg: { $avg: '$angle_x' },
        y_min: { $min: '$angle_y' }, y_max: { $max: '$angle_y' }, y_avg: { $avg: '$angle_y' },
        n: { $sum: 1 },
      }
    },
  ]);
  return g || null;
}

/** 표2 “행 배열” 생성: [{ zone, x_min, x_max, x_avg, y_min, y_max, y_avg, n }, ...] */
async function buildZonesRows({ buildingId, t0, t1 }) {
  const zones = await discoverZones({ buildingId }); // [{ norm, display }]
  const out = [];
  for (const z of zones) {
    const doorNums = await doorNumsOfZone({ buildingId, zoneNorm: z.norm });
    const g = await aggHistoryByDoorNums({ doorNums, t0, t1 });
    out.push({
      zone: z.display,                       // 표에는 원본 라벨을 사용
      x_min: g ? roundOrDash(g.x_min) : '-',
      x_max: g ? roundOrDash(g.x_max) : '-',
      x_avg: g ? roundOrDash(g.x_avg) : '-',
      y_min: g ? roundOrDash(g.y_min) : '-',
      y_max: g ? roundOrDash(g.y_max) : '-',
      y_avg: g ? roundOrDash(g.y_avg) : '-',
      n: g?.n || 0,
    });
  }
  return out;
}

/** ROWi_* 토큰 맵 생성 (템플릿은 충분한 빈 행을 미리 만들어 두세요) */
function buildRowTokenMap(zoneRows, maxRows = Number(process.env.REPORT_ZONES_MAX_ROWS || 40)) {
  const m = {};
  for (let i = 0; i < maxRows; i++) {
    const r = zoneRows[i];
    const n = i + 1;

    // ✅ 남는 행은 모두 빈 문자열로 채워서 '-----'가 안 보이도록 처리
    m[`ROW${n}_ZONE`]  = (r?.zone  ?? '');
    m[`ROW${n}_X_MIN`] = (r?.x_min ?? '');
    m[`ROW${n}_X_MAX`] = (r?.x_max ?? '');
    m[`ROW${n}_X_AVG`] = (r?.x_avg ?? '');
    m[`ROW${n}_Y_MIN`] = (r?.y_min ?? '');
    m[`ROW${n}_Y_MAX`] = (r?.y_max ?? '');
    m[`ROW${n}_Y_AVG`] = (r?.y_avg ?? '');
    m[`ROW${n}_N`]     = (r?.n     ?? '');
  }
  return m;
}

module.exports = {
  gatewayIdsOfBuilding,
  discoverZones,
  doorNumsOfZone,
  aggHistoryByDoorNums,
  buildZonesRows,
  buildRowTokenMap,
};
