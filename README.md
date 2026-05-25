# README
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
작성일: **2025-10-31**

이 문서는 빌딩 단위 게이트웨이–센서(도어/각도) 데이터를 수집·보정·저장하고, 임계치(Alert)·리포트(HWPX/CSV)·대시보드 실시간 표시를 제공하는 **Node.js 기반**의 `README.md`입니다.

---

## 1) 개요

### 시스템 개요
- 게이트웨이가 발행하는 센서 데이터를 **MQTT**로 수집하고, 필요 시 **보정** 후 **MongoDB**에 저장합니다.  
- **Alert 서비스**가 각도 임계치를 검사하여 **알림 로그**를 남기고, **Socket.IO**로 대시보드에 실시간 브로드캐스트합니다.  
- **외부 연동**: Nominatim(지오코딩), OpenWeatherMap(날씨)  
- **리포트**: 기간/빌딩 기준 통계를 바탕으로 **HWPX 템플릿 채움** 및 **CSV 내보내기**

### 아키텍처 (텍스트 다이어그램)
```
┌─────────────── 현장(빌딩) ───────────────┐
│  [각도 노드/도어 노드] ──► [게이트웨이]  │
└───────────────┬─────────────────────────┘
                │ MQTT (ingest)
                ▼
         ┌──────────────────┐
         │  MQTT Broker(*)  │   (*외부/내부 구성)
         └────────┬─────────┘
                  │ subscribe
                  ▼
          ┌──────────────────────┐
          │  Node.js (Express)   │
          │  - Routes/Controllers│
          │  - Services          │
          │  - Socket.IO         │
          └───────┬───────┬──────┘
              save/agg    │ push
                          │
                          ▼
                  ┌──────────────┐
                  │  Web Clients │  (대시보드)
                  └──────────────┘
                          │
                          ▼
        ┌─────────────────────────────┐
        │         MongoDB             │
        │     (Models/Schemas)        │
        └─────────────────────────────┘

외부 API
├─ 지오코딩: Nominatim  → 주소 → (lat,lon)
└─ 날씨: OpenWeatherMap → 현재날씨(온/습/풍속/풍향)

배치/유틸
├─ Heartbeat Job: lastSeen → alive 갱신
└─ Report Engine: HWPX/CSV 생성
```

---

## 2) 기술 스택

- **Backend**: Node.js (Express)  
- **DB**: MongoDB (Mongoose)  
- **메시징/실시간**: MQTT, Socket.IO  
- **외부 연동**: Nominatim(지오코딩), OpenWeatherMap(날씨)  
- **리포트**: HWPX 템플릿 채움, CSV Export  
- **배치**: Heartbeat(생존 갱신), 날씨 수집 등

---

## 3) 핵심 데이터 흐름

- **수집**: 게이트웨이가 센서 값을 MQTT로 발행 → `Mqtt.service`가 구독/파싱  
- **처리**: (선택) 보정 적용 → 히스토리 저장 → `Alert.service` 임계치 검사  
- **전달**: `Socket.service`가 빌딩별 채널로 브로드캐스트, Alert 로그 기록  
- **날씨/지오코딩**: 주소 → 좌표(Nominatim) → OWM 현재 날씨 저장 → 리포트/대시보드 사용  
- **리포트**: 기간·빌딩 기준 통계(각도/날씨)로 HWPX/CSV 생성 후 응답

---

## 4) 디렉터리 & 파일 목록

