import express from "express";
import puppeteer from "puppeteer";

const app = express();
app.use(express.json());

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
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
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

    const raw = await page.evaluate(async ({ finalPrompt, model }) => {
      try {
        const r = await window.puter.ai.chat(finalPrompt, { model: model || "perplexity/sonar" });
        return JSON.stringify(r);
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
    res.status(500).json({ error: err.message || String(err) });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
