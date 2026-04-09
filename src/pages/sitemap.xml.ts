import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('blog');

  const staticPages = [
    { url: 'https://leganastealdolar.com/', lastmod: new Date().toISOString().split('T')[0], priority: '1.0' },
    { url: 'https://leganastealdolar.com/blog/', lastmod: new Date().toISOString().split('T')[0], priority: '0.8' },
    { url: 'https://leganastealdolar.com/referidos/', lastmod: new Date().toISOString().split('T')[0], priority: '0.7' },
  ];

  const blogPages = posts.map(post => ({
    url: `https://leganastealdolar.com/blog/${post.id}/`,
    lastmod: post.data.date.toISOString().split('T')[0],
    priority: '0.6',
  }));

  const allPages = [...staticPages, ...blogPages];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
