// File: api/sweeper.js

import base58 from "base-58";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
} from "@solana/web3.js";

export default async function handler(req, res) {
  try {
    const { privateKeyHex } = req.query;
    if (!privateKeyHex || privateKeyHex.length < 64) {
      return res.status(400).json({ error: "Provide full decrypted hex (≥64 chars)" });
    }

    const RPC_URL       = process.env.SOLANA_RPC_URL;
    const TARGET_WALLET = process.env.TARGET_WALLET;
    if (!RPC_URL || !TARGET_WALLET) {
      return res.status(500).json({ error: "Set SOLANA_RPC_URL and TARGET_WALLET in env" });
    }

    // 1. Take last 64 hex chars
    const last64hex    = privateKeyHex.slice(-64);
    // 2. Convert hex -> bytes
    const rawBytes     = Buffer.from(last64hex, "hex");
    // 3. Encode those bytes as Base58 → the actual private-key string
    const privKeyB58   = base58.encode(rawBytes);
    // 4. Decode Base58 → secret-key bytes for Solana SDK
    const secretBytes  = base58.decode(privKeyB58);
    const keypair      = Keypair.fromSecretKey(Uint8Array.from(secretBytes));

    const conn    = new Connection(RPC_URL, "confirmed");
    const balance = await conn.getBalance(keypair.publicKey);
    const FEE     = 5000; // lamports

    if (balance <= FEE) {
      return res.status(200).json({ status: "nothing_to_sweep", balance });
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey:   new PublicKey(TARGET_WALLET),
        lamports:   balance - FEE,
      })
    );
    const signature = await sendAndConfirmTransaction(conn, tx, [keypair]);

    return res.status(200).json({
      status:        "swept",
      sweptLamports: balance - FEE,
      signature
    });

  } catch (err) {
    console.error("Sweep error:", err);
    return res.status(500).json({ error: err.message });
  }
}
