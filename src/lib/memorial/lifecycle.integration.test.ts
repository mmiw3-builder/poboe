import { describe, expect, it } from "vitest";
import { generateKeyPair } from "../crypto";
import { deriveMemorialId, signManifest, verifyManifest } from "./identity";
import { getMemorial } from "./repo";
import { SCHEMA_MEMORIAL, TAGS, type UnsignedMemorialManifest } from "./schema";

/**
 * Live devnet integration: publishes v1 + v2 of a memorial through the real
 * Irys uploader and asserts the read path returns the superseding version.
 * Runs only when IRYS_PRIVATE_KEY is configured (e.g. `IRYS_NETWORK=devnet
 * IRYS_PRIVATE_KEY=0x... npx vitest run lifecycle.integration`); skipped in
 * plain `npm test`.
 */
const hasEnv = Boolean(process.env.IRYS_PRIVATE_KEY);

describe.skipIf(!hasEnv)("memorial lifecycle on devnet", () => {
  it(
    "publishes v1 and v2, read path picks the highest valid version",
    { timeout: 180_000 },
    async () => {
      const { uploadJson } = await import("../irys/server");
      const { getAppTag } = await import("../irys/config");

      const kp = generateKeyPair();
      const nonce = crypto.randomUUID();
      const id = deriveMemorialId(kp.publicKey, nonce);
      const now = Date.now();

      const base: UnsignedMemorialManifest = {
        schemaId: SCHEMA_MEMORIAL,
        id,
        nonce,
        ownerPubKey: kp.publicKey,
        createdAt: now,
        updatedAt: now,
        version: 1,
        lang: "zh",
        subject: { name: "集成测试者", epitaph: "第一版" },
        media: [],
        tributesEnabled: true,
      };

      const tags = [
        { name: TAGS.appName, value: getAppTag() },
        { name: TAGS.type, value: "memorial" },
        { name: TAGS.memorialId, value: id },
      ];

      const v1 = signManifest(base, kp.secretKey);
      expect(verifyManifest(v1)).toBe(true);
      await uploadJson(v1, tags);

      const v2 = signManifest(
        {
          ...base,
          version: 2,
          updatedAt: Date.now(),
          subject: { name: "集成测试者", epitaph: "第二版" },
        },
        kp.secretKey,
      );
      await uploadJson(v2, tags);

      // Indexing is eventually consistent — poll briefly.
      let manifest = null;
      for (let i = 0; i < 12 && manifest?.version !== 2; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        manifest = (await getMemorial(id))?.manifest ?? null;
      }
      expect(manifest?.version).toBe(2);
      expect(manifest?.subject.epitaph).toBe("第二版");
    },
  );
});
