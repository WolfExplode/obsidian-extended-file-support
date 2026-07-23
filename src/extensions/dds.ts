import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";
import { DDSLoader } from "three/examples/jsm/Addons.js";
import { RGBAFormat, RGBA_S3TC_DXT3_Format, RGBA_S3TC_DXT5_Format, RGB_S3TC_DXT1_Format } from "three";
import { renderImageDataToCanvas } from "src/abstractions/imageCanvas";

export const VIEW_TYPE_DDS = "extended-file-support-dds";

type RGBA = [number, number, number, number];

function rgb565ToRgb(value: number): [number, number, number] {
	const r = ((value >> 11) & 0x1f) * 255 / 31;
	const g = ((value >> 5) & 0x3f) * 255 / 63;
	const b = (value & 0x1f) * 255 / 31;
	return [r, g, b];
}

function buildColorPalette(c0: number, c1: number, isDXT1: boolean): RGBA[] {
	const [r0, g0, b0] = rgb565ToRgb(c0);
	const [r1, g1, b1] = rgb565ToRgb(c1);
	const colors: RGBA[] = [
		[r0, g0, b0, 255],
		[r1, g1, b1, 255],
	];

	// BC2/BC3 (DXT3/DXT5) always use the 4-color interpolation, since alpha is stored separately.
	// BC1 (DXT1) switches to punch-through transparency when c0 <= c1.
	if (!isDXT1 || c0 > c1) {
		colors.push([(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255]);
		colors.push([(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255]);
	} else {
		colors.push([(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255]);
		colors.push([0, 0, 0, 0]);
	}

	return colors;
}

function decodeDXTMip(data: Uint8Array, width: number, height: number, format: number): Uint8ClampedArray<ArrayBuffer> {
	const out = new Uint8ClampedArray(width * height * 4);

	const isDXT1 = format === RGB_S3TC_DXT1_Format;
	const isDXT3 = format === RGBA_S3TC_DXT3_Format;
	const blockSize = isDXT1 ? 8 : 16;

	const blockCountX = Math.ceil(width / 4);
	const blockCountY = Math.ceil(height / 4);

	let offset = 0;

	for (let by = 0; by < blockCountY; by++) {
		for (let bx = 0; bx < blockCountX; bx++) {
			const alphaBlockOffset = offset;
			const colorBlockOffset = offset + (isDXT1 ? 0 : 8);

			const alpha = new Uint8Array(16).fill(255);

			if (isDXT3) {
				for (let i = 0; i < 16; i++) {
					const byte = data[alphaBlockOffset + (i >> 1)];
					const nibble = (i & 1) ? (byte >> 4) : (byte & 0xf);
					alpha[i] = nibble * 17;
				}
			} else if (!isDXT1) {
				// DXT5
				const a0 = data[alphaBlockOffset];
				const a1 = data[alphaBlockOffset + 1];
				const alphaValues = [a0, a1];

				if (a0 > a1) {
					for (let i = 1; i <= 6; i++) alphaValues.push(Math.round(((7 - i) * a0 + i * a1) / 7));
				} else {
					for (let i = 1; i <= 4; i++) alphaValues.push(Math.round(((5 - i) * a0 + i * a1) / 5));
					alphaValues.push(0);
					alphaValues.push(255);
				}

				let bits = data[alphaBlockOffset + 2] | (data[alphaBlockOffset + 3] << 8) | (data[alphaBlockOffset + 4] << 16);
				for (let i = 0; i < 8; i++) {
					alpha[i] = alphaValues[bits & 0x7];
					bits >>= 3;
				}

				let bits2 = data[alphaBlockOffset + 5] | (data[alphaBlockOffset + 6] << 8) | (data[alphaBlockOffset + 7] << 16);
				for (let i = 8; i < 16; i++) {
					alpha[i] = alphaValues[bits2 & 0x7];
					bits2 >>= 3;
				}
			}

			const c0 = data[colorBlockOffset] | (data[colorBlockOffset + 1] << 8);
			const c1 = data[colorBlockOffset + 2] | (data[colorBlockOffset + 3] << 8);
			const colors = buildColorPalette(c0, c1, isDXT1);

			const indexBits = data[colorBlockOffset + 4]
				| (data[colorBlockOffset + 5] << 8)
				| (data[colorBlockOffset + 6] << 16)
				| (data[colorBlockOffset + 7] << 24);

			for (let py = 0; py < 4; py++) {
				for (let px = 0; px < 4; px++) {
					const x = bx * 4 + px;
					const y = by * 4 + py;
					if (x >= width || y >= height) continue;

					const pixelIndex = py * 4 + px;
					const colorIndex = (indexBits >>> (pixelIndex * 2)) & 0x3;
					const color = colors[colorIndex];

					const outOffset = (y * width + x) * 4;
					out[outOffset] = color[0];
					out[outOffset + 1] = color[1];
					out[outOffset + 2] = color[2];
					out[outOffset + 3] = isDXT1 ? color[3] : alpha[pixelIndex];
				}
			}

			offset += blockSize;
		}
	}

	return out;
}

export class DDSComponent extends ExtensionComponent {
	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		const resource = this.plugin.app.vault.getResourcePath(this.file);
		const res = await fetch(resource);
		const arrayBuffer = await res.arrayBuffer();

		const loader = new DDSLoader();
		const parsed = loader.parse(arrayBuffer, false);
		const mip = parsed.mipmaps[0];

		if (!mip || parsed.isCubemap) {
			this.showError();
			return;
		}

		let rgba: Uint8ClampedArray<ArrayBuffer>;

		if (parsed.format === RGBAFormat) {
			// Uncompressed DDS: data is already decoded RGBA bytes.
			// Three.js's uncompressed-RGB path (no source alpha channel) currently writes 1 instead of 255
			// for alpha; treat a fully-degenerate alpha channel as opaque rather than showing a blank image.
			const source = mip.data as Uint8Array;
			let hasVisibleAlpha = false;
			for (let i = 3; i < source.length; i += 4) {
				if (source[i] > 1) {
					hasVisibleAlpha = true;
					break;
				}
			}

			rgba = new Uint8ClampedArray(source);
			if (!hasVisibleAlpha) {
				for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
			}
		} else if (parsed.format === RGB_S3TC_DXT1_Format || parsed.format === RGBA_S3TC_DXT3_Format || parsed.format === RGBA_S3TC_DXT5_Format) {
			rgba = decodeDXTMip(mip.data as Uint8Array, mip.width, mip.height, parsed.format);
		} else {
			this.showError();
			return;
		}

		const imageData = new ImageData(rgba, mip.width, mip.height);
		const canvasEl = renderImageDataToCanvas(imageData, this.width, this.height);

		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.addClasses(["media-embed", "image-embed"]);
		this.contentEl.append(canvasEl);
	}

	private showError(): void {
		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.createEl("i", { text: `Could not load ${this.file.path}, this DDS compression format is not supported.` });
	}

	cleanup(): void { }
}

export class DDSView extends ExtensionView<DDSComponent> {
	getIcon(): string {
		return "image";
	}

	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => DDSComponent {
		return DDSComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_DDS;
	}
}
