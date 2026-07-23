import { EXRLoader } from "three/examples/jsm/Addons.js";
import { FloatType } from "three";
import { tonemapLinearFloatToRGBA } from "src/abstractions/hdrTonemap";
import { DecodedImage } from "src/decoding/decodedImage";

export function decodeEXR(buffer: ArrayBuffer): DecodedImage {
	const loader = new EXRLoader();
	loader.setDataType(FloatType);
	const parsed = loader.parse(buffer);

	// EXRLoader's parsed data is bottom-up (three sets texture.flipY = false, i.e.
	// GL-ready as-is), so it needs flipping to display top-down in a canvas.
	const rgba = tonemapLinearFloatToRGBA(parsed.data as Float32Array, parsed.width, parsed.height, true);

	return { width: parsed.width, height: parsed.height, rgba };
}
