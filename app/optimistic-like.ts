export type LikeState = { liked: boolean; likeCount: number };

// The view changes before the first await. Commit authoritative counts on success;
// restore the snapshot on failure, including network failures after a write.
export async function updateLikeOptimistically(
  previous: LikeState,
  publish: (state: LikeState) => void,
  save: (liked: boolean) => Promise<LikeState>,
) {
  const liked = !previous.liked;
  publish({ liked, likeCount: Math.max(0, previous.likeCount + (liked ? 1 : -1)) });
  try {
    publish(await save(liked));
  } catch (error) {
    publish(previous);
    throw error;
  }
}
