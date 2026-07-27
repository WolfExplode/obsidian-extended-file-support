import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";

export const VIEW_TYPE_JFIF = "extended-file-support-jfif";

export class JFIFComponent extends ExtensionComponent {
	private objectUrl?: string;

	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		this.cleanup();

		// A JFIF file contains JPEG image data. Supplying the MIME type explicitly
		// avoids depending on the platform's handling of the .jfif extension.
		const data = await this.plugin.app.vault.readBinary(this.file);
		this.objectUrl = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));

		const imageEl = document.createElement("img");
		imageEl.alt = this.file.basename;

		if (this.width) imageEl.width = this.width;
		if (this.height) imageEl.height = this.height;
		if (!this.width && !this.height) imageEl.addClass("full-width");

		// Wait on the classic load/error events rather than image.decode(): decode()'s
		// promise is tied to compositor/paint scheduling and can stall for a very long
		// time when the window isn't actively painting, while load/error fire immediately.
		const loaded = new Promise<void>((resolve) => {
			imageEl.addEventListener("load", () => resolve(), { once: true });
			imageEl.addEventListener("error", () => {
				console.error(`Failed to load image for ${this.file.path}.`);
				resolve();
			}, { once: true });
		});
		imageEl.src = this.objectUrl;

		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.addClasses(["media-embed", "image-embed"]);
		this.contentEl.append(imageEl);

		await loaded;
	}

	cleanup(): void {
		if (this.objectUrl) {
			URL.revokeObjectURL(this.objectUrl);
			this.objectUrl = undefined;
		}
	}
}

export class JFIFView extends ExtensionView<JFIFComponent> {
	getIcon(): string {
		return "image";
	}

	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => JFIFComponent {
		return JFIFComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_JFIF;
	}
}
