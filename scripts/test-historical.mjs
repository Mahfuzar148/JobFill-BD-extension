async function checkHistorical() {
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
  
  // Page 153 (oldest)
  const res153 = await fetch('https://bdgovtjob.net/category/all-jobs/page/153/', { headers });
  const html153 = await res153.text();
  const title153 = [...html153.matchAll(/<h2[^>]*class=["'](?:bdg-card-title|entry-title)["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log('Page 153 articles (oldest in archive):');
  for (const m of title153) {
    console.log(' - URL:', m[1], 'Title:', m[2].replace(/<[^>]+>/g, '').trim());
  }

  // Fetch oldest article details
  if (title153.length > 0) {
    const oldestUrl = title153[0][1];
    console.log('\nFetching oldest circular:', oldestUrl);
    const oRes = await fetch(oldestUrl, { headers });
    const oHtml = await oRes.text();
    const dateMatch = oHtml.match(/datePublished["']:\s*["']([^"']+)["']/i) || oHtml.match(/class=["'][^"']*published[^"']*["'][^>]*>([\s\S]*?)<\//i);
    console.log('Published date of oldest circular:', dateMatch ? dateMatch[1] : 'N/A');
    
    // Check tables, deadlines, PDF links
    const tables = [...oHtml.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
    console.log('Tables found in oldest article:', tables.length);
    const pdfs = [...oHtml.matchAll(/href=["']([^"']+\.pdf)["']/gi)].map(m => m[1]);
    console.log('PDFs in oldest article:', pdfs);
    const teletalk = [...oHtml.matchAll(/href=["'](https?:\/\/[^"']*teletalk\.com\.bd[^"']*)["']/gi)].map(m => m[1]);
    console.log('Teletalk links in oldest article:', teletalk);
  }

  // Page 50 (mid archive)
  const res50 = await fetch('https://bdgovtjob.net/category/all-jobs/page/50/', { headers });
  const html50 = await res50.text();
  const title50 = [...html50.matchAll(/<h2[^>]*class=["'](?:bdg-card-title|entry-title)["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log('\nPage 50 articles (mid archive):');
  for (const m of title50.slice(0, 3)) {
    console.log(' - URL:', m[1], 'Title:', m[2].replace(/<[^>]+>/g, '').trim());
  }
}

checkHistorical().catch(console.error);
