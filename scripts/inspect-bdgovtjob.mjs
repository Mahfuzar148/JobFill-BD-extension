import { writeFileSync } from 'fs';

async function main() {
  const res = await fetch('https://bdgovtjob.net/bpsc-job-circular/');
  const html = await res.text();
  
  // Save snapshot fixture
  writeFileSync('tests/fixtures/bdgovtjob_bpsc_snapshot.html', html, 'utf-8');
  console.log('Saved snapshot of', html.length, 'bytes');

  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim();
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1];
  const datePublished = (html.match(/datePublished["']:\s*["']([^"']+)["']/i) || html.match(/class=["'][^"']*published[^"']*["'][^>]*>([\s\S]*?)<\//i) || [])[1];
  const author = (html.match(/author["']:\s*{[^}]*name["']:\s*["']([^"']+)["']/i) || html.match(/class=["'][^"']*author[^"']*["'][^>]*>([\s\S]*?)<\//i) || [])[1];

  console.log('Title:', title);
  console.log('H1:', h1);
  console.log('Canonical:', canonical);
  console.log('DatePublished:', datePublished);
  console.log('Author:', author);

  const h2Matches = Array.from(html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)).map(m => m[1].replace(/<[^>]+>/g, '').trim());
  console.log('Headings Count:', h2Matches.length);
  console.log('First 10 Headings:', h2Matches.slice(0, 10));

  const tables = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)).map(m => m[0]);
  console.log('Table Count:', tables.length);

  const pdfLinks = Array.from(html.matchAll(/href=["']([^"']+\.pdf)["']/gi)).map(m => m[1]);
  console.log('PDF links:', [...new Set(pdfLinks)]);

  const teletalkLinks = Array.from(html.matchAll(/href=["'](https?:\/\/[^"']*teletalk\.com\.bd[^"']*)["']/gi)).map(m => m[1]);
  console.log('Teletalk links:', [...new Set(teletalkLinks)]);

  const bpscGovLinks = Array.from(html.matchAll(/href=["'](https?:\/\/[^"']*bpsc\.gov\.bd[^"']*)["']/gi)).map(m => m[1]);
  console.log('BPSC Gov links:', [...new Set(bpscGovLinks)]);

  const circularImages = Array.from(html.matchAll(/<img[^>]+src=["']([^"']+(?:circular|notice|bpsc|jpg|png|webp))["']/gi)).map(m => m[1]);
  console.log('Circular images count:', circularImages.length);
  console.log('Sample images:', circularImages.slice(0, 5));
}

main().catch(console.error);
