import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { bboxOf, inBBox, pointInMultiPolygon, type BBox, type MultiPolygon, type Position } from "./geo.ts";

/*
 * Point → Nepal local level and ward (AGENTS §4.4, §15.5), from the committed
 * boundaries (src/data/nepal/boundaries.json). Pure: the caller supplies the
 * decoded topology, so the build script and tests use it without the server.
 *
 * A ward polygon decides both the municipality and the ward. Where OSM has no
 * ward for the point, the local-level polygon gives the municipality alone.
 */

export type BoundaryTopology = Topology<{
  municipalities: GeometryCollection<{ c: string }>;
  wards: GeometryCollection<{ m: string; w: number }>;
}>;

type Area<P> = P & { bbox: BBox; shape: MultiPolygon };

export type AreaIndex = {
  municipalities: Area<{ code: string }>[];
  wards: Area<{ municipalityCode: string; ward: number }>[];
};

export type AreaMatch = { municipalityCode: string; ward: number | null };

function shapeOf(geometry: GeoJSON.Geometry | null): MultiPolygon {
  if (geometry?.type === "Polygon") return [geometry.coordinates as MultiPolygon[number]];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates as MultiPolygon;
  return [];
}

export function buildAreaIndex(topology: BoundaryTopology): AreaIndex {
  const municipalities = feature(topology, topology.objects.municipalities).features.map((item) => {
    const shape = shapeOf(item.geometry);
    return { code: item.properties.c, shape, bbox: bboxOf(shape) };
  });
  const wards = feature(topology, topology.objects.wards).features.map((item) => {
    const shape = shapeOf(item.geometry);
    return { municipalityCode: item.properties.m, ward: item.properties.w, shape, bbox: bboxOf(shape) };
  });
  return { municipalities, wards };
}

/** The local level (and ward, when known) containing [longitude, latitude], or null. */
export function lookupArea(index: AreaIndex, point: Position): AreaMatch | null {
  const ward = index.wards.find((candidate) => inBBox(point, candidate.bbox) && pointInMultiPolygon(point, candidate.shape));
  if (ward) return { municipalityCode: ward.municipalityCode, ward: ward.ward };
  const municipality = index.municipalities.find(
    (candidate) => inBBox(point, candidate.bbox) && pointInMultiPolygon(point, candidate.shape),
  );
  return municipality ? { municipalityCode: municipality.code, ward: null } : null;
}
