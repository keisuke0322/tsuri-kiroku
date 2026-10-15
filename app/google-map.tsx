'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicArea } from './location-privacy';
import type { Position } from './fishing-position';

type LatLng = { lat: () => number; lng: () => number };

type Listener = { remove: () => void };

type MapInstance = {
  setCenter: (p: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  fitBounds: (b: unknown) => void;
  addListener: (
    event: string,
    callback: (e: { latLng: LatLng | null }) => void,
  ) => Listener;
};

type MarkerInstance = {
  setMap: (map: MapInstance | null) => void;
  addListener: (
    event: string,
    callback: (e: { latLng: LatLng | null }) => void,
  ) => Listener;
};

type CircleInstance = { setMap: (map: MapInstance | null) => void };

type Maps = {
  Circle: new (options: unknown) => CircleInstance;
  Map: new (el: HTMLElement, options: unknown) => MapInstance;
  Marker: new (options: unknown) => MarkerInstance;
  LatLngBounds: new () => { extend: (p: { lat: number; lng: number }) => void };
  Geocoder: new () => {
    geocode: (
      input: { address: string; region: string },
      callback: (
        results: { geometry: { location: LatLng } }[] | null,
        status: string,
      ) => void,
    ) => void;
  };
};

type MapsWindow = Window & {
  google?: { maps: Maps };
  fishingMapsReady?: () => void;
  gm_authFailure?: () => void;
};

let loader: Promise<Maps> | null = null;

function loadMaps(apiKey: string) {
  if (loader) return loader;
  loader = new Promise<Maps>((resolve, reject) => {
    const w = window as MapsWindow;
    if (w.google?.maps) {
      resolve(w.google.maps);
      return;
    }
    const script = document.createElement('script');
    let timeout: ReturnType<typeof setTimeout>;
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      loader = null;
      reject(
        Error('地図を読み込めません。キーの設定または通信を確認してください。'),
      );
    };
    w.fishingMapsReady = () => {
      clearTimeout(timeout);
      if (w.google?.maps) resolve(w.google.maps);
      else fail();
    };
    w.gm_authFailure = fail;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=fishingMapsReady&loading=async&language=ja&region=JP`;
    script.async = true;
    script.onerror = fail;
    timeout = setTimeout(fail, 20000);
    document.head.appendChild(script);
  });
  return loader;
}

export type MapPoint = {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
};

export default function GoogleMap({
  apiKey,
  position,
  points = [],
  area,
  editable = false,
  onChange,
  onSelect,
}: {
  apiKey: string;
  position?: Position | null;
  points?: MapPoint[];
  area?: PublicArea | null;
  editable?: boolean;
  onChange?: (p: Position) => void;
  onSelect?: (id: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<MapInstance | null>(null),
    callbacks = useRef({ onChange, onSelect }),
    [maps, setMaps] = useState<Maps | null>(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [searching, setSearching] = useState(false);
  callbacks.current = { onChange, onSelect };
  useEffect(() => {
    if (!apiKey) return;
    let active = true;
    void loadMaps(apiKey)
      .then((value) => {
        if (active) setMaps(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [apiKey]);
  useEffect(() => {
    if (!maps || !element.current) return;
    const instance = new maps.Map(element.current, {
      center: { lat: 35.5, lng: 139.5 },
      zoom: 8,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      gestureHandling: 'cooperative',
    });
    map.current = instance;
    const click = instance.addListener('click', (e) => {
      if (editable && e.latLng)
        callbacks.current.onChange?.({
          latitude: e.latLng.lat(),
          longitude: e.latLng.lng(),
          source: 'map',
        });
    });
    return () => {
      click.remove();
      map.current = null;
    };
  }, [maps, editable]);
  const pointKey = JSON.stringify(points),
    positionKey = JSON.stringify(position),
    areaKey = JSON.stringify(area);
  useEffect(() => {
    const instance = map.current;
    if (!maps || !instance) return;
    const markers: MarkerInstance[] = [],
      listeners: Listener[] = [];
    const displayed: MapPoint[] =
      editable && position
        ? [
            {
              id: 0,
              latitude: position.latitude,
              longitude: position.longitude,
              title: '選択した位置',
            },
          ]
        : JSON.parse(pointKey);
    const bounds = new maps.LatLngBounds();
    for (const point of displayed) {
      const location = { lat: point.latitude, lng: point.longitude };
      bounds.extend(location);
      const marker = new maps.Marker({
        map: instance,
        position: location,
        title: point.title,
        draggable: editable,
      });
      markers.push(marker);
      listeners.push(
        marker.addListener('click', () =>
          callbacks.current.onSelect?.(point.id),
        ),
      );
      if (editable)
        listeners.push(
          marker.addListener('dragend', (e) => {
            if (e.latLng)
              callbacks.current.onChange?.({
                latitude: e.latLng.lat(),
                longitude: e.latLng.lng(),
                source: 'map',
                spotId: position?.spotId,
              });
          }),
        );
    }
    const circleArea: PublicArea | null = areaKey ? JSON.parse(areaKey) : null;
    const circle = circleArea
      ? new maps.Circle({
          map: instance,
          center: { lat: circleArea.latitude, lng: circleArea.longitude },
          radius: circleArea.radius,
          strokeColor: '#087e8b',
          strokeWeight: 2,
          fillColor: '#087e8b',
          fillOpacity: 0.15,
          clickable: false,
        })
      : null;
    if (circleArea) {
      instance.setCenter({
        lat: circleArea.latitude,
        lng: circleArea.longitude,
      });
      instance.setZoom(10);
    } else if (displayed.length === 1) {
      instance.setCenter({
        lat: displayed[0].latitude,
        lng: displayed[0].longitude,
      });
      instance.setZoom(editable ? 14 : 12);
    } else if (displayed.length > 1) instance.fitBounds(bounds);
    return () => {
      circle?.setMap(null);
      listeners.forEach((l) => l.remove());
      markers.forEach((m) => m.setMap(null));
    };
  }, [maps, pointKey, positionKey, areaKey, editable]);

  function findPlace() {
    if (!maps || !map.current || !search.trim()) return;
    setSearching(true);
    setError('');
    new maps.Geocoder().geocode(
      { address: search.trim(), region: 'JP' },
      (results, status) => {
        setSearching(false);
        if (status !== 'OK' || !results?.length) {
          setError(
            '場所を検索できませんでした。検索語や通信を確認してください。',
          );
          return;
        }
        const p = results[0].geometry.location;
        map.current?.setCenter({ lat: p.lat(), lng: p.lng() });
        map.current?.setZoom(14);
      },
    );
  }

  if (!apiKey)
    return (
      <p className="map-notice">
        {editable
          ? '地図は準備中です。現在地・緯度経度で位置を保存できます。'
          : '地図は準備中です。時間をおいて再度お試しください。'}
      </p>
    );
  return (
    <div className="google-map-wrap">
      {editable && (
        <div className="map-search">
          <input
            aria-label="地図で場所名を検索"
            placeholder="地名・住所で地図を移動"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                findPlace();
              }
            }}
          />
          <button
            type="button"
            onClick={findPlace}
            disabled={!maps || searching}
          >
            {searching ? '検索中…' : '検索'}
          </button>
        </div>
      )}
      <div
        ref={element}
        className="google-map"
        data-cy="google-map"
        aria-label={
          editable
            ? 'タップして釣り場を指定'
            : area
              ? 'おおよその釣行エリア'
              : '釣行場所の地図'
        }
      />
      {!maps && !error && <p role="status">地図を読み込み中…</p>}
      {error && <p role="alert">{error}</p>}
      {editable && (
        <p className="photo-help">
          地図をタップして位置を選択。ピンをドラッグして調整できます。
        </p>
      )}
    </div>
  );
}
