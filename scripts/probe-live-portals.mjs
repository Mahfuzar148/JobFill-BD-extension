// Probe live Bangladesh government recruitment portals
import https from 'https';
import http from 'http';

const targets = [
  { name: 'BPSC Teletalk', url: 'https://bpsc.teletalk.com.bd/' },
  { name: 'Teletalk Alljobs', url: 'https://alljobs.teletalk.com.bd/' },
  { name: 'Bangladesh National Portal Jobs', url: 'https://bangladesh.gov.bd/' },
  { name: 'BPSC Official', url: 'https://bpsc.gov.bd/' },
];

for (const t of targets) {
  try {
    const res = await new Promise((resolve, reject) => {
      const req = https.get(t.url, {
        rejectUnauthorized: false,
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.0.0 Safari/537.36'
        }
      }, resolve);
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });

    let body = '';
    for await (const chunk of res) body += chunk;
    console.log(`[${t.name}] Status: ${res.statusCode}, Bytes: ${body.length}`);
    const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) console.log(`   Title: ${titleMatch[1].trim()}`);

    // Scan for application links or form elements
    const forms = body.match(/<form[\s\S]*?<\/form>/gi) || [];
    const inputs = body.match(/<input[\s\S]*?>/gi) || [];
    const selects = body.match(/<select[\s\S]*?>/gi) || [];
    console.log(`   Forms: ${forms.length}, Inputs: ${inputs.length}, Selects: ${selects.length}`);

    // Extract links
    const linkMatches = Array.from(body.matchAll(/href=["']([^"']+)["']/gi)).map(m => m[1]);
    const jobLinks = linkMatches.filter(l => l.includes('job') || l.includes('apply') || l.includes('form') || l.includes('application') || l.includes('circular'));
    console.log(`   Job/Apply Links:`, jobLinks.slice(0, 10));
  } catch (err) {
    console.log(`[${t.name}] Error: ${err.message}`);
  }
}
