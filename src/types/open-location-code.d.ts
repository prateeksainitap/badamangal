/**
 * Hand-written type declarations for `open-location-code`.
 * The npm package ships JS only, no `@types/...` exists. Surface area
 * here is intentionally minimal — only what /api/admin/resolve-coords
 * actually uses.
 */
declare module "open-location-code" {
  export interface CodeArea {
    /** Latitude of the SW corner. */
    latitudeLo: number;
    /** Longitude of the SW corner. */
    longitudeLo: number;
    /** Latitude of the NE corner. */
    latitudeHi: number;
    /** Longitude of the NE corner. */
    longitudeHi: number;
    /** Latitude of the cell's center. */
    latitudeCenter: number;
    /** Longitude of the cell's center. */
    longitudeCenter: number;
    /** Code length, post-`+`-stripped. */
    codeLength: number;
  }

  export class OpenLocationCode {
    constructor();
    /** Decode a full Plus Code to a CodeArea. */
    decode(code: string): CodeArea;
    /** Expand a short Plus Code (e.g. "VXR6+QP") to the nearest full
     *  code relative to the given lat/lng reference. */
    recoverNearest(
      shortCode: string,
      referenceLatitude: number,
      referenceLongitude: number,
    ): string;
    /** True if the input string is a valid Plus Code. */
    isValid(code: string): boolean;
    /** True if the input is a valid full (10+ char) code. */
    isFull(code: string): boolean;
    /** True if the input is a valid short code. */
    isShort(code: string): boolean;
  }
}