```
schema/
  AlertLog.model.js
  Angle.Calibration.model.js
  Angle.node.history.model.js
  Angle.node.model.js
  Building.model.js
  Company.model.js
  Gateway.model.js
  History.model.js
  Node.model.js
  Otp.model.js
  User.model.js
  Weather.model.js

routes/
  Product.route.js
  User.route.js
  alertLog.routes.js
  angleCalibration.routes.js
  angleHistory.routes.js
  angleNode.routes.js
  compnay.route.js
  report.daily.routes.js
  report.nodes.csv.routes.js
  reportTable1.routes.js
  weather.routes.js

services/
  Alert.service.js
  Mqtt.service.js
  Socket.service.js
  Telegrambot.service.js
  company.service.js
  file.service.js
  geocode.service.js
  heartBeat.service.js
  product.service.js
  reportDailyCombined.service.js
  reportDailyData.service.js
  reportNodesCsv.service.js
  reportTable1.service.js
  reportTableZones.service.js
  user.service.js
  weatherIngest.service.js

controllers/
  alertLog.controller.js
  company-controller.js
  product-controller.js
  user-controller.js
  weather.controller.js
```

---

## 5) 도메인 모델 (Schemas)

- `AlertLog.model.js` — 알림 로그(빌딩/게이트웨이/노드·레벨·임계치·메트릭)
- `Angle.Calibration.model.js` — 각도 센서 보정(수집 상태·오프셋·샘플 수 등)
- `Angle.node.history.model.js` — 각도 센서 히스토리(보정 적용 값)
- `Angle.node.model.js` — 각도 센서 노드(문 번호, 원본/보정 각도, 위치, 생존 상태)
- `Building.model.js` — 빌딩 정보(주소·게이트웨이 세트·알람 레벨 등)
- `Company.model.js` — 고객사(건물 목록·담당자·상태)
- `Gateway.model.js` — 게이트웨이(시리얼·노드/각도노드 목록·생존 여부·빌딩 연결)
- `History.model.js` — 일반 도어 노드 이벤트 히스토리(doorChk 등)
- `Node.model.js` — 일반 도어 노드(doorChk·betChk·게이트웨이 연결)
- `Otp.model.js` — 비밀번호 재설정용 OTP 저장
- `User.model.js` — 사용자(이메일·휴대폰·권한·텔레그램 ID)
- `Weather.model.js` — 빌딩별 날씨(온도·습도·풍속·풍향·타임스탬프)

---

## 6) 서비스 (Services)

- `Alert.service.js` — **각도 X축 기준 임계치 판정** 및 `AlertLog` 저장  
- `Mqtt.service.js` — MQTT 연결/구독, 노드/각도 데이터 처리, **보정/히스토리/알림 연계**  
- `Socket.service.js` — 수신 데이터 빌딩별 **Socket.IO 토픽 브로드캐스트**  
- `Telegrambot.service.js` — (예시) 텔레그램 계정 연동 및 알림 발송  
- `company.service.js` — 빌딩/고객사 CRUD, 게이트웨이 상태 갱신, **OFFICE_GATEWAY 깨우기**, 이미지/알람 레벨 업데이트  
- `file.service.js` — 업로드 파일 저장/삭제(디렉터리 생성·인코딩 처리)  
- `geocode.service.js` — 주소→좌표(Nominatim) **지오코딩 및 캐시**  
- `heartBeat.service.js` — `lastSeen` 기준 게이트웨이/각도노드 **alive** 일괄 갱신(주기 작업)  
- `product.service.js` — 노드/각도노드/게이트웨이 생성·조합·MQTT 발행·**엑셀 리포트** 등  
- `reportDailyCombined.service.js` — **표1 + 구역 표** 데이터 병합하여 **HWPX 템플릿 채움**  
- `reportDailyData.service.js` — 표1·구역 표용 내부 데이터 맵 조립  
- `reportNodesCsv.service.js` — 각도 이력 **CSV 생성**(중복 제거·파일명 안전화·빌딩/구역/게이트웨이 정보 포함)  
- `reportTable1.service.js` — 기간/빌딩 기준 **각도·날씨 통계 집계** 및 HWPX 토큰 치환  
- `reportTableZones.service.js` — 빌딩 내 **zone 탐색/doorNum 집계** 및 구역별 통계·토큰 맵  
- `user.service.js` — 회원 관리(가입/로그인/권한/삭제) 및 **OTP 기반 비번 재설정 메일**  
- `weatherIngest.service.js` — 빌딩 주소 지오코딩 → OWM 호출 → `Weather` 저장(로깅/쿼터 보호)

