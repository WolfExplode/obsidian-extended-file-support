import { Plugin } from "obsidian";
import { DecodedImage } from "src/decoding/decodedImage";
import { DecodeFormat, DecodeRequest, DecodeResponse } from "src/worker/decodeWorker";

// Thrown when the worker infrastructure itself (reading worker.js, constructing a Worker) fails,
// as opposed to a legitimate decode error for a specific file. Callers can use this to decide
// whether falling back to a main-thread decode makes sense.
export class WorkerInfraError extends Error { }

interface PendingRequest {
	resolve: (result: DecodedImage) => void;
	reject: (error: Error) => void;
}

// Caps the pool size so we don't spin up a worker per core on huge machines for what's
// still a fairly bursty, embed-driven workload.
const MAX_POOL_SIZE = 4;

interface PoolWorker {
	worker: Worker;
	inFlight: number;
}

export class ImageDecodeService {
	private pool: PoolWorker[] = [];
	private workerUrl?: string;
	private nextId = 0;
	private readonly pending = new Map<number, PendingRequest>();
	private initPromise?: Promise<PoolWorker[]>;

	constructor(private readonly plugin: Plugin) { }

	async decode(format: DecodeFormat, buffer: ArrayBuffer): Promise<DecodedImage> {
		const pool = await this.getPool();
		const poolWorker = pool.reduce((least, current) => current.inFlight < least.inFlight ? current : least);
		const id = this.nextId++;

		poolWorker.inFlight++;

		return new Promise<DecodedImage>((resolve, reject) => {
			this.pending.set(id, {
				resolve: (result) => { poolWorker.inFlight--; resolve(result); },
				reject: (err) => { poolWorker.inFlight--; reject(err); },
			});

			// Structured-clone (not transfer) the input buffer: on infra failure the caller may
			// still want to fall back to a main-thread decode using the same buffer.
			const request: DecodeRequest = { id, format, buffer };
			poolWorker.worker.postMessage(request);
		});
	}

	private async getPool(): Promise<PoolWorker[]> {
		if (this.pool.length > 0) return this.pool;

		if (!this.initPromise) {
			this.initPromise = this.createPool().catch((err) => {
				this.initPromise = undefined;
				throw new WorkerInfraError(err instanceof Error ? err.message : String(err));
			});
		}

		return this.initPromise;
	}

	private async createPool(): Promise<PoolWorker[]> {
		const dir = this.plugin.manifest.dir;
		if (!dir) throw new Error("Plugin directory unavailable");

		const source = await this.plugin.app.vault.adapter.read(`${dir}/worker.js`);
		const blob = new Blob([source], { type: "application/javascript" });
		this.workerUrl = URL.createObjectURL(blob);

		const size = Math.max(1, Math.min(MAX_POOL_SIZE, navigator.hardwareConcurrency || 1));
		this.pool = Array.from({ length: size }, () => this.createWorker(this.workerUrl!));
		return this.pool;
	}

	private createWorker(url: string): PoolWorker {
		const worker = new Worker(url);
		const poolWorker: PoolWorker = { worker, inFlight: 0 };

		worker.onmessage = (event: MessageEvent<DecodeResponse>) => {
			const response = event.data;
			const pending = this.pending.get(response.id);
			if (!pending) return;
			this.pending.delete(response.id);

			if ("error" in response) {
				pending.reject(new Error(response.error));
			} else {
				pending.resolve({ width: response.width, height: response.height, rgba: new Uint8ClampedArray(response.rgba) });
			}
		};

		worker.onerror = (event: ErrorEvent) => {
			for (const request of this.pending.values()) {
				request.reject(new WorkerInfraError(event.message));
			}
			this.pending.clear();
		};

		return poolWorker;
	}

	destroy(): void {
		for (const poolWorker of this.pool) {
			poolWorker.worker.terminate();
		}
		this.pool = [];
		this.initPromise = undefined;

		if (this.workerUrl) {
			URL.revokeObjectURL(this.workerUrl);
			this.workerUrl = undefined;
		}

		for (const request of this.pending.values()) {
			request.reject(new Error("Image decode service destroyed"));
		}
		this.pending.clear();
	}
}
