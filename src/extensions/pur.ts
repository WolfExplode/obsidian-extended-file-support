import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";

export const VIEW_TYPE_PUR = "extended-file-support-pur";

// PureRef files (reverse engineered, see https://github.com/FyorDev/PureRef-format) start with
// a small metadata header (signature, version, build hash) followed by the embedded images.
// The first embedded image is the composite preview (used by the OS for thumbnails). Its length
// and the exact header layout differ across PureRef versions, and PureRef's "Image compression"
// preference means the preview can be stored as either PNG or JPEG, so both are searched for.
const MIN_HEADER_LENGTH = 4;
const PNG_HEADER = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
const PNG_IEND = [0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82];
const JPEG_SOI = [0xFF, 0xD8, 0xFF];
const JPEG_EOI = [0xFF, 0xD9];
const IMAGE_MAX_FALLBACK_SIZE = 50 * 1024 * 1024;

type ImageFormat = {
	mimeType: string,
	header: number[],
	findEnd: (bytes: Uint8Array, start: number) => number,
}

function findSequence(bytes: Uint8Array, sequence: number[], from: number): number {
	search: for (let i = from; i <= bytes.length - sequence.length; i++) {
		for (let j = 0; j < sequence.length; j++) {
			if (bytes[i + j] !== sequence[j]) {
				continue search;
			}
		}
		return i;
	}
	return -1;
}

const IMAGE_FORMATS: ImageFormat[] = [
	{
		mimeType: "image/png",
		header: PNG_HEADER,
		findEnd: (bytes, start) => {
			const iend = findSequence(bytes, PNG_IEND, start + PNG_HEADER.length);
			return iend !== -1 ? iend + PNG_IEND.length : -1;
		},
	},
	{
		mimeType: "image/jpeg",
		header: JPEG_SOI,
		findEnd: (bytes, start) => {
			const eoi = findSequence(bytes, JPEG_EOI, start + JPEG_SOI.length);
			return eoi !== -1 ? eoi + JPEG_EOI.length : -1;
		},
	},
]

type ExtractedImage = {
	data: Uint8Array,
	mimeType: string,
}

// Extracts the first (composite preview) image embedded in a .pur file.
function extractPureRefPreview(buffer: ArrayBuffer): ExtractedImage | null {
	if (buffer.byteLength < MIN_HEADER_LENGTH) {
		console.warn("PureRef file too small to be valid.");
		return null;
	}

	const bytes = new Uint8Array(buffer);

	// Find whichever supported image format's header occurs earliest in the file.
	let format: ImageFormat | null = null;
	let start = -1;
	for (const candidate of IMAGE_FORMATS) {
		const candidate_start = findSequence(bytes, candidate.header, 0);
		if (candidate_start !== -1 && (start === -1 || candidate_start < start)) {
			start = candidate_start;
			format = candidate;
		}
	}

	if (!format || start === -1) {
		console.warn("No preview image found in PureRef file.");
		return null;
	}

	let end = format.findEnd(bytes, start);
	if (end === -1) {
		// No end marker found, fall back to the start of the next image header (if any) as the boundary
		const next_start = findSequence(bytes, format.header, start + format.header.length);
		end = next_start !== -1 ? next_start : Math.min(start + IMAGE_MAX_FALLBACK_SIZE, bytes.length);
	}

	return { data: bytes.slice(start, end), mimeType: format.mimeType };
}

export class PURComponent extends ExtensionComponent {
	private objectURL?: string;

	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		const PUR_resource = this.plugin.app.vault.getResourcePath(this.file);
		const response = await fetch(PUR_resource);
		const PUR_buffer = await response.arrayBuffer();

		const preview = extractPureRefPreview(PUR_buffer);
		if (preview) {
			const image_blob = new Blob([new Uint8Array(preview.data)], { type: preview.mimeType });
			this.objectURL = URL.createObjectURL(image_blob);
		}

		if (this.objectURL) {
			const image = new Image();
			image.src = this.objectURL;
			image.alt = this.file.name;

			if (this.width) {
				image.width = this.width;
			}
			if (this.height) {
				image.height = this.height;
			}

			this.contentEl.empty();
			this.contentEl.removeClass("extended-file-loading");
			this.contentEl.addClasses(["media-embed", "image-embed"]);
			this.contentEl.append(image);
		} else {
			this.contentEl.empty();
			this.contentEl.createEl("i", { text: `Could not load ${this.file.path}` });
		}
	}

	cleanup(): void {
		if (this.objectURL) {
			URL.revokeObjectURL(this.objectURL);
			this.objectURL = undefined;
		}
	}
}

export class PURView extends ExtensionView<PURComponent> {
	getIcon(): string {
		return "image";
	}

	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => PURComponent {
		return PURComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_PUR;
	}
}
