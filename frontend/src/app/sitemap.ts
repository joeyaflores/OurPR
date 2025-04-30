import { MetadataRoute } from 'next'

// Use the provided domain
const BASE_URL = 'https://ourpr.app';

export default function sitemap(): MetadataRoute.Sitemap {
  // Add known/likely static pages
  const routes = [
    '/', // Home page
    '/discover',
    '/plan', // Assuming this exists based on UserDashboard links
    '/pr-timeline' // Assuming this exists based on UserDashboard links
    // Add other static pages here if known
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));

  // TODO: Add dynamic race detail pages later if applicable

  return routes;
} 