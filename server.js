import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ Puter Proxy (fetch version, no Playwright). Use POST /chat");
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

  try {
    // ⚡ Direct call to Perplexity API (same backend Puter.js uses)
    const response = await fetch("https://www.perplexity.ai/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0", // mimic browser
      },
      body: JSON.stringify({
        model: model || "perplexity/sonar",
        messages: [
          { role: "user", content: finalPrompt }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();

    res.json({ ok: true, answer: data });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
