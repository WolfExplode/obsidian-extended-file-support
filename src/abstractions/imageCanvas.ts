export function renderImageDataToCanvas(imageData: ImageData, targetWidth?: number, targetHeight?: number): HTMLCanvasElement {
	const canvasEl = document.createElement("canvas");
	const context = canvasEl.getContext("2d");

	canvasEl.width = targetWidth ?? imageData.width;
	canvasEl.height = targetHeight ?? (targetWidth ? (imageData.height / imageData.width * targetWidth) : imageData.height);

	if (targetWidth) {
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = imageData.width;
		tempCanvas.height = imageData.height;
		const tempContext = tempCanvas.getContext("2d");

		if (tempContext) {
			tempContext.putImageData(imageData, 0, 0);

			context?.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvasEl.width, canvasEl.height);
		}
	} else {
		canvasEl.addClass("full-width");
		context?.putImageData(imageData, 0, 0);
	}

	return canvasEl;
}
