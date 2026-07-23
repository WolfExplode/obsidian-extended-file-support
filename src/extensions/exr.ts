import { AltTextParsed, ExtensionComponent } from "src/extensionComponent";
import { ExtensionView } from "src/extensionView";
import { EXRLoader } from "three/examples/jsm/Addons.js";
import { FloatType } from "three";
import { renderImageDataToCanvas } from "src/abstractions/imageCanvas";
import { tonemapLinearFloatToRGBA } from "src/abstractions/hdrTonemap";

export const VIEW_TYPE_EXR = "extended-file-support-exr";

export class EXRComponent extends ExtensionComponent {
	parseLinkText(_: AltTextParsed): void { }

	async loadFile(): Promise<void> {
		const t0 = performance.now();
		const resource = this.plugin.app.vault.getResourcePath(this.file);
		const res = await fetch(resource);
		const arrayBuffer = await res.arrayBuffer();
		const t1 = performance.now();

		const loader = new EXRLoader();
		loader.setDataType(FloatType);
		const parsed = loader.parse(arrayBuffer);
		const t2 = performance.now();

		// EXRLoader's parsed data is bottom-up (three sets texture.flipY = false, i.e.
		// GL-ready as-is), so it needs flipping to display top-down in a canvas.
		const rgba = tonemapLinearFloatToRGBA(parsed.data as Float32Array, parsed.width, parsed.height, true);
		const t3 = performance.now();

		const imageData = new ImageData(rgba, parsed.width, parsed.height);
		const canvasEl = renderImageDataToCanvas(imageData, this.width, this.height);
		const t4 = performance.now();

		this.contentEl.empty();
		this.contentEl.removeClass("extended-file-loading");
		this.contentEl.addClasses(["media-embed", "image-embed"]);
		this.contentEl.append(canvasEl);
		const t5 = performance.now();

		console.log(`[EFS][exr] ${this.file.path} ${parsed.width}x${parsed.height} | fetch=${(t1 - t0).toFixed(1)}ms parse=${(t2 - t1).toFixed(1)}ms tonemap=${(t3 - t2).toFixed(1)}ms canvas=${(t4 - t3).toFixed(1)}ms dom=${(t5 - t4).toFixed(1)}ms TOTAL=${(t5 - t0).toFixed(1)}ms`);
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
