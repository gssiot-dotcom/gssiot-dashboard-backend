// services/reportDailyData.service.js
const { buildTable1Map } = require('./reportTable1.service');
const { buildZonesMap, DEFAULT_ZONES } = require('./reportTableZones.service');

async function buildReportData({
  t0, t1, buildingId, doorNums, zones = DEFAULT_ZONES, headerMap = {}
}) {
  // 표1(날씨/전체 각도): 기존 서비스 재사용
  const table1 = await buildTable1Map({ t0, t1, buildingId, doorNums });

  // 구역 표 데이터 키맵 생성 (Z_* 키들)
  const zonesMap = await buildZonesMap({ t0, t1, buildingId, zones });

  // Z_* 키맵을 표 행 배열로 변환
  const rows = zones.map((z) => {
    const key = z.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    const get = (suffix) => zonesMap[`Z_${key}_${suffix}`];
    return {
      zone: z,
      x_min: get('X_MIN'),
      x_max: get('X_MAX'),
      x_avg: get('X_AVG'),
      y_min: get('Y_MIN'),
      y_max: get('Y_MAX'),
      y_avg: get('Y_AVG'),
      n: get('N'),
    };
  });

  return {
    header: headerMap, // 회사/빌딩/날짜 정보
    table1,            // 필요 시 PDF 템플릿에서 사용 가능
    zones: rows,       // 구역별 표
  };
}

module.exports = { buildReportData };
