import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";
import { TIFFLoader } from "three/examples/jsm/Addons.js";
import { renderImageDataToCanvas } from "src/abstractions/imageCanvas";

export const VIEW_TYPE_TIFF = "extended-file-support-tiff";

export class TIFFComponent extends ExtensionComponent {
	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		const resource = this.plugin.app.vault.getResourcePath(this.file);
		const res = await fetch(resource);
		const arrayBuffer = await res.arrayBuffer();

		const loader = new TIFFLoader();
		const parsed = loader.parse(new Uint8Array(arrayBuffer));

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

export class TIFFView extends ExtensionView<TIFFComponent> {
	getIcon(): string {
		return "image";
	}

	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => TIFFComponent {
		return TIFFComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_TIFF;
	}
}
