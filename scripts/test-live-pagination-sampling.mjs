async function testLiveSampling() {
  console.log('--- Step 1: Testing Dynamic Discovery and Multi-Page Crawl ---');
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8'
  };

  const pagesToSample = [1, 2, 5, 10, 20, 50, 100, 150, 153];
  const pageResults = [];
  const discoveredArticleUrls = new Set();
  const allCategories = new Set();
  const sampleArticles = [];

  for (const p of pagesToSample) {
    const url = p === 1 ? 'https://bdgovtjob.net/category/all-jobs/' : `https://bdgovtjob.net/category/all-jobs/page/${p}/`;
    try {
      const t0 = Date.now();
      const res = await fetch(url, { headers });
      const elapsed = Date.now() - t0;
      if (!res.ok) {
        console.log(`Page ${p} (${url}): HTTP ${res.status} ${res.statusText}`);
        pageResults.push({ page: p, url, status: res.status, ok: false });
        continue;
      }
      const html = await res.text();
      
      // Parse cards
      const cardMatches = [...html.matchAll(/<article[^>]+class=["']([^"']*)["'][\s\S]*?<\/article>/gi)];
      let pageArticles = 0;

      for (const cm of cardMatches) {
        const full = cm[0];
        const titleMatch = full.match(/<h2[^>]*class=["'][^"']*(?:bdg-card-title|entry-title)[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) || full.match(/<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
        const catMatch = full.match(/<span[^>]*class=["'][^"']*bdg-card-cat[^"']*["'][^>]*>([\s\S]*?)<\/span>/i) || full.match(/rel=["']category tag["'][^>]*>([^<]+)<\/a>/i);
        const dateMatch = full.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i) || full.match(/class=["'][^"']*published[^"']*["'][^>]*>([\s\S]*?)<\//i);
        const vacancyMatch = full.match(/data-n=["']([^"']*)["']/i) || full.match(/শূন্যপদ[\s:]*([০-৯0-9,]+)/i);

        if (titleMatch) {
          const artUrl = titleMatch[1];
          const artTitle = titleMatch[2].replace(/<[^>]+>/g, '').trim();
          discoveredArticleUrls.add(artUrl);
          pageArticles++;

          const category = catMatch ? (catMatch[1] || catMatch[2]).replace(/<[^>]+>/g, '').trim() : 'Unknown';
          allCategories.add(category);

          if (sampleArticles.length < 20 && (p === 1 || p === 10 || p === 50 || p === 100 || p === 153)) {
            sampleArticles.push({
              page: p,
              title: artTitle,
              url: artUrl,
              category,
              published: dateMatch ? (dateMatch[2] || dateMatch[1]).replace(/<[^>]+>/g, '').trim() : 'N/A',
              vacancies: vacancyMatch ? vacancyMatch[1].trim() : 'N/A'
            });
          }
        }
      }

      console.log(`Page ${p} [${elapsed}ms]: HTTP 200, parsed ${pageArticles} cards. Total URLs so far: ${discoveredArticleUrls.size}`);
      pageResults.push({ page: p, url, status: 200, ok: true, cards: pageArticles });

      // Respect rate limit: 800ms delay between pages
      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`Page ${p} error:`, e.message);
      pageResults.push({ page: p, url, error: e.message, ok: false });
    }
  }

  console.log('\n========================================');
  console.log('LIVE CRAWL SUMMARY ACROSS TIMELINE:');
  console.log('Pages tested:', pageResults.length);
  console.log('Pages succeeded:', pageResults.filter(p => p.ok).length);
  console.log('Unique article URLs collected from sampled pages:', discoveredArticleUrls.size);
  console.log('Categories discovered across pages:', [...allCategories]);
  console.log('\nSample Articles across different years/pages:');
  console.log(JSON.stringify(sampleArticles.slice(0, 10), null, 2));

  console.log('\n========================================');
  console.log('--- Step 2: Sampling Deep Article Parse on 4 Real Articles ---');
  const articlesToAudit = [
    'https://bdgovtjob.net/bpsc-job-circular/',
    'https://bdgovtjob.net/tax15-dhaka-job-circular/',
    sampleArticles.find(a => a.page >= 50)?.url,
    sampleArticles.find(a => a.page >= 150)?.url
  ].filter(Boolean);

  for (const artUrl of articlesToAudit) {
    try {
      const t0 = Date.now();
      const res = await fetch(artUrl, { headers });
      const html = await res.text();
      console.log(`\nArticle [${Date.now()-t0}ms]: ${artUrl}`);
      console.log(`  HTTP: ${res.status}, Length: ${html.length} bytes`);

      const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim();
      const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
      const teletalk = [...html.matchAll(/href=["'](https?:\/\/[^"']*teletalk\.com\.bd[^"']*)["']/gi)].map(m => m[1]);
      const officialGov = [...html.matchAll(/href=["'](https?:\/\/[^"']*(?:\.gov\.bd|\.edu\.bd)[^"']*)["']/gi)].map(m => m[1]);
      const pdfs = [...html.matchAll(/href=["']([^"']+\.pdf)["']/gi)].map(m => m[1]);
      const docImages = [...html.matchAll(/<img[^>]+src=["']([^"']*(?:circular|notice|upload|job|bpsc|tax)[^"']*(?:\.jpe?g|\.png|\.webp))["']/gi)].map(m => m[1]);

      console.log(`  Title: ${title}`);
      console.log(`  Tables found: ${tables.length}`);
      console.log(`  PDF links (${pdfs.length}):`, [...new Set(pdfs)]);
      console.log(`  Teletalk links (${teletalk.length}):`, [...new Set(teletalk)]);
      console.log(`  Gov/Official links (${officialGov.length}):`, [...new Set(officialGov)].slice(0, 3));
      console.log(`  Circular images (${docImages.length}):`, [...new Set(docImages)].slice(0, 3));

      await new Promise(r => setTimeout(r, 800));
    } catch (e) {
      console.error(`  Failed deep fetch: ${artUrl}`, e.message);
    }
  }
}

testLiveSampling().catch(console.error);
