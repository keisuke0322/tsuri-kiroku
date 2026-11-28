export async function sessionRequest(
  start: () => Promise<Response>,
  isLeaving: () => boolean,
  onUnauthorized: () => void,
): Promise<Response> {
  if (isLeaving()) throw Error('ログイン画面へ移動しています。');
  const response = await start();
  if (response.status === 401) {
    onUnauthorized();
    throw Error('ログインしてください。');
  }
  return response;
}
