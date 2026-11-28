import { createClient, createConfig } from './generated/client';

export function browserClient() {
  return createClient(
    createConfig({
      baseUrl:
        typeof window === 'undefined'
          ? 'http://localhost'
          : window.location.origin,
      credentials: 'same-origin',
      cache: 'no-store',
    }),
  );
}

export type ApiResponse<T> = Omit<Response, 'json'> & { json(): Promise<T> };

// Preserve the existing UI's response/status handling while the SDK owns the wire format.
export async function apiResponse<T>(
  pending: Promise<{
    data?: T;
    error?: unknown;
    response?: Response;
  }>,
): Promise<ApiResponse<T>> {
  const result = await pending;
  if (!result.response) throw Error('通信に失敗しました。');
  const headers = new Headers(result.response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('transfer-encoding');
  return new Response(
    result.response.status === 204
      ? null
      : JSON.stringify(result.data ?? result.error),
    { status: result.response.status, headers },
  ) as ApiResponse<T>;
}
