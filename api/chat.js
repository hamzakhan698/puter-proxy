import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ") || auth.split(" ")[1] !== process.env.PROXY_SECRET) {
    return res.status(403).json({ error: "Forbidden - invalid token" });
  }

  const prompt = req.body.prompt || req.body.message || req.body.q;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });

    const page = await browser.newPage();
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <script src="https://js.puter.com/v2/"></script>
        </head>
        <body></body>
      </html>`;
    await page.setContent(html, { waitUntil: "load" });

    await page.waitForFunction("window.puter !== undefined", { timeout: 30000 });

    const raw = await page.evaluate(async (prompt) => {
      try {
        const r = await window.puter.ai.chat(prompt, { model: "perplexity/sonar" });
        return JSON.stringify(r);
      } catch (err) {
        return JSON.stringify({ __puter_error: err?.message || String(err) });
      }
    }, prompt);

    let answer;
    try {
      answer = JSON.parse(raw);
    } catch {
      answer = raw;
    }

    res.json({ ok: true, answer });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}
