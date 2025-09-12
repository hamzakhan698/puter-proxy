import express from "express";
import { chromium } from "playwright";

const app = express();
app.use(express.json());

// ✅ Root route to confirm the service is running
app.get("/", (req, res) => {
  res.send("✅ Puter Proxy is running (Playwright). Use POST /chat");
});

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

  let browser;
  try {
    console.log("🚀 Launching Playwright Chromium...");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    console.log("📄 Loading blank page with Puter.js...");
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <script src="https://js.puter.com/v2/"></script>
        </head>
        <body></body>
      </html>`;
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    console.log("⏳ Waiting for window.puter...");
    await page.waitForFunction("window.puter !== undefined", { timeout: 30000 });
    console.log("✅ window.puter loaded");

    console.log("💬 Sending prompt to puter.ai.chat:", finalPrompt.slice(0, 80));
    const raw = await page.evaluate(async ({ finalPrompt, model }) => {
      try {
        const result = await Promise.race([
          window.puter.ai.chat(finalPrompt, { model: model || "perplexity/sonar" }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout inside browser eval")), 45000)
          )
        ]);
        return JSON.stringify(result);
      } catch (err) {
        return JSON.stringify({ __puter_error: err?.message || String(err) });
      }
    }, { finalPrompt, model });

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
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
