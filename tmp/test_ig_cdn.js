import fs from 'fs';

async function test() {
  const res = await fetch("https://www.instagram.com/reel/C8qLz0_xV8u/", {
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  const html = await res.text();
  console.log("Fetched html length:", html.length);

  const mp4s = [];
  const re = /(https?:[\\\/]+[a-zA-Z0-9_.-]+cdninstagram\.com[\\\/][^"'<>\s]+)/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const clean = match[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    mp4s.push(clean);
  }
  console.log("Total cdn links found:", mp4s.length);
  for (const link of mp4s) {
    if (link.includes('.mp4') || link.includes('video') || link.includes('bytestart')) {
      console.log("POTENTIAL VIDEO:", link.slice(0, 150));
    }
  }
  if (mp4s.length > 0) {
    console.log("Sample link:", mp4s[0].slice(0, 120));
  }
}

test();
