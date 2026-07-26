import { getGatewayUrl, getGraphqlUrl } from "./config";

/**
 * Thin typed client for the Irys GraphQL index + gateway reads.
 * Public data only — safe for any server code path.
 */

export interface TagFilter {
  name: string;
  values: string[];
}

export interface IrysTxNode {
  id: string;
  address: string;
  timestamp: number;
  tags: { name: string; value: string }[];
}

export interface TxPage {
  nodes: IrysTxNode[];
  endCursor: string | null;
  hasNextPage: boolean;
}

const TX_QUERY = `
query ($tags: [TagFilter!], $first: Int, $after: String, $order: SortOrder) {
  transactions(tags: $tags, first: $first, after: $after, order: $order) {
    edges {
      node { id address timestamp tags { name value } }
      cursor
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

export async function queryTransactions(options: {
  tags: TagFilter[];
  first?: number;
  after?: string | null;
  order?: "ASC" | "DESC";
  /** Seconds to cache the index response; 0 disables caching. */
  revalidate?: number;
}): Promise<TxPage> {
  const res = await fetch(getGraphqlUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: TX_QUERY,
      variables: {
        tags: options.tags,
        first: options.first ?? 50,
        after: options.after ?? null,
        order: options.order ?? "DESC",
      },
    }),
    next: { revalidate: options.revalidate ?? 30 },
  });
  if (!res.ok) {
    throw new Error(`Irys GraphQL error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    errors?: { message: string }[];
    data?: {
      transactions: {
        edges: { node: IrysTxNode; cursor: string }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  };
  if (json.errors?.length) {
    throw new Error(`Irys GraphQL error: ${json.errors[0].message}`);
  }
  const tx = json.data?.transactions;
  return {
    nodes: tx?.edges.map((e) => e.node) ?? [],
    endCursor: tx?.pageInfo.endCursor ?? null,
    hasNextPage: tx?.pageInfo.hasNextPage ?? false,
  };
}

const MAX_JSON_BYTES = 256 * 1024;

/**
 * Fetch an immutable JSON record from the gateway. Content at a txId can
 * never change, so successful responses are cached indefinitely.
 */
export async function fetchTxJson<T = unknown>(txId: string): Promise<T | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(txId)) return null;
  try {
    const res = await fetch(`${getGatewayUrl()}/${txId}`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_JSON_BYTES) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function tagValue(node: IrysTxNode, name: string): string | undefined {
  return node.tags.find((t) => t.name === name)?.value;
}
