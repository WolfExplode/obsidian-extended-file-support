import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";

export const VIEW_TYPE_KRA = "extended-file-support-kra";

export class KRAComponent extends ExtensionComponent {
	private objectURL?: string;

	parseLinkText(_: AltTextParsed): void {	}

	async loadFile(): Promise<void> {
		const MERGED_PATH = "mergedimage.png";

		const KRA_resource = this.plugin.app.vault.getResourcePath(this.file);
		const response = await fetch(KRA_resource);
		const KRA_blob = await response.blob();

		// Get the image from the zip
		const reader = new ZipReader(new BlobReader(KRA_blob));
		const entries = await reader.getEntries();
		const target_entry = entries.find(entry => entry.filename === MERGED_PATH);

		if (target_entry && target_entry.directory === false) {
			const image_file = await target_entry.getData(new BlobWriter());
			this.objectURL = URL.createObjectURL(image_file);
		}

		if (this.objectURL) {
			const image = new Image();
			image.alt = this.file.name;

			if (this.width) {
				image.width = this.width;
			}
			if (this.height) {
				image.height = this.height;
			}

			// Wait on the classic load/error events rather than image.decode(): decode()'s
			// promise is tied to compositor/paint scheduling and can stall for a very long
			// time when the window isn't actively painting, while load/error fire immediately.
			const loaded = new Promise<void>((resolve) => {
				image.addEventListener("load", () => resolve(), { once: true });
				image.addEventListener("error", () => {
					console.error(`Failed to load image for ${this.file.path}.`);
					resolve();
				}, { once: true });
			});
			image.src = this.objectURL;

			this.contentEl.empty();
			this.contentEl.removeClass("extended-file-loading");
			this.contentEl.addClasses(["media-embed", "image-embed"]);
			this.contentEl.append(image);

			await loaded;
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

export class KRAView extends ExtensionView<KRAComponent> {
	getIcon(): string {
		return "image";
	}
	
	getComponent(): new (...args: ConstructorParameters<typeof ExtensionComponent>) => KRAComponent {
		return KRAComponent;
	}

	getViewType(): string {
		return VIEW_TYPE_KRA;
	}
}
