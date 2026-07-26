import type { NextRequest } from "next/server";
import { errors } from "@/lib/api/respond";
import { getGatewayUrl } from "@/lib/irys/config";
import { getMemorial, listContributions, listTributes } from "@/lib/memorial/repo";

export const runtime = "nodejs";

/**
 * Self-custody archive: everything needed to reconstruct the memorial
 * without this website — the signed manifest, its txId, and gateway URLs
 * for every media item, plus tributes and contributions.
 */
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/export/[id]">,
) {
  const { id } = await ctx.params;
  const result = await getMemorial(id);
  if (!result) return errors.notFound("Memorial not found.");
  const { manifest, txId } = result;
  const gateway = getGatewayUrl();

  const [tributes, contributions] = await Promise.all([
    listTributes(id, { limit: 100 }),
    listContributions(id),
  ]);

  const media = [
    ...(manifest.subject.portrait ? [manifest.subject.portrait] : []),
    ...(manifest.subject.voice ? [manifest.subject.voice] : []),
    ...manifest.media,
  ].map((m) => ({ ...m, url: `${gateway}/${m.txId}` }));

  const archive = {
    format: "poboe-evermark/archive@1",
    exportedAt: new Date().toISOString(),
    note: "This archive is self-contained: the manifest is signed by the owner's key and every URL points to permanent decentralized storage, independent of any single website. / 本存档自成一体：manifest 由所有者密钥签名，所有链接指向永久去中心化存储，不依赖任何单一网站。",
    memorialId: id,
    manifestTxId: txId,
    manifestUrl: `${gateway}/${txId}`,
    manifest,
    media,
    tributes: tributes.items,
    contributions,
  };

  return new Response(JSON.stringify(archive, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="evermark-archive-${id}.json"`,
    },
  });
}
