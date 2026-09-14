

/* 
    配置各種參數的預設小數位數、圖表類型、特殊專案
    - default：一般小數位數預設值
    - params：各參數對應的小數位數
    - chartTypes：圖表模式清單
    - specialProjects：特殊專案清單
 */


module.exports = {
  default: 1,

  params: {
    SO2: 2,
    CO: 2,
    NO2: 2,
    NH3: 2,
    H2S: 2
  },

  chartTypes: ["Chart"],

  specialProjects: ["200209"]
};