import { ok } from "@/lib/api/respond";
import { createWalletNonce } from "@/lib/auth/service";

export const runtime = "nodejs";

export async function GET() {
  const { id, nonce } = await createWalletNonce();
  const message = `永铭 Evermark 登录 / Sign in to Evermark\n\nNonce: ${nonce}`;
  return ok({ id, nonce, message });
}
