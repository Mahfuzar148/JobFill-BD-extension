async function testBpscOfficial() {
  console.log('--- Testing Official BPSC Portal: https://bpsc.gov.bd ---');
  try {
    const resGov = await fetch('https://bpsc.gov.bd/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      }
    });
    console.log(`bpsc.gov.bd: HTTP ${resGov.status} ${resGov.statusText}`);
    const textGov = await resGov.text();
    console.log(`Length: ${textGov.length} bytes`);
    
    // Look for circular / notice links on bpsc.gov.bd
    const notices = [...textGov.matchAll(/href=["']([^"']*(?:notice|circular|view|download)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    console.log(`Found ${notices.length} notice links on homepage.`);
    for (const n of notices.slice(0, 5)) {
      console.log(' - Notice:', n[1], 'Text:', n[2].replace(/<[^>]+>/g, '').trim());
    }
  } catch (e) {
    console.error('bpsc.gov.bd error:', e.message);
  }

  console.log('\n--- Testing Official Teletalk Portal: http://bpsc.teletalk.com.bd ---');
  try {
    const resTele = await fetch('http://bpsc.teletalk.com.bd/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    console.log(`bpsc.teletalk.com.bd (HTTP): HTTP ${resTele.status} ${resTele.statusText}`);
    const teleText = await resTele.text();
    console.log(`Length: ${teleText.length} bytes`);
    const links = [...teleText.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    console.log(`Found ${links.length} links on bpsc.teletalk.com.bd:`);
    for (const l of links.slice(0, 5)) {
      console.log(' - Link:', l[1], 'Text:', l[2].replace(/<[^>]+>/g, '').trim());
    }
  } catch (e) {
    console.log('bpsc.teletalk.com.bd (HTTP) note:', e.message);
  }

  try {
    const resTeleS = await fetch('https://bpsc.teletalk.com.bd/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    console.log(`bpsc.teletalk.com.bd (HTTPS): HTTP ${resTeleS.status} ${resTeleS.statusText}`);
  } catch (e) {
    console.log('bpsc.teletalk.com.bd (HTTPS) note:', e.message);
  }
}

testBpscOfficial().catch(console.error);
