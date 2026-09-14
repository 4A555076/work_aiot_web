import { setOptions } from "@googlemaps/js-api-loader";

setOptions({
    apiKey: import.meta.env.VITE_APP_API_KEY,
    version: 'weekly',
    language: "zh-TW",
    region: "TW",
});