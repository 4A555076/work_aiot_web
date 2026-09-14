import { useCallback, useEffect, useState } from "react";
import { STATION_SELECTION_CHANGE } from "@/utils/stationSelectionStorage";

export function useStationSelections(getter) {
  const [stations, setStations] = useState(() => getter());
  const refresh = useCallback(() => setStations(getter()), [getter]);

  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    window.addEventListener(STATION_SELECTION_CHANGE, onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(STATION_SELECTION_CHANGE, onStorage);
    };
  }, [refresh]);

  return stations;
}
