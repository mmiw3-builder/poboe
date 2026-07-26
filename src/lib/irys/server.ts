import { Uploader } from "@irys/upload";
import { Ethereum } from "@irys/upload-ethereum";
import { getIrysServerConfig } from "./config";

/**
 * Server-side Irys uploader (server-paid model). All uploads are funded by
 * the wallet configured in IRYS_PRIVATE_KEY. Never import from client code.
 */

export interface IrysTag {
  name: string;
  value: string;
}

type IrysUploader = Awaited<ReturnType<ReturnType<typeof Uploader>["build"]>>;

let uploaderPromise: Promise<IrysUploader> | null = null;

export function getIrysUploader(): Promise<IrysUploader> {
  if (!uploaderPromise) {
    uploaderPromise = buildUploader();
    // A failed build (e.g. transient RPC error) must not poison the cache.
    uploaderPromise.catch(() => {
      uploaderPromise = null;
    });
  }
  return uploaderPromise;
}

async function buildUploader(): Promise<IrysUploader> {
  const cfg = getIrysServerConfig();
  let builder = Uploader(Ethereum).withWallet(cfg.privateKey);
  builder =
    cfg.network === "mainnet" ? builder.mainnet() : builder.devnet();
  if (cfg.rpcUrl) builder = builder.withRpc(cfg.rpcUrl);
  return builder.build();
}

export interface UploadResult {
  /** Irys transaction id — the permanent address of the data. */
  id: string;
  timestamp: number;
}

export async function uploadBuffer(
  data: Buffer,
  tags: IrysTag[],
): Promise<UploadResult> {
  const irys = await getIrysUploader();
  const receipt = await irys.upload(data, { tags });
  return { id: receipt.id, timestamp: receipt.timestamp ?? Date.now() };
}

export async function uploadJson(
  value: unknown,
  tags: IrysTag[],
): Promise<UploadResult> {
  const body = Buffer.from(JSON.stringify(value), "utf8");
  const withContentType = [
    { name: "Content-Type", value: "application/json" },
    ...tags.filter((t) => t.name !== "Content-Type"),
  ];
  return uploadBuffer(body, withContentType);
}

/** Diagnostics for the admin/status endpoint. */
export async function getUploaderStatus(): Promise<{
  address: string;
  network: string;
  balance: string;
  pricePerMb: string;
}> {
  const cfg = getIrysServerConfig();
  const irys = await getIrysUploader();
  const [balance, price] = await Promise.all([
    irys.getBalance(),
    irys.getPrice(1024 * 1024),
  ]);
  return {
    address: irys.address ?? "unknown",
    network: cfg.network,
    balance: balance.toString(),
    pricePerMb: price.toString(),
  };
}
