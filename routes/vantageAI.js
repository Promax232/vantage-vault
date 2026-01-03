const express = require('express');
const router = express.Router();
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

router.post('/vantage-chat/:id', async (req, res) => {
    const { id } = req.params;
    const { message } = req.body;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are the Vantage OS Intelligence Core. Provide concise, high-level tactical analysis on anime. Use a cyberpunk, HUD-style tone. Current Year: 2026."
                },
                {
                    role: "user",
                    content: `Inquiry regarding Subject ID ${id}: ${message}`
                }
            ],
            model: "llama-3.3-70b-versatile", // Or your preferred Groq model
        });

        const responseText = completion.choices[0].message.content;
        res.json({ response: responseText });

    } catch (e) {
        console.error("AI Uplink Failed:", e);
        res.status(500).json({ response: "CRITICAL ERROR: AI NODE UNREACHABLE." });
    }
});

module.exports = router;