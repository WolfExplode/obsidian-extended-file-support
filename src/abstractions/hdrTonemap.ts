function linearToSRGB(value: number): number {
	const clamped = Math.max(0, Math.min(1, value));
	return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

// Converts a linear-light float RGB(A) buffer (row-major, top row first) to an 8-bit sRGB ImageData buffer.
export function tonemapLinearFloatToRGBA(data: Float32Array, width: number, height: number, flipY: boolean): Uint8ClampedArray<ArrayBuffer> {
	const pixelCount = width * height;
	const channels = data.length / pixelCount;
	const rgba = new Uint8ClampedArray(pixelCount * 4);

	for (let i = 0; i < pixelCount; i++) {
		let r, g, b, a;

		if (channels === 4) {
			r = data[i * 4];
			g = data[i * 4 + 1];
			b = data[i * 4 + 2];
			a = data[i * 4 + 3];
		} else {
			r = g = b = data[i];
			a = 1;
		}

		const row = Math.floor(i / width);
		const col = i % width;
		const outRow = flipY ? height - 1 - row : row;
		const outIndex = (outRow * width + col) * 4;

		rgba[outIndex] = linearToSRGB(r) * 255;
		rgba[outIndex + 1] = linearToSRGB(g) * 255;
		rgba[outIndex + 2] = linearToSRGB(b) * 255;
		rgba[outIndex + 3] = a * 255;
	}

	return rgba;
}
