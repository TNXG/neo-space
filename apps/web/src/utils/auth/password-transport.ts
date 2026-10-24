"use client";

import type { DashboardEncryptedPassword } from "@/types/api";
import { getDashboardPasswordKey } from "@/lib/api-client";

/** 仅在浏览器使用后端公钥加密密码，返回可交给 Server Action 的密文。 */
export async function encryptDashboardPassword(password: string): Promise<DashboardEncryptedPassword> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("密码加密需要 HTTPS 安全环境，请使用 HTTPS 或本机地址访问。");
  }
  const response = await getDashboardPasswordKey();
  const key = response.data;
  if (response.status !== "success" || !key || key.algorithm !== "RSA-OAEP-256" || !key.keyId || !key.publicKey) {
    throw new Error("无法获取密码加密公钥，请稍后重试。");
  }
  const pem = key.publicKey.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replace(/\s+/g, "");
  const spki = Uint8Array.from(atob(pem), char => char.charCodeAt(0));
  const cryptoKey = await window.crypto.subtle.importKey(
    "spki", spki, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"],
  );
  const encoded = new TextEncoder().encode(password);
  try {
    // 4096-bit RSA-OAEP/SHA-256 的最大消息长度为 512 - 2 * 32 - 2 字节。
    const maxBytes = (cryptoKey.algorithm as RsaHashedKeyAlgorithm).modulusLength / 8 - 66;
    if (!encoded.length || encoded.length > maxBytes) {
      throw new Error("密码长度超出加密协议支持的范围。");
    }
    const ciphertext = await window.crypto.subtle.encrypt({ name: "RSA-OAEP" }, cryptoKey, encoded);
    return {
      encryptedPassword: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      keyId: key.keyId,
    };
  } finally {
    encoded.fill(0);
  }
}
