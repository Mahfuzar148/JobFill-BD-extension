import https from 'https';

function requestWithCookies(url, options = {}, cookies = '') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.0.0 Safari/537.36',
      ...(options.headers || {})
    };
    if (cookies) headers['Cookie'] = cookies;

    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      rejectUnauthorized: false,
      headers
    }, async res => {
      let body = '';
      for await (const chunk of res) body += chunk;
      const setCookies = res.headers['set-cookie'] || [];
      const newCookies = setCookies.map(c => c.split(';')[0]).join('; ');
      const combinedCookies = [cookies, newCookies].filter(Boolean).join('; ');
      resolve({ statusCode: res.statusCode, headers: res.headers, body, cookies: combinedCookies });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('1. Fetching apply.php...');
  const res1 = await requestWithCookies('https://bpsc.teletalk.com.bd/ncad/apply.php');

  console.log('2. Selecting circular in applynow.php...');
  const postData1 = 'ix=' + encodeURIComponent('202608#83-96/2026#30 October 2026') + '&next=' + encodeURIComponent('Apply Now');
  const res2 = await requestWithCookies('https://bpsc.teletalk.com.bd/ncad/applynow.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData1),
      'Referer': 'https://bpsc.teletalk.com.bd/ncad/apply.php'
    },
    body: postData1
  }, res1.cookies);

  console.log('3. Selecting post in application.php...');
  const postData2 = 'postid=260083&next=' + encodeURIComponent('Next');
  const res3 = await requestWithCookies('https://bpsc.teletalk.com.bd/ncad/application.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData2),
      'Referer': 'https://bpsc.teletalk.com.bd/ncad/applynow.php'
    },
    body: postData2
  }, res2.cookies);

  console.log('application.php Status:', res3.statusCode, 'Length:', res3.body.length);
  const title = res3.body.match(/<title>(.*?)<\/title>/i)?.[1];
  console.log('Title:', title);
  const forms = res3.body.match(/<form[\s\S]*?<\/form>/gi) || [];
  console.log('Forms count:', forms.length);
  if (forms.length > 0) {
    const inputs = Array.from(forms[0].matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
    const selects = Array.from(forms[0].matchAll(/<select[^>]*name=["']([^"']+)["'][^>]*>/gi)).map(m => m[1]);
    console.log('Inputs count:', inputs.length, 'Input names:', inputs);
    console.log('Selects count:', selects.length, 'Select names:', selects);
  } else {
    console.log('Body preview:', res3.body.slice(0, 500));
  }
}

run().catch(console.error);
