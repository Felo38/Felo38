import type { MetadataRoute } from 'next'

// Installable on the home screen. Start on Arabic by default.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'On the Run',
    short_name: 'On the Run',
    start_url: '/ar',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d4a9b',
    lang: 'ar',
    icons: [{ src: '/brand/on-the-run-logo-blue.png', sizes: 'any', type: 'image/png' }],
  }
}
