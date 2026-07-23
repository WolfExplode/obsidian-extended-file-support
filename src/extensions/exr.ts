import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";
import { renderImageDataToCanvas } from "src/abstractions/imageCanvas";
import { decodeEXR } from "src/decoding/exrDecode";
import { WorkerInfraError } from "src/decoding/imageDecodeService";

export const VIEW_TYPE_EXR = "extended-file-support-exr";

export class EXRComponent extends ExtensionComponent {
	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		const resource = this.plugin.app.vault.getResourcePath(this.file);
		const res = await fetch(resource);
		const arrayBuffer = await res.arrayBuffer();

		let decoded;
		try {
			decoded = await this.plugin.imageDecode.decode("exr", arrayBuffer);
		} catch (err) {
			if (!(err instanceof WorkerInfraError)) throw err;
			console.warn("Extended File Support: EXR worker unavailable, decoding on main thread instead.", err);
			decoded = decodeEXR(arrayBuffer);
		}

		const imageData = new ImageData(decoded.rgba, decoded.width, decoded.height);
		const canvasEl = renderImageDataToCanvas(imageData, this.width, this.height);

		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.addClasses(["media-embed", "image-embed"]);
		this.contentEl.append(canvasEl);
	}

	cleanup(): void { }
}

export class EXRView extends ExtensionView<EXRComponent> {
	getIcon(): string {
		return "image";
	}

	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => EXRComponent {
		return EXRComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_EXR;
	}
}
