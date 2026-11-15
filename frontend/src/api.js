const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL = (
  configuredApiUrl ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000')
).replace(/\/+$/, '');