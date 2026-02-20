const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Convert string to ArrayBuffer
function str2ab(str) {
  return new TextEncoder().encode(str);
}

// Base32 encode
function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

// Base32 decode with safe filtering
function base32Decode(str) {
  // Remove all non-Base32 chars (spaces, newlines, etc)
  str = str.replace(/[^A-Z2-7]/gi, "");
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(Math.floor((str.length * 5) / 8));

  for (let char of str) {
    const idx = BASE32_ALPHABET.indexOf(char.toUpperCase());
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }

  return output.slice(0, index);
}

// Derive AES-GCM key from PSK
async function deriveKey(psk) {
  const salt = str2ab("fixedSaltForNow");
  const keyMaterial = await crypto.subtle.importKey("raw", str2ab(psk), { name: "PBKDF2" }, false, ["deriveKey"]);

  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// Encrypt message
async function encryptMessage(psk, plaintext) {
  const key = await deriveKey(psk);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, str2ab(plaintext));

  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);

  console.log("Encrypt debug:", {
    plaintext,
    iv,
    cipherBytes,
    combined,
  });

  return base32Encode(combined);
}

// Decrypt message
async function decryptMessage(psk, base32Data) {
  const data = base32Decode(base32Data);

  const iv = data.slice(0, 12);
  const cipher = data.slice(12);
  const cipherBuffer = cipher.buffer.slice(cipher.byteOffset, cipher.byteOffset + cipher.byteLength);

  console.log("Decrypt debug:", {
    base32Data,
    iv,
    cipher,
    cipherBufferLength: cipherBuffer.byteLength,
  });

  const key = await deriveKey(psk);
  const plaintextBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBuffer);

  return new TextDecoder().decode(plaintextBuffer);
}