// 강남구 관할 파출소/지구대 데이터 + 위치 매칭 유틸리티

export interface PatrolStation {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  mapX: number; // SVG map percentage position
  mapY: number;
}

// 강남구 내 주요 파출소/지구대 (실제 GPS 좌표 기준)
export const PATROL_STATIONS: PatrolStation[] = [
  { id: 'yeoksam', name: '역삼지구대', shortName: '역삼', lat: 37.5006, lng: 127.0365, mapX: 52, mapY: 38 },
  { id: 'nonhyeon', name: '논현파출소', shortName: '논현', lat: 37.5112, lng: 127.0214, mapX: 38, mapY: 52 },
  { id: 'daechi', name: '대치지구대', shortName: '대치', lat: 37.4943, lng: 127.0643, mapX: 68, mapY: 42 },
  { id: 'samsung', name: '삼성파출소', shortName: '삼성', lat: 37.5145, lng: 127.0530, mapX: 58, mapY: 50 },
  { id: 'cheongdam', name: '청담파출소', shortName: '청담', lat: 37.5250, lng: 127.0500, mapX: 62, mapY: 28 },
  { id: 'apsu', name: '압구정파출소', shortName: '압구정', lat: 37.5270, lng: 127.0280, mapX: 42, mapY: 25 },
  { id: 'sinsa', name: '신사파출소', shortName: '신사', lat: 37.5165, lng: 127.0200, mapX: 35, mapY: 38 },
  { id: 'dogok', name: '도곡파출소', shortName: '도곡', lat: 37.4905, lng: 127.0410, mapX: 48, mapY: 62 },
  { id: 'gaepo', name: '개포파출소', shortName: '개포', lat: 37.4870, lng: 127.0600, mapX: 65, mapY: 62 },
  { id: 'ilwon', name: '일원파출소', shortName: '일원', lat: 37.4830, lng: 127.0720, mapX: 75, mapY: 55 },
];

// 강남구 중심 좌표 (강남역 교차로)
export const GANGNAM_CENTER = { lat: 37.4979, lng: 127.0276 };

// 강남구 행정구역 경계 (서울시 공식 경계 기준)
export const GANGNAM_BOUNDS = {
  minLat: 37.4690,
  maxLat: 37.5350,
  minLng: 127.0070,
  maxLng: 127.0850,
};

// 강남구 동별 기본 좌표 (GPS 없을 때 동 이름으로 매칭)
export const DONG_COORDS: Record<string, { lat: number; lng: number }> = {
  '역삼동': { lat: 37.5006, lng: 127.0365 },
  '청담동': { lat: 37.5250, lng: 127.0500 },
  '삼성동': { lat: 37.5145, lng: 127.0530 },
  '대치동': { lat: 37.4943, lng: 127.0643 },
  '신사동': { lat: 37.5165, lng: 127.0200 },
  '논현동': { lat: 37.5112, lng: 127.0214 },
  '압구정동': { lat: 37.5270, lng: 127.0280 },
  '도곡동': { lat: 37.4905, lng: 127.0410 },
  '개포동': { lat: 37.4870, lng: 127.0600 },
  '일원동': { lat: 37.4830, lng: 127.0720 },
  '포이동': { lat: 37.4890, lng: 127.0520 },
  '수서동': { lat: 37.4870, lng: 127.0650 },
  '세곡동': { lat: 37.4800, lng: 127.0700 },
  '자곡동': { lat: 37.4800, lng: 127.0750 },
};

// Haversine 거리 (km)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface NearestStationResult {
  station: PatrolStation;
  distanceKm: number;
  etaMinutes: number;
}

export function findNearestStation(lat: number, lng: number): NearestStationResult {
  const all = findNearestStations(lat, lng, 1);
  return all[0] ?? { station: PATROL_STATIONS[0], distanceKm: 0, etaMinutes: 2 };
}

export function findNearestStations(lat: number, lng: number, count: number = 3): NearestStationResult[] {
  const results: NearestStationResult[] = PATROL_STATIONS.map((station) => {
    const distanceKm = haversine(lat, lng, station.lat, station.lng);
    const etaMinutes = Math.max(2, Math.ceil((distanceKm / 30) * 60));
    return { station, distanceKm, etaMinutes };
  });
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results.slice(0, count);
}

// 위치 문자열에서 동 이름 추출 → GPS 좌표 반환
export function locationToCoords(location: string): { lat: number; lng: number; dong: string } {
  for (const dong of Object.keys(DONG_COORDS)) {
    if (location.includes(dong)) {
      return { ...DONG_COORDS[dong], dong };
    }
  }
  // 강남구 중심
  return { ...GANGNAM_CENTER, dong: '강남구' };
}

// GPS 좌표를 SVG 맵 퍼센트 좌표로 변환
// 강남구 행정구역 경계 기준 (서울시 공식 경계)
export function coordsToMapXY(lat: number, lng: number): { x: number; y: number } {
  const minLat = GANGNAM_BOUNDS.minLat;
  const maxLat = GANGNAM_BOUNDS.maxLat;
  const minLng = GANGNAM_BOUNDS.minLng;
  const maxLng = GANGNAM_BOUNDS.maxLng;

  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  // 위도는 y축이 반대 (큰 위도가 위쪽 = y가 작음)
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;

  return {
    x: Math.max(5, Math.min(95, x)),
    y: Math.max(5, Math.min(95, y)),
  };
}

// GPS 정확도(미터)를 지도상 원 반경(퍼센트)로 변환
export function accuracyToRadiusPercent(accuracyM: number, lat: number): number {
  // 1도 경도 ≈ 111.32km (위도에 따라 보정)
  const kmPerDeg = 111.32 * Math.cos((lat * Math.PI) / 180);
  const mapWidthKm = (GANGNAM_BOUNDS.maxLng - GANGNAM_BOUNDS.minLng) * kmPerDeg;
  if (mapWidthKm <= 0) return 2;
  const radiusKm = accuracyM / 1000;
  const radiusPercent = (radiusKm / mapWidthKm) * 100;
  return Math.max(1, Math.min(40, radiusPercent));
}

// 좌표가 강남구 영역 내인지 확인
export function isInGangnam(lat: number, lng: number): boolean {
  return (
    lat >= GANGNAM_BOUNDS.minLat &&
    lat <= GANGNAM_BOUNDS.maxLat &&
    lng >= GANGNAM_BOUNDS.minLng &&
    lng <= GANGNAM_BOUNDS.maxLng
  );
}
