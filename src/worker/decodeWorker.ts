import { decodeEXR } from "src/decoding/exrDecode";
import { decodeHDR } from "src/decoding/hdrDecode";

export type DecodeFormat = "exr" | "hdr";

export interface DecodeRequest {
	id: number;
	format: DecodeFormat;
	buffer: ArrayBuffer;
}

export interface DecodeResponseSuccess {
	id: number;
	width: number;
	height: number;
	rgba: ArrayBuffer;
}

export interface DecodeResponseError {
	id: number;
	error: string;
}

export type DecodeResponse = DecodeResponseSuccess | DecodeResponseError;

// TS's "dom" lib types `self` as Window, not WorkerGlobalScope; this file only needs the
// small subset below, so we type it locally instead of pulling in the (conflicting) "webworker" lib.
declare const self: {
	onmessage: ((event: MessageEvent<DecodeRequest>) => void) | null;
	postMessage: (message: DecodeResponse, transfer: Transferable[]) => void;
};

self.onmessage = (event: MessageEvent<DecodeRequest>) => {
	const { id, format, buffer } = event.data;

	try {
		const decoded = format === "exr" ? decodeEXR(buffer) : decodeHDR(buffer);
		self.postMessage({ id, width: decoded.width, height: decoded.height, rgba: decoded.rgba.buffer }, [decoded.rgba.buffer]);
	} catch (err) {
		self.postMessage({ id, error: err instanceof Error ? err.message : String(err) }, []);
	}
};
