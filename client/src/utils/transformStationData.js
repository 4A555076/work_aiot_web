import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

export const transformStationData = (stationData = [], modelData = []) => {
  if (!Array.isArray(stationData) || !Array.isArray(modelData)) {
    return [];
  }

  return stationData.map((station) => {
    const model =
      modelData.find(
        (item) =>
          item.STID === station.STID &&
          item.ProjID === station.ProjID
      ) ?? {};

    const measurements = Array.from({ length: 8 }, (_, index) => {
      const no = index + 1;

      return {
        index: no,

        measurement: {
          name: model[`ParName${no}`] ?? "",
          value: station[`Value${no}`] ?? null,
          unit: model[`ParUnit${no}`] ?? "",
          status: station[`Status${no}`] ?? null,
        },

        count: {
          name: model[`ParName${no}Count`] ?? "",
          value: station[`Count${no}`] ?? null,
          unit: "",
          status: null,
        },
      };
    });

    return {
      ProjID: station.ProjID ?? "",
      STID: station.STID ?? "",
      IIT: model.IIT ?? "",
      Date_Time: station.Date_Time ? dayjs(station.Date_Time).utc().format("YYYY-MM-DD HH:mm") : null ,
      sValue: station.sValue ?? null,
      measurements,
    };
  });
};
