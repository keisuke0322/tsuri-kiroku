'use client';

import { useRef, useState, useEffect } from 'react';
import GoogleMap from './google-map';
import { type Position, type Spot } from './fishing-position';

export default function PositionEditor({
  apiKey,
  position,
  onChange,
  spots = [],
  onName,
  allowUnspecified = false,
}: {
  apiKey: string;
  position: Position | null;
  onChange: (p: Position | null) => void;
  spots?: Spot[];
  onName?: (name: string) => void;
  allowUnspecified?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [mapReady, setMapReady] = useState(false),
    request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  function change(p: Position | null) {
    request.current++;
    setBusy(false);
    setError('');
    onChange(p);
  }

  function locate() {
    if (!navigator.geolocation) {
      setError('この端末では現在地を取得できません。');
      return;
    }
    const version = ++request.current;
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (version !== request.current) return;
        setBusy(false);
        onChange({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          source: 'gps',
        });
      },
      () => {
        if (version !== request.current) return;
        setBusy(false);
        setError(
          '現在地を取得できませんでした。位置情報の許可や端末の設定を確認してください。',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <fieldset className="position-editor">
      <legend>釣り場の位置（任意）</legend>
      {spots.length > 0 && (
        <label>
          過去の釣り場・お気に入り
          <select
            data-cy="past-spot"
            value=""
            onChange={(e) => {
              const spot = spots.find((s) => s.id === Number(e.target.value));
              if (spot) {
                change({
                  latitude: spot.latitude,
                  longitude: spot.longitude,
                  source: 'saved',
                  spotId: spot.id,
                });
                onName?.(spot.name);
              }
            }}
          >
            <option value="">釣り場を選択</option>
            {[...spots]
              .sort((a, b) => Number(b.favorite) - Number(a.favorite))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.favorite ? '★ ' : ''}
                  {s.name}
                </option>
              ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="map-action"
        data-cy="get-location"
        disabled={busy}
        onClick={locate}
      >
        {busy ? '現在地を取得中…' : '現在地を取得'}
      </button>
      <GoogleMap
        apiKey={apiKey}
        position={position}
        editable
        onAvailabilityChange={setMapReady}
        onChange={(p) => change({ ...p, spotId: position?.spotId })}
      />
      {error && (
        <div role="alert">
          <p>{error}</p>
          {mapReady && <p>地図をタップして位置を指定できます。</p>}
          {spots.length > 0 && (
            <p>過去の釣り場・お気に入りから選択できます。</p>
          )}
        </div>
      )}
      {allowUnspecified && (
        <p className="photo-help">場所名だけでも保存できます。</p>
      )}
      <p role="status" data-cy="position-status">
        {position ? '位置指定済み' : '位置未指定'}
      </p>
      {position && (
        <p data-cy="selected-position">
          選択位置：{position.latitude.toFixed(6)},{' '}
          {position.longitude.toFixed(6)}
          <button
            type="button"
            data-cy="clear-position"
            onClick={() => change(null)}
          >
            位置を解除
          </button>
        </p>
      )}
      <p className="photo-help">
        保存する釣行の全魚種でこの位置を共有します。新しい場所は「過去の釣り場」に保存されます。
      </p>
    </fieldset>
  );
}
