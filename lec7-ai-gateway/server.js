import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const SECRET = process.env.LEC7_GATEWAY_SECRET || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const openai = OPENAI_API_KEY
  ? new OpenAI({ apiKey: OPENAI_API_KEY })
  : null;

function checkAuth(req, res) {
  const token = req.header("X-LEC7-GATEWAY-SECRET") || "";
  if (!SECRET || token !== SECRET) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  return true;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/v1/owner-agent", async (req, res) => {
  if (!checkAuth(req, res)) return;
  if (!openai) {
    return res.status(500).json({ error: "OPENAI_API_KEY missing" });
  }

  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Ты Owner Agent для Lec7. Отвечай кратко, по делу и в контексте платформы."
        },
        { role: "user", content: String(message) }
      ]
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || "";

    res.json({ reply });
  } catch (err) {
    console.error("AI gateway error:", err);
    res.status(500).json({ error: "gateway_failed" });
  }
});

app.listen(PORT, () => {
  console.log("lec7-ai-gateway listening on port", PORT);
});
