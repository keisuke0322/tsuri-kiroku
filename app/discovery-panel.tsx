import { Fish, Heart, CalendarDays } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from './profile-dialog';
import PhotoViewer from './photo-viewer';
import {
  aggregateDiscovery,
  type DiscoveryEntry,
  type Period,
} from './discovery';
import LocationMapDialog from './location-map-dialog';
import type { LocationEntry } from './location-privacy';
import { appStyles } from '@/lib/app-styles';
import { cn } from '@/lib/utils';

type Entry = DiscoveryEntry &
  LocationEntry & {
    photos: { id: number; species: string }[];
    featured_photo_id: number | null;
    owner_id: string;
    authorName: string;
    location: string;
    liked: boolean;
  };

export default function DiscoveryPanel<T extends Entry>({
  mapsApiKey,
  items,
  days,
  onDays,
  now,
  onSpecies,
  onProfile,
  onLike,
  busyLikes,
}: {
  mapsApiKey: string;
  items: T[];
  days: Period;
  onDays: (days: Period) => void;
  now: Date;
  onSpecies: (species: string) => void;
  onProfile: (id: string) => void;
  onLike: (item: T) => void;
  busyLikes: Set<number>;
}) {
  const { fish, featured, hasLikes } = aggregateDiscovery(items, days, now);
  return (
    <section
      className={appStyles.discovery}
      aria-label="みんなの釣果のトレンド"
    >
      <div className={appStyles.discoveryToolbar}>
        <span>最近の釣果をチェック</span>
        <Tabs
          value={String(days)}
          onValueChange={(v) => onDays(Number(v) as Period)}
        >
          <TabsList aria-label="ランキングの集計期間">
            <TabsTrigger value="7">7日間</TabsTrigger>
            <TabsTrigger value="30">30日間</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <section
        className={appStyles.fishRanking}
        aria-labelledby="fish-ranking-title"
      >
        <div className={appStyles.discoveryTitle}>
          <h2 id="fish-ranking-title">
            最近釣れている魚 <small>TOP3</small>
          </h2>
          <p>釣行日で集計 · 過去{days}日間</p>
        </div>
        {fish.length ? (
          <ol className={appStyles.rankingList}>
            {fish.map((row, index) => (
              <li key={row.species}>
                <button
                  onClick={() => onSpecies(row.species)}
                  aria-label={`${row.species}の釣果を一覧で見る`}
                >
                  <span className={appStyles.rankingNumber}>{index + 1}</span>
                  <span className={appStyles.rankingName}>{row.species}</span>
                  <span className={appStyles.rankingCount}>
                    <strong>{row.records}件</strong>
                    <span> · {row.fish}匹</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className={appStyles.discoveryEmpty}>
            過去{days}日間の釣行記録はありません。
          </p>
        )}
      </section>
      <section aria-labelledby="featured-title">
        <div className={appStyles.discoveryTitle}>
          <h2 id="featured-title">{hasLikes ? '注目の釣果' : '最近の釣果'}</h2>
          <p>
            過去{days}日間の投稿{hasLikes ? ' · いいね順' : ' · 新着順'}
          </p>
        </div>
        {featured.length ? (
          <div className={appStyles.featuredGrid}>
            {featured.map((item) => {
              const photo = item.photos.find(
                  (p) => p.id === item.featured_photo_id,
                ),
                representative =
                  photo?.species || item.fish[0]?.species || '釣果',
                others = Math.max(0, item.fish.length - 1);
              return (
                <article className={appStyles.featuredCard} key={item.id}>
                  {photo ? (
                    <PhotoViewer
                      className={appStyles.featuredPhoto}
                      photos={item.photos}
                      initialPhotoId={photo.id}
                      fish={item.fish}
                      date={item.date}
                      location={item.location}
                    >
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={`${representative}の釣果写真`}
                        loading="lazy"
                      />
                    </PhotoViewer>
                  ) : (
                    <div
                      className={cn(
                        appStyles.featuredPhoto,
                        appStyles.photoFallback,
                      )}
                      role="img"
                      aria-label="写真なし"
                    >
                      <Fish size={48} />
                    </div>
                  )}
                  <div className={appStyles.featuredInfo}>
                    <div className={appStyles.featuredHeading}>
                      <h3>
                        {representative}
                        {others > 0 && <small> ほか{others}種</small>}
                      </h3>
                      <div
                        className={appStyles.cardActions}
                        data-cy="card-actions"
                      >
                        <button
                          className={`${appStyles.likeButton} ${item.liked ? appStyles.isLiked : ''}`}
                          data-cy="like-catch"
                          aria-label={
                            item.liked ? 'いいねを取り消す' : 'いいね'
                          }
                          aria-pressed={item.liked}
                          disabled={busyLikes.has(item.id)}
                          onClick={() => onLike(item)}
                        >
                          <Heart
                            size={19}
                            fill={item.liked ? 'currentColor' : 'none'}
                          />
                          <span>{item.likeCount}</span>
                        </button>
                      </div>
                    </div>
                    <button
                      className={appStyles.authorButton}
                      onClick={() => onProfile(item.owner_id)}
                    >
                      <Avatar name={item.authorName} />
                      <span>{item.authorName}</span>
                    </button>
                    <p className={appStyles.featuredDate}>
                      <CalendarDays size={15} />
                      <time dateTime={item.date}>
                        {item.date.replaceAll('-', '/')}
                      </time>
                    </p>
                    <LocationMapDialog entry={item} apiKey={mapsApiKey} />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={appStyles.discoveryEmpty}>
            過去{days}日間の投稿はありません。
          </p>
        )}
      </section>
    </section>
  );
}
