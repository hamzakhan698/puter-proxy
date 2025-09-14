import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

// Persistent browser to reduce startup delays
let browser;
let page;

async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    page = await browser.newPage();
    await page.setContent(
      `<!doctype html>
      <html>
        <head><meta charset="utf-8"/></head>
        <body><script src="https://js.puter.com/v2/"></script></body>
      </html>`,
      { waitUntil: "load", timeout: 60000 }
    );

    await page.waitForFunction(
      "window.puter && window.puter.ai && typeof window.puter.ai.chat === 'function'",
      { timeout: 60000 }
    );
    console.log("✅ Browser initialized and Puter.js ready");
  }
}

// Root route
app.get("/", (req, res) => {
  res.send("✅ Puter Proxy running on Fly.io (Perplexity). Use POST /chat");
});

// Chat route
app.post("/chat", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ") || auth.split(" ")[1] !== process.env.PROXY_SECRET) {
    return res.status(403).json({ error: "Forbidden - invalid token" });
  }

  const { prompt, message, q, model, messages } = req.body;

  let finalPrompt = prompt || message || q;
  if (!finalPrompt && Array.isArray(messages)) {
    finalPrompt = messages.map(m => `${m.role}: ${m.content}`).join("\n");
  }

  if (!finalPrompt) {
    return res.status(400).json({ error: "Missing prompt or messages" });
  }

  try {
    await initBrowser();

    const raw = await page.evaluate(
      async ({ finalPrompt, model }) => {
        try {
          const r = await window.puter.ai.chat(finalPrompt, {
            model: model || "perplexity/sonar",
          });
          return JSON.stringify(r);
        } catch (err) {
          return JSON.stringify({ __puter_error: err?.message || String(err) });
        }
      },
      { finalPrompt, model }
    );

    let answer;
    try {
      answer = JSON.parse(raw);
    } catch {
      answer = raw;
    }

    res.json({ ok: true, answer });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
