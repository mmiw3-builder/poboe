/**
 * Irys network configuration, resolved from environment variables.
 * Server-only (private key). See README for the full variable list.
 */

export type IrysNetwork = "mainnet" | "devnet";

export interface IrysServerConfig {
  network: IrysNetwork;
  /** EVM private key funding all uploads (server-paid model). */
  privateKey: string;
  /** RPC endpoint for the payment token chain (required on devnet). */
  rpcUrl?: string;
  gatewayUrl: string;
  graphqlUrl: string;
  /** App-Name tag value; devnet gets a distinct value so test data never mixes into production reads. */
  appTag: string;
}

const MAINNET_UPLOADER = "https://uploader.irys.xyz";
const DEVNET_UPLOADER = "https://devnet.irys.xyz";
const DEFAULT_GATEWAY = "https://gateway.irys.xyz";

export function getIrysNetwork(): IrysNetwork {
  return process.env.IRYS_NETWORK === "mainnet" ? "mainnet" : "devnet";
}

export function getAppTag(network: IrysNetwork = getIrysNetwork()): string {
  const base = process.env.IRYS_APP_TAG ?? "poboe-evermark";
  return network === "devnet" ? `${base}-dev` : base;
}

export function getGraphqlUrl(network: IrysNetwork = getIrysNetwork()): string {
  return `${network === "mainnet" ? MAINNET_UPLOADER : DEVNET_UPLOADER}/graphql`;
}

export function getGatewayUrl(): string {
  return process.env.NEXT_PUBLIC_IRYS_GATEWAY_URL ?? DEFAULT_GATEWAY;
}

export function gatewayUrlFor(txId: string): string {
  return `${getGatewayUrl()}/${txId}`;
}

export function getIrysServerConfig(): IrysServerConfig {
  const network = getIrysNetwork();
  const privateKey = process.env.IRYS_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "IRYS_PRIVATE_KEY is not set — the server wallet that funds uploads is required.",
    );
  }
  return {
    network,
    privateKey,
    rpcUrl: process.env.IRYS_RPC_URL,
    gatewayUrl: getGatewayUrl(),
    graphqlUrl: getGraphqlUrl(network),
    appTag: getAppTag(network),
  };
}
