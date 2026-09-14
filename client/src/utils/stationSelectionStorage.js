const DASHBOARD_KEY = "dashboardStations";
const COMPARISON_KEY = "comparisonStations";
export const STATION_SELECTION_CHANGE = "station-selection-change";

const normalize = (station) => {
  const PJID = station?.PJID == null ? "" : String(station.PJID).trim();
  const STID = station?.STID == null ? "" : String(station.STID).trim();
  return PJID && STID ? { PJID, STID } : null;
};

const read = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value.reduce((items, station) => {
      const item = normalize(station);
      if (item && !items.some((saved) => saved.PJID === item.PJID && saved.STID === item.STID)) {
        items.push(item);
      }
      return items;
    }, []);
  } catch {
    return [];
  }
};

const write = (key, stations) => {
  try {
    localStorage.setItem(key, JSON.stringify(stations));
    window.dispatchEvent(new CustomEvent(STATION_SELECTION_CHANGE, { detail: { key } }));
    return true;
  } catch {
    return false;
  }
};

const add = (key, station) => {
  const item = normalize(station);
  if (!item) return { added: false, reason: "invalid" };
  const stations = read(key);
  if (stations.some((saved) => saved.PJID === item.PJID && saved.STID === item.STID)) {
    return { added: false, reason: "duplicate" };
  }
  return write(key, [...stations, item])
    ? { added: true }
    : { added: false, reason: "storage" };
};

const remove = (key, PJID, STID) => {
  const item = normalize({ PJID, STID });
  if (!item) return false;
  return write(
    key,
    read(key).filter((saved) => !(saved.PJID === item.PJID && saved.STID === item.STID)),
  );
};

export const getDashboardStations = () => read(DASHBOARD_KEY);
export const addDashboardStation = (station) => add(DASHBOARD_KEY, station);
export const removeDashboardStation = (PJID, STID) => remove(DASHBOARD_KEY, PJID, STID);
export const clearDashboardStations = () => write(DASHBOARD_KEY, []);

export const getComparisonStations = () => read(COMPARISON_KEY);
export const addComparisonStation = (station) => add(COMPARISON_KEY, station);
export const removeComparisonStation = (PJID, STID) => remove(COMPARISON_KEY, PJID, STID);
export const clearComparisonStations = () => write(COMPARISON_KEY, []);