---

## 7) API Reference (Routes)

> 베이스 URL 예시: `https://{host}/api`

### Product.route.js

| No | Method | Path                         | 설명 |
|---:|:------:|------------------------------|------|
| 1  | POST   | `/create-nodes`              | 노드 생성 |
| 2  | POST   | `/create-gateway`            | 게이트웨이 생성 |
| 3  | POST   | `/create-office-gateway`     | 오피스 게이트웨이 생성 |
| 4  | GET    | `/wake-up-gateway`           | 오피스 게이트웨이 깨우기 |
| 5  | POST   | `/create-angle-nodes`        | 각도 노드 생성 |
| 6  | GET    | `/get-gateways`              | 게이트웨이 목록 |
| 7  | GET    | `/get-active-gateways`       | 활성 게이트웨이 목록 |
| 8  | GET    | `/get-single-gateway/:number`| 단일 게이트웨이 조회 |
| 9  | GET    | `/get-nodes`                 | 노드 목록 |
| 10 | GET    | `/get-active-nodes`          | 활성 노드 목록 |
| 11 | GET    | `/get-active-angle-nodes`    | 활성 각도 노드 목록 |
| 12 | GET    | `/download-nodes-history`    | 노드 이력 다운로드 |
| 13 | POST   | `/update-product`            | 제품 상태 업데이트 |
| 14 | POST   | `/delete-product`            | 제품 삭제 |
| 15 | POST   | `/set-node-position`         | 노드 위치 업로드(XLS) |
| 16 | POST   | `/combine-angle-nodes`       | 각도 노드 ↔ 게이트웨이 매핑 |
| 17 | GET    | `/angle-node/data`           | 각도 노드 그래픽 데이터 |
| 18 | PUT    | `/gateway/zone-name`         | 게이트웨이 존명 설정 |
| 19 | PUT    | `/angle-node/position`       | 각도 노드 위치 설정 |

### User.route.js

| No | Method | Path                 | 설명 |
|---:|:------:|----------------------|------|
| 1  | POST   | `/register`          | 회원 가입 |
| 2  | POST   | `/login`             | 로그인 |
| 3  | POST   | `/update-user-types` | 권한 업데이트 |
| 4  | POST   | `/delete-user`       | 사용자 삭제 |
| 5  | POST   | `/reset-password`    | 비번 재설정 요청(OTP) |
| 6  | POST   | `/password-verify`   | 비번 재설정 검증 |
| 7  | GET    | `/check-user`        | 로그인 상태 확인 |
| 8  | GET    | `/logout`            | 로그아웃 |
| 9  | GET    | `/get-users`         | 사용자 목록 |

### alertLog.routes.js
- 컨트롤러에서 사용 노출용 파일

### angleCalibration.routes.js

| No | Method | Path                           | 설명 |
|---:|:------:|--------------------------------|------|
| 1  | POST   | `/angles/calibration/start-all`| 전체 각도 보정 시작 |
| 2  | POST   | `/angles/calibration/cancel-all`| 전체 각도 보정 취소 |
| 3  | GET    | `/angles/calibration`          | 보정 상태 조회 |

### angleHistory.routes.js

| No | Method | Path                    | 설명 |
|---:|:------:|-------------------------|------|
| 1  | GET    | `/angles/history/latest`| 최신 각도 히스토리 |

### angleNode.routes.js

| No | Method | Path            | 설명 |
|---:|:------:|-----------------|------|
| 1  | GET    | `/alive`        | 각도 노드 생존 목록 |
| 2  | GET    | `/:doorNum/alive`| 문 번호별 생존 |

