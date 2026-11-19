import https from 'https';

const req = https.get('https://bpsc.teletalk.com.bd/', {
  rejectUnauthorized: false,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.0.0 Safari/537.36'
  }
}, async (res) => {
  let body = '';
  for await (const chunk of res) body += chunk;
  console.log('BPSC Body length:', body.length);
  // Find all a tags
  const aTags = Array.from(body.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi)).map(m => ({
    href: m[1],
    text: m[2].replace(/<[^>]+>/g, '').trim()
  }));
  console.log('All links on BPSC Teletalk:', JSON.stringify(aTags, null, 2));
});
