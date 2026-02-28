// ---------------------------------------------------------------------------
// ChatGPT API helpers – runs inside the bookmarklet on chatgpt.com
// ---------------------------------------------------------------------------

const BASE = "https://chatgpt.com";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Fetches the current session's access token from the ChatGPT auth endpoint.
 * Throws if the user is not logged in (401) or the request fails.
 */
export async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/session`);

  if (res.status === 401) {
    throw new Error("Please log in to ChatGPT before running this bookmarklet.");
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch session (HTTP ${res.status}).`);
  }

  const data = await res.json();
  return data.accessToken;
}

// ---------------------------------------------------------------------------
// Conversation list
// ---------------------------------------------------------------------------

export interface ConversationListItem {
  id: string;
  title?: string;
  create_time?: number;
}

/**
 * Fetches the full list of conversations by paginating through the
 * `/backend-api/conversations` endpoint.
 *
 * @param token       Bearer access token
 * @param pageSize    Number of conversations per page (default 20)
 * @param onProgress  Optional callback invoked after each page:
 *                    `(fetchedSoFar, total) => void`
 */
export async function fetchConversationList(
  token: string,
  pageSize = 20,
  onProgress?: (fetched: number, total: number) => void,
): Promise<ConversationListItem[]> {
  const all: ConversationListItem[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${BASE}/backend-api/conversations?offset=${offset}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch conversation list (HTTP ${res.status}).`);
    }

    const data = await res.json();
    const items: ConversationListItem[] = data.items ?? [];

    if (items.length === 0) {
      // Server returned no more items – we're done even if total says otherwise.
      if (onProgress) onProgress(all.length, data.total ?? all.length);
      break;
    }

    all.push(...items);

    if (onProgress) onProgress(all.length, data.total ?? all.length);

    if (all.length >= (data.total ?? all.length)) {
      break;
    }

    offset += items.length;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Single conversation
// ---------------------------------------------------------------------------

/**
 * Fetches a single conversation by ID.
 *
 * @param id     Conversation UUID
 * @param token  Bearer access token
 */
export async function fetchConversation(
  id: string,
  token: string,
): Promise<unknown> {
  const res = await fetch(`${BASE}/backend-api/conversation/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 429) {
    throw new Error(
      "Rate limited by ChatGPT. Please wait a moment and try again.",
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to fetch conversation ${id} (HTTP ${res.status}).`,
    );
  }

  return res.json();
}
