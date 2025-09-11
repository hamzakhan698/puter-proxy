import express from "express";
import puppeteer from "puppeteer";

const PORT = process.env.PORT || 3000;
const SECRET = process.env.PROXY_SECRET || "change_this_secret";

let browser;

async function startBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: "/usr/bin/chromium-browser",  // use system Chromium
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  console.log("Puppeteer launched with system Chromium");
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/", (req, res) => res.send("✅ Puter proxy is alive!"));

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    // Require Authorization header
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ") || auth.split(" ")[1] !== SECRET) {
      return res.status(403).json({ error: "Forbidden - invalid token" });
    }

    const prompt = req.body.prompt || req.body.message || req.body.q;
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Missing prompt in JSON body" });
    }

    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (compatible; PuterProxy/1.0)");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <script src="https://js.puter.com/v2/"></script>
        </head>
        <body></body>
      </html>`;
    await page.goto("data:text/html," + encodeURIComponent(html), {
      waitUntil: "load",
      timeout: 30000,
    });

    await page.waitForFunction("window.puter !== undefined", { timeout: 30000 });

    const raw = await page.evaluate(async (prompt) => {
      try {
        const r = await window.puter.ai.chat(prompt, { model: "perplexity/sonar" });
        return JSON.stringify(r);
      } catch (err) {
        return JSON.stringify({ __puter_error: err?.message || String(err) });
      }
    }, prompt);

    await page.close();

    let answer;
    try {
      answer = JSON.parse(raw);
    } catch {
      answer = raw;
    }

    return res.json({ ok: true, answer });
  } catch (err) {
    console.error("❌ Error in /chat:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  try {
    if (browser) await browser.close();
  } catch {}
  process.exit(0);
});

startBrowser()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`🚀 Puter proxy running on http://0.0.0.0:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Failed to start Puppeteer:", err);
    process.exit(1);
  });
