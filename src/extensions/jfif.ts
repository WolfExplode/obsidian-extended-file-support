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
		imageEl.src = this.objectUrl;
		imageEl.alt = this.file.basename;

		if (this.width) imageEl.width = this.width;
		if (this.height) imageEl.height = this.height;
		if (!this.width && !this.height) imageEl.addClass("full-width");

		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.addClasses(["media-embed", "image-embed"]);
		this.contentEl.append(imageEl);
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
