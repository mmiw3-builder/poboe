import { describe, expect, it } from "vitest";
import { canonicalStringify } from "../canonical";
import { base64UrlToBytes, bytesToBase64Url } from "../codec";
import { generateKeyPair, publicKeyOf, signMessage, verifyMessage } from "../crypto";
import {
  deriveMemorialId,
  signManifest,
  signModerationRecord,
  verifyManifest,
  verifyModerationRecord,
} from "./identity";
import {
  SCHEMA_MEMORIAL,
  SCHEMA_MODERATION,
  memorialManifestSchema,
  type MemorialManifest,
  type UnsignedMemorialManifest,
} from "./schema";

function makeUnsignedManifest(
  ownerPubKey: string,
  nonce: string,
): UnsignedMemorialManifest {
  return {
    schemaId: SCHEMA_MEMORIAL,
    id: deriveMemorialId(ownerPubKey, nonce),
    nonce,
    ownerPubKey,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    version: 1,
    lang: "zh",
    subject: {
      name: "测试者",
      epitaph: "山高水长",
    },
    media: [],
    tributesEnabled: true,
  };
}

describe("codec", () => {
  it("round-trips base64url", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });
});

describe("canonicalStringify", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalStringify({ b: 1, a: { d: undefined, c: [2, { z: 1, y: 2 }] } }))
      .toBe('{"a":{"c":[2,{"y":2,"z":1}]},"b":1}');
  });
});

describe("crypto", () => {
  it("signs and verifies", () => {
    const kp = generateKeyPair();
    const sig = signMessage("hello", kp.secretKey);
    expect(verifyMessage("hello", sig, kp.publicKey)).toBe(true);
    expect(verifyMessage("hello!", sig, kp.publicKey)).toBe(false);
    expect(publicKeyOf(kp.secretKey)).toBe(kp.publicKey);
  });

  it("rejects malformed inputs without throwing", () => {
    expect(verifyMessage("m", "not-a-sig", "not-a-key")).toBe(false);
  });
});

describe("memorial identity", () => {
  it("derives a stable 22-char id bound to key and nonce", () => {
    const kp = generateKeyPair();
    const id = deriveMemorialId(kp.publicKey, "nonce-1");
    expect(id).toHaveLength(22);
    expect(deriveMemorialId(kp.publicKey, "nonce-1")).toBe(id);
    expect(deriveMemorialId(kp.publicKey, "nonce-2")).not.toBe(id);
    expect(deriveMemorialId(generateKeyPair().publicKey, "nonce-1")).not.toBe(id);
  });

  it("signs a manifest that passes schema validation and verification", () => {
    const kp = generateKeyPair();
    const manifest = signManifest(
      makeUnsignedManifest(kp.publicKey, "abcd1234"),
      kp.secretKey,
    );
    expect(memorialManifestSchema.parse(manifest)).toBeTruthy();
    expect(verifyManifest(manifest)).toBe(true);
  });

  it("rejects a manifest tampered after signing", () => {
    const kp = generateKeyPair();
    const manifest = signManifest(
      makeUnsignedManifest(kp.publicKey, "abcd1234"),
      kp.secretKey,
    );
    const tampered: MemorialManifest = {
      ...manifest,
      subject: { ...manifest.subject, name: "冒名者" },
    };
    expect(verifyManifest(tampered)).toBe(false);
  });

  it("rejects an id claimed by a different keypair", () => {
    const owner = generateKeyPair();
    const attacker = generateKeyPair();
    const stolen = makeUnsignedManifest(owner.publicKey, "abcd1234");
    // Attacker republishes the same id under their own key.
    const forged = signManifest(
      { ...stolen, ownerPubKey: attacker.publicKey },
      attacker.secretKey,
    );
    expect(verifyManifest(forged)).toBe(false);
  });
});

describe("schema v2 signature compatibility", () => {
  it("keeps verifying v1-era manifests (no events/dates/voice fields)", () => {
    const kp = generateKeyPair();
    // Exactly what the v1 client produced — no v2 fields at all.
    const signed = signManifest(
      makeUnsignedManifest(kp.publicKey, "abcd1234"),
      kp.secretKey,
    );
    const wire = JSON.parse(JSON.stringify(signed));
    // Read path: parse then verify. Parsing must NOT inject new fields.
    const parsed = memorialManifestSchema.parse(wire);
    expect(parsed.events).toBeUndefined();
    expect(parsed.approvedContributions).toBeUndefined();
    expect(verifyManifest(parsed)).toBe(true);
  });

  it("signs and verifies manifests carrying the v2 fields", () => {
    const kp = generateKeyPair();
    const unsigned = {
      ...makeUnsignedManifest(kp.publicKey, "abcd1234"),
      events: [{ year: "1936", title: "生于江南", detail: "水乡人家" }],
      approvedContributions: ["A".repeat(43)],
      subject: {
        name: "测试者",
        bornDate: "1936-03",
        diedDate: "2024-01-15",
        voice: {
          txId: "B".repeat(43),
          kind: "audio" as const,
          contentType: "audio/mpeg",
        },
      },
    };
    const signed = signManifest(unsigned, kp.secretKey);
    const parsed = memorialManifestSchema.parse(
      JSON.parse(JSON.stringify(signed)),
    );
    expect(parsed.events).toHaveLength(1);
    expect(verifyManifest(parsed)).toBe(true);
  });
});

describe("moderation records", () => {
  it("verifies only against the trusted admin key", () => {
    const admin = generateKeyPair();
    const rogue = generateKeyPair();
    const record = signModerationRecord(
      {
        schemaId: SCHEMA_MODERATION,
        action: "hide",
        targetType: "memorial",
        targetId: "abc",
        createdAt: 1700000000000,
        adminPubKey: admin.publicKey,
      },
      admin.secretKey,
    );
    expect(verifyModerationRecord(record, admin.publicKey)).toBe(true);
    expect(verifyModerationRecord(record, rogue.publicKey)).toBe(false);
  });
});
