import * as SecureStore from "expo-secure-store";
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto";
import { Platform } from "react-native";
import { decodeBase64 } from "@/encryption/base64";

/** This device's copy of a workspace key, stored per server origin and identity.
 * It is not the only copy: communityWorkspaceConnect escrows the key with the
 * account server, which encrypts it at rest but can recover it (see SECURITY.md),
 * and returns it to any device that signs in to the same account. Sign-out
 * clears session/data, not this saved copy. On web it lives in localStorage. */
async function storageKey(origin: string, identityId: string) {
  return (
    "kissopen.oss.workspace-key." +
    (await digestStringAsync(CryptoDigestAlgorithm.SHA256, origin + "\n" + identityId))
  );
}
export async function communityWorkspaceKeyRead(
  origin: string,
  identityId: string,
): Promise<string | null> {
  const key = await storageKey(origin, identityId);
  const value =
    Platform.OS === "web" ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  if (!value) return null;
  if (decodeBase64(value, "base64url").length !== 32)
    throw new Error("The saved workspace key is invalid. Restore from your recovery key.");
  return value;
}
export async function communityWorkspaceKeySave(
  origin: string,
  identityId: string,
  secret: string,
) {
  const key = await storageKey(origin, identityId);
  if (decodeBase64(secret, "base64url").length !== 32) throw new Error("Invalid workspace key.");
  if (Platform.OS === "web") localStorage.setItem(key, secret);
  else await SecureStore.setItemAsync(key, secret);
}
