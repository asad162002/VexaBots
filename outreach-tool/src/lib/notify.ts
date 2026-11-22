// Alerts for things a person needs to know about within seconds, currently an inbound
// call from a business that was cold called earlier.
//
// Telegram is used when the two environment values are present. Without them this is
// a no-op that logs, so nothing breaks and no credentials live in the repo:
//   TELEGRAM_BOT_TOKEN   the bot token
//   TELEGRAM_CHAT_ID     the chat or group to post to

export async function sendAlert(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(`[alert] Telegram is not configured, would have sent: ${text}`);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      // Read the body for the reason, but never let a failed alert break the caller.
      const body = await res.text();
      console.error(`Telegram alert failed (${res.status}): ${body.slice(0, 300)}`);
    }
  } catch (err) {
    console.error('Telegram alert threw:', err);
  }
}
