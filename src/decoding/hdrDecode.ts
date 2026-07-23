import { RGBELoader } from "three/examples/jsm/Addons.js";
import { FloatType } from "three";
import { tonemapLinearFloatToRGBA } from "src/abstractions/hdrTonemap";
import { DecodedImage } from "src/decoding/decodedImage";

export function decodeHDR(buffer: ArrayBuffer): DecodedImage {
	const loader = new RGBELoader();
	loader.setDataType(FloatType);
	const parsed = loader.parse(buffer);

	// RGBELoader's parsed data is already top-down (three sets texture.flipY = true
	// to flip it before GL upload), so no flip is needed for canvas display.
	const rgba = tonemapLinearFloatToRGBA(parsed.data as Float32Array, parsed.width, parsed.height, false);

	return { width: parsed.width, height: parsed.height, rgba };
}
