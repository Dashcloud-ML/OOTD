// src/weather.js — turn a city name into a simple weather description for the stylist.
// Optional: if no OPENWEATHER_API_KEY, the frontend's manual weather dropdown is used instead.

export async function getWeather(city) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key || !city) return null;

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("q", city);
    url.searchParams.set("units", "metric");
    url.searchParams.set("appid", key);

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const temp = Math.round(data.main?.temp);
    const desc = data.weather?.[0]?.description || "";
    const raining = /rain|drizzle|thunder/i.test(desc);

    // A compact sentence the LLM can use directly.
    return `${temp}°C, ${desc}${raining ? " (bring rain-friendly layers)" : ""} in ${data.name}`;
  } catch {
    return null;
  }
}
