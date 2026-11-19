
async function checkStore() {
  const url = 'https://microsoftedge.microsoft.com/addons/detail/jobfill-bd/codkdflmgahpbdhadkblabeihgknjnda';
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    }
  });
  console.log('Status:', res.status, res.statusText);
  const html = await res.text();
  console.log('HTML length:', html.length);
  
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
  console.log('Title:', title);

  // Search for version in HTML or script tags
  const matches = [...html.matchAll(/version["']?\s*[:=]\s*["']?([\d\.]+)["']?/gi)];
  console.log('Version occurrences:', matches.map(m => m[0]).slice(0, 10));

  // Check __NEXT_DATA__ or other JSON states
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      console.log('Found NEXT_DATA. Keys:', Object.keys(data));
      const props = JSON.stringify(data.props || {});
      const verMatch = props.match(/"version":"([^"]+)"/);
      console.log('Version in props:', verMatch ? verMatch[1] : 'None');
    } catch (e) {
      console.log('NEXT_DATA parse error:', e.message);
    }
  }

  // Look for any string mentioning version near JobFill
  const genericVer = html.match(/Version\s*<[^>]+>\s*([\d\.]+)/i) || html.match(/Version\s*:\s*([\d\.]+)/i) || html.match(/Version\s*([0-9\.]+)/i);
  console.log('Generic version regex:', genericVer ? genericVer[0] : 'None');
}

checkStore().catch(console.error);
