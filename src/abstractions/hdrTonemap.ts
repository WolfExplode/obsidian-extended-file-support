const SRGB_LUT_SIZE = 4096;
const SRGB_LUT = buildSRGBLut();

function buildSRGBLut(): Uint8ClampedArray {
	const lut = new Uint8ClampedArray(SRGB_LUT_SIZE);

	for (let i = 0; i < SRGB_LUT_SIZE; i++) {
		const linear = i / (SRGB_LUT_SIZE - 1);
		const srgb = linear <= 0.0031308 ? linear * 12.92 : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
		lut[i] = srgb * 255;
	}

	return lut;
}

function linearToSRGB8(value: number): number {
	const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
	return SRGB_LUT[(clamped * (SRGB_LUT_SIZE - 1)) | 0];
}

// Converts a linear-light float RGB(A) buffer (row-major, top row first) to an 8-bit sRGB ImageData buffer.
export function tonemapLinearFloatToRGBA(data: Float32Array, width: number, height: number, flipY: boolean): Uint8ClampedArray<ArrayBuffer> {
	const channels = data.length / (width * height);
	const rgba = new Uint8ClampedArray(width * height * 4);

	for (let row = 0; row < height; row++) {
		const outRow = flipY ? height - 1 - row : row;
		let srcIndex = row * width * channels;
		let outIndex = outRow * width * 4;

		for (let col = 0; col < width; col++) {
			let r, g, b, a;

			if (channels === 4) {
				r = data[srcIndex];
				g = data[srcIndex + 1];
				b = data[srcIndex + 2];
				a = data[srcIndex + 3];
			} else {
				r = g = b = data[srcIndex];
				a = 1;
			}

			rgba[outIndex] = linearToSRGB8(r);
			rgba[outIndex + 1] = linearToSRGB8(g);
			rgba[outIndex + 2] = linearToSRGB8(b);
			rgba[outIndex + 3] = a * 255;

			srcIndex += channels;
			outIndex += 4;
		}
	}

	return rgba;
}
