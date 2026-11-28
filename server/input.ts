import * as v from 'valibot';
import { ApiError } from '../app/api/access';

export async function readJson<T extends v.GenericSchema>(
  request: Request,
  schema: T,
): Promise<v.InferOutput<T>> {
  const input: unknown = await request.json();
  const result = v.safeParse(schema, input);
  if (!result.success) throw new ApiError(400, '入力内容を確認してください。');
  return result.output;
}
