import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ Puter Proxy (official API). Use POST /chat");
});

app.post("/chat", async (req, res) => {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ") || auth.split(" ")[1] !== process.env.PROXY_SECRET) {
    return res.status(403).json({ error: "Forbidden - invalid token" });
  }

  const { prompt, message, q, model, messages } = req.body;

  let finalPrompt = prompt || message || q;
  let finalMessages = messages;
  if (!finalMessages && finalPrompt) {
    finalMessages = [{ role: "user", content: finalPrompt }];
  }

  if (!finalMessages) {
    return res.status(400).json({ error: "Missing prompt or messages" });
  }

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PPLX_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "sonar-small-chat",
        messages: finalMessages,
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
