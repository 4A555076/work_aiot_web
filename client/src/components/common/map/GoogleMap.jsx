import { useEffect, useRef } from "react";
import "@/lib/googleMap";
import { importLibrary } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import locationImg from "@/assets/location.png";

export default function GoogleMap({ lat, lng, markers = [], zoom = 18 }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if ((!lat || !lng) && markers.length === 0) return;

    const mapId = import.meta.env.VITE_APP_GOOGLE_MAP_ID;
    if (!mapId) return;

    let map;
    let clusterer;

    async function init() {
      const { Map, InfoWindow } = await importLibrary("maps");
      const { LatLngBounds } = await importLibrary("core");
      const { AdvancedMarkerElement } = await importLibrary("marker");

      const center = markers.length > 0 
        ? { lat: Number(markers[0].lat), lng: Number(markers[0].lng) }
        : { lat: Number(lat), lng: Number(lng) };

      map = new Map(mapRef.current, {
        center,
        zoom,
        mapId,
        disableDefaultUI: true,
        zoomControl: true,
      });

      const bounds = new LatLngBounds();
      const markerObjects = [];

      const createMarker = (item) => {
        const position = { lat: Number(item.lat), lng: Number(item.lng) };

        const img = document.createElement("img");
        img.src = locationImg;
        img.width = 40;
        const marker = new AdvancedMarkerElement({ position, content: img });

        if (item.name) {
          const infoWindow = new InfoWindow({
            content: `<div style="padding: 8px 12px; font-weight: 600;">${item.name}</div>`,
          });
          marker.addListener("click", () => infoWindow.open(map, marker));
        }

        return { marker, position };
      };

      (markers.length > 0 ? markers : [{ lat, lng }]).forEach((item) => {
        const { marker, position } = createMarker(item);
        markerObjects.push(marker);
        bounds.extend(position);
      });

      clusterer = new MarkerClusterer({
        map,
        markers: markerObjects,
        renderer: {
          render({ count, position }) {
            const div = document.createElement("div");
            div.className = "flex items-center justify-center font-bold text-white";
            div.style.cssText = `
              width: 28px; height: 28px;
              background-color: #d97706;
              border: 3px solid rgba(255, 255, 255, 0.5);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.875rem;
              backdrop-filter: blur(2px);
              transition: transform 0.3s ease;
            `;
            div.textContent = count;
            return new AdvancedMarkerElement({ position, content: div });
          },
        },
      });

      if (markerObjects.length > 1) map.fitBounds(bounds);
      else map.setCenter(bounds.getCenter());
    }

    init();
    return () => { clusterer?.clearMarkers(); };
  }, [lat, lng, markers, zoom]);

  return <div ref={mapRef} className="min-h-80 h-full w-full overflow-hidden rounded-2xl border border-border bg-muted shadow-card" />;
}
