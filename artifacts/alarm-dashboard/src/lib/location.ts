export type ClientLocationContext = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timezone?: string;
};

const LOCATION_ENABLED_KEY = 'buzzer-location-context-enabled';

export function isLocationContextEnabled() {
  return localStorage.getItem(LOCATION_ENABLED_KEY) === 'true';
}

export function setLocationContextEnabled(enabled: boolean) {
  localStorage.setItem(LOCATION_ENABLED_KEY, String(enabled));
}

export function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function getClientLocale() {
  return navigator.language || 'en-US';
}

export async function getClientLocationContext(): Promise<ClientLocationContext | null> {
  if (!('geolocation' in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timezone: getClientTimezone(),
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 8000,
      },
    );
  });
}

export async function buildAssistantContext(includeLocation: boolean) {
  return {
    timezone: getClientTimezone(),
    locale: getClientLocale(),
    location: includeLocation ? await getClientLocationContext() : null,
  };
}
