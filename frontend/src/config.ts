export const API_BASE = import.meta.env.PROD
  ? 'https://api-rpi.neelema.net'
  : ''

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