### compnay.route.js *(오탈자 주의: compnay → company 권장)*

| No | Method | Path                                   | 설명 |
|---:|:------:|----------------------------------------|------|
| 1  | POST   | `/create-building`                     | 빌딩 생성 |
| 2  | GET    | `/get-active-buildings`                | 활성 빌딩 목록 |
| 3  | GET    | `/get-buildings`                       | 빌딩 목록 |
| 4  | GET    | `/buildings/:id`                       | 빌딩 노드 조회 |
| 5  | GET    | `/buildings/:id/angle-nodes`           | 빌딩 각도 노드 |
| 6  | GET    | `/buildings/:id/angle-nodes/summary`   | 각도 노드 요약 |
| 7  | DELETE | `/delete/building/:buildingId`         | 빌딩 삭제 |
| 8  | PUT    | `/building/set-alarm-level`            | 알람 레벨 설정 |
| 9  | POST   | `/create-client`                       | 고객사 생성 |
| 10 | GET    | `/clients`                             | 고객사 목록 |
| 11 | GET    | `/clients/:id`                         | 고객사 조회 |
| 12 | DELETE | `/delete/client/:clientId`             | 고객사 삭제 |
| 13 | POST   | `/boss-clients`                        | 상위 고객사 조회 |
| 14 | POST   | `/gateway/wake_up`                     | 오피스 게이트웨이 깨우기 |
| 15 | PUT    | `/upload-company-plan`                 | 도면/이미지 업로드 |

### report.daily.routes.js

| No | Method | Path                    | 설명 |
|---:|:------:|-------------------------|------|
| 1  | GET    | `/api/reports/daily-hwpx`| 일일 HWPX 보고서 |

### report.nodes.csv.routes.js

| No | Method | Path                                  | 설명 |
|---:|:------:|---------------------------------------|------|
| 1  | GET    | `/buildings/:buildingId/nodes.csv`    | 각도 이력 CSV |

### reportTable1.routes.js *(표 1만 단독 출력)*

| No | Method | Path     | 설명 |
|---:|:------:|----------|------|
| 1  | GET    | `/table1`| 표1(날씨 등) |

### weather.routes.js

| No | Method | Path                | 설명 |
|---:|:------:|---------------------|------|
| 1  | POST   | `/`                 | 날씨 생성(수집) |
| 2  | GET    | `/`                 | 날씨 목록 |
| 3  | GET    | `/latest`           | 최신 날씨 |
| 4  | GET    | `/:id`              | ID로 조회 |
| 5  | GET    | `/:id/wind-series`  | 바람 시계열 |
| 6~10 | (동일 라우트 반복 기재) | 문서 중복 표기는 실제 구현과 중복일 수 있음 |

---

## 8) 컨트롤러 매핑 (일부)

### company-controller.js
| No | Method | Path                                   | Handler |
|---:|:------:|----------------------------------------|---------|
| 1  | POST   | `/create-building`                     | `createBuilding` |
| 2  | GET    | `/get-active-buildings`                | `getActiveBuildings` |
| 3  | GET    | `/get-buildings`                       | `getBuildings` |
| 4  | GET    | `/buildings/:id`                       | `getBuildingNodes` |
| 5  | GET    | `/buildings/:id/angle-nodes`           | `getBuildingAngleNodes` |
| 6  | GET    | `/buildings/:id/angle-nodes/summary`   | `getAngleNodeSummary` |
| 7  | DELETE | `/delete/building/:buildingId`         | `deleteBuilding` |
| 8  | PUT    | `/building/set-alarm-level`            | `setAlarmLevel` |
| 9  | POST   | `/create-client`                       | `createClient` |
| 10 | GET    | `/clients`                             | `getComanies` *(오탈자 가능)* |
| 11 | GET    | `/clients/:id`                         | `getClient` |
| 12 | DELETE | `/delete/client/:clientId`             | `deleteCompany` |
| 13 | POST   | `/boss-clients`                        | `getBossClients` |
| 14 | POST   | `/gateway/wake_up`                     | `wakeUpOfficeGateway` |

