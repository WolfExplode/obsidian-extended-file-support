import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";
import { TGALoader } from "three/examples/jsm/Addons.js";
import { renderImageDataToCanvas } from "src/abstractions/imageCanvas";

export const VIEW_TYPE_TGA = "extended-file-support-tga";

// @types/three incorrectly types TGALoader.parse() as returning a DataTexture;
// at runtime it returns this plain data object (see three's TGALoader.js source).
interface TGAParseResult {
	data: Uint8Array;
	width: number;
	height: number;
}

export class TGAComponent extends ExtensionComponent {
	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		const resource = this.plugin.app.vault.getResourcePath(this.file);
		const res = await fetch(resource);
		const arrayBuffer = await res.arrayBuffer();

		const loader = new TGALoader();
		const parsed = loader.parse(arrayBuffer) as unknown as TGAParseResult;

		const rgba = new Uint8ClampedArray(parsed.data.length);
		rgba.set(parsed.data);

		const imageData = new ImageData(rgba, parsed.width, parsed.height);
		const canvasEl = renderImageDataToCanvas(imageData, this.width, this.height);

		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.addClasses(["media-embed", "image-embed"]);
		this.contentEl.append(canvasEl);
	}

	cleanup(): void { }
}

export class TGAView extends ExtensionView<TGAComponent> {
	getIcon(): string {
		return "image";
	}

	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => TGAComponent {
		return TGAComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_TGA;
	}
}
