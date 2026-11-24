const CHEMICAL_MAP = {
  SO2: 'SO₂',
  NH3: 'NH₃',
  PM10: 'PM₁₀',
  'PM2.5': 'PM₂.₅',
  H2S: 'H₂S',
  NO2: 'NO₂',
  O3: 'O₃',
  'ug/m3': 'μg/m³',
};

const SPEED_MAP = {
  WS_01: { name: '< 0.3 m/s', min: 0, max: 0.3 },
  WS_02: { name: '0.3-0.5 m/s', min: 0.3, max: 0.5 },
  WS_03: { name: '0.5-1 m/s', min: 0.5, max: 1 },
  WS_04: { name: '1-1.5 m/s', min: 1, max: 1.5 },
  WS_05: { name: '1.5-2 m/s', min: 1.5, max: 2 },
  WS_06: { name: '2-3 m/s', min: 2, max: 3 },
  WS_07: { name: '3-5 m/s', min: 3, max: 5 },
  WS_08: { name: '5-7 m/s', min: 5, max: 7 },
  WS_09: { name: '7-9 m/s', min: 7, max: 9 },
  WS_10: { name: '≥ 9 m/s', min: 9, max: Infinity },
};

module.exports = {
  CHEMICAL_MAP,
  SPEED_MAP
};