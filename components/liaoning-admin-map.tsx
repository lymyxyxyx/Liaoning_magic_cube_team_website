"use client";

import { useEffect, useMemo, useState } from "react";
import { liaoningCityMapPaths } from "@/lib/liaoning-map";

type Position = [number, number];

type CityFeature = {
  properties: { name: string };
  geometry: { coordinates: Position[][][] };
};

type CityMapData = { features: CityFeature[] };

const width = 520;
const height = 360;
const padding = 10;

function createPath(features: CityFeature[]) {
  const points = features.flatMap((feature) => feature.geometry.coordinates.flat(2));
  const longitudes = points.map(([longitude]) => longitude);
  const latitudes = points.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const scale = Math.min(
    (width - padding * 2) / (maxLongitude - minLongitude),
    (height - padding * 2) / (maxLatitude - minLatitude)
  );
  const offsetX = (width - (maxLongitude - minLongitude) * scale) / 2;
  const offsetY = (height - (maxLatitude - minLatitude) * scale) / 2;

  const project = ([longitude, latitude]: Position) => [
    offsetX + (longitude - minLongitude) * scale,
    height - offsetY - (latitude - minLatitude) * scale
  ];

  return features.map((feature) => ({
    name: feature.properties.name.replace(/市$/, ""),
    d: feature.geometry.coordinates
      .map((polygon) =>
        polygon
          .map((ring) => {
            const [first, ...rest] = ring.map(project);
            return `M${first[0].toFixed(2)} ${first[1].toFixed(2)}${rest.map(([x, y]) => ` L${x.toFixed(2)} ${y.toFixed(2)}`).join("")} Z`;
          })
          .join(" ")
      )
      .join(" ")
  }));
}

export function LiaoningAdminMap() {
  const [data, setData] = useState<CityMapData | null>(null);
  const cities = useMemo(() => (data ? createPath(data.features) : liaoningCityMapPaths), [data]);

  useEffect(() => {
    fetch("/maps/liaoning-cities.geo.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((nextData: CityMapData | null) => setData(nextData))
      .catch(() => setData(null));
  }, []);

  return (
    <svg className="liaoning-map liaoning-admin-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="辽宁省 14 个地级市行政边界图">
      <g className="liaoning-map-cities">
        {cities.map((city) => (
          <path className="liaoning-map-city" d={city.d} key={city.name} />
        ))}
      </g>
    </svg>
  );
}
