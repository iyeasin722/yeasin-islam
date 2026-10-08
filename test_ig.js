const testShortcodes = ["Dd75uqqymQs", "C2iTfF5sF0c", "C8qX-SjM8-q"];

async function testEmbed(shortcode) {
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });
    const html = await res.text();
    // Look for video_url or mp4
    const match = html.match(/"video_url":\s*"([^"]+)"/) ||
                  html.match(/video_url&quot;:&quot;([^&]+)&quot;/) ||
                  html.match(/<video[^>]+src="([^">]+)"/);
    if (match) {
      let u = match[1].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
      console.log(`[Embed] ${shortcode} -> Found video URL:`, u.slice(0, 80));
      return u;
    } else {
      console.log(`[Embed] ${shortcode} -> No video URL in HTML. HTML length:`, html.length);
    }
  } catch (err) {
    console.log(`[Embed] ${shortcode} -> Error:`, err.message);
  }
  return null;
}

async function testOembed(shortcode) {
  try {
    const res = await fetch(`https://api.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[Oembed] ${shortcode} -> Title:`, data.title, "Author:", data.author_name);
      return data;
    } else {
      console.log(`[Oembed] ${shortcode} -> Status:`, res.status);
    }
  } catch (err) {
    console.log(`[Oembed] ${shortcode} -> Error:`, err.message);
  }
  return null;
}

(async () => {
  for (const sc of testShortcodes) {
    console.log(`\n=== Testing ${sc} ===`);
    await testEmbed(sc);
    await testOembed(sc);
  }
})();