### product-controller.js
| No | Method | Path | Handler |
|---:|:------:|------|---------|
| 1  | POST | `/create-nodes` | `createNodes` |
| 2  | POST | `/create-gateway` | `createGateway` |
| 3  | POST | `/create-office-gateway` | `createOfficeGateway` |
| 4  | GET  | `/wake-up-gateway` | `makeWakeUpOfficeGateway` |
| 5  | POST | `/create-angle-nodes` | `createAngleNodes` |
| 6  | GET  | `/get-gateways` | `getGateways` |
| 7  | GET  | `/get-active-gateways` | `getActiveGateways` |
| 8  | GET  | `/get-single-gateway/:number` | `getSingleGateway` |
| 9  | GET  | `/get-nodes` | `getNodes` |
| 10 | GET  | `/get-active-nodes` | `getActiveNodes` |
| 11 | GET  | `/get-active-angle-nodes` | `getActiveAngleNodes` |
| 12 | GET  | `/download-nodes-history` | `downloadNodeHistory` |
| 13 | POST | `/update-product` | `updateProductStatus` |
| 14 | POST | `/delete-product` | `deleteProduct` |
| 15 | POST | `/set-node-position` | `uploadXlsFile` |
| 16 | POST | `/combine-angle-nodes` | `combineAngleNodeToGateway` |
| 17 | GET  | `/angle-node/data` | `angleNodeGraphicData` |
| 18 | PUT  | `/gateway/zone-name` | `setGatewayZoneName` |
| 19 | PUT  | `/angle-node/position` | `setAngleNodePosition` |

### user-controller.js
| No | Method | Path | Handler |
|---:|:------:|------|---------|
| 1  | POST | `/register` | `register` |
| 2  | POST | `/login` | `login` |
| 3  | POST | `/update-user-types` | `updateUserType` |
| 4  | POST | `/delete-user` | `deleteUser` |
| 5  | POST | `/reset-password` | `resetPwRequest` |
| 6  | POST | `/password-verify` | `resetPwVerify` |
| 7  | GET  | `/check-user` | `checkUser` |
| 8  | GET  | `/logout` | `logout` |
| 9  | GET  | `/get-users` | `getUsers` |

### weather.controller.js
- `POST /` → `ctrl.createWeather`  
- `GET /` → `ctrl.getWeatherList`  
- `GET /latest` → `ctrl.getLatestWeather`  
- `GET /:id` → `ctrl.getWeatherById`  
- `GET /:id/wind-series` → `ctrl.getWindSeriesForBuilding`  
*(문서에 동일 항목이 2회 반복 기재됨)*

---

## 9) 배치/운영 작업

- **Heartbeat Job**: `lastSeen` 기반으로 게이트웨이·각도노드 `alive` 상태 일괄 갱신  
- **Weather Ingest**: 빌딩 주소 지오코딩 → OWM 호출 → `Weather` 저장  
- **Report Engine**: 기간/빌딩 기준 통계로 **HWPX/CSV** 생성

## 10) 리포트 생성

- **HWPX**: `reportDailyCombined.service` + `reportTable1.service` + `reportTableZones.service`
- **CSV**: `reportNodesCsv.service` (중복 제거, 파일명 안전화, 빌딩·구역·GW 정보 포함)

엔드포인트:
- `GET /api/reports/daily-hwpx`
- `GET /buildings/:buildingId/nodes.csv`



### 요구 사항
- Node.js (LTS), npm 또는 pnpm
- MongoDB 인스턴스
- MQTT Broker (예: Mosquitto)
- OpenWeatherMap API Key


### 설치 & 실행
```bash
# 1) 의존성 설치
npm install

# 2) 개발 실행
npm run dev


---



