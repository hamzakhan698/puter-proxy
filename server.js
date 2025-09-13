// server.js
import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

let browser;
let page;

// ✅ Launch Playwright once at startup and keep it alive
(async () => {
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    page = await browser.newPage();
    page.setDefaultTimeout(60000);

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <script src="https://js.puter.com/v2/"></script>
        </head>
        <body></body>
      </html>`;
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });

    // Wait until Puter is ready
    await page.waitForFunction(
      "window.puter && window.puter.ai && typeof window.puter.ai.chat === 'function'",
      { timeout: 60000 }
    );

    console.log("✅ Browser started and Puter.js loaded");
  } catch (err) {
    console.error("❌ Failed to init browser:", err);
  }
})();

// Root route
app.get("/", (req, res) => {
  res.send("✅ Puter Proxy is running (persistent Playwright)");
});

// Chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ") || auth.split(" ")[1] !== process.env.PROXY_SECRET) {
      return res.status(403).json({ error: "Forbidden - invalid token" });
    }

    if (!page) {
      return res.status(500).json({ error: "Browser not ready. Try again later." });
    }

    const { prompt, message, q, model, messages } = req.body;

    let finalPrompt = prompt || message || q;
    if (!finalPrompt && Array.isArray(messages)) {
      finalPrompt = messages.map(m => `${m.role}: ${m.content}`).join("\n");
    }

    if (!finalPrompt) {
      return res.status(400).json({ error: "Missing prompt or messages" });
    }

    // Evaluate inside the persistent browser page
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
    console.error("❌ Error in /chat:", err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Cleanup on shutdown
process.on("SIGINT", async () => {
  if (browser) await browser.close();
  process.exit();
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
