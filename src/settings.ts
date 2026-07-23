export interface ExtendedFileSupportSettings {
	kra: boolean;
	clip: boolean;
	psd: boolean;
	ai: boolean;
	ai_render_scale: number;
	tga: boolean;
	tif: boolean;
	tiff: boolean;
	exr: boolean;
	dds: boolean;
	hdr: boolean;

	// 3D objects
	animate_3d_objects: boolean;
	obj: boolean;
	gltf: boolean;
	glb: boolean;
	stl: boolean;
	fbx: boolean;
}

export const DEFAULT_SETTINGS: ExtendedFileSupportSettings = {
	kra: true,
	clip: true,
	psd: true,
	ai: true,
	ai_render_scale: 1.5,
	tga: true,
	tif: true,
	tiff: true,
	exr: true,
	dds: true,
	hdr: true,

	animate_3d_objects: true,
	obj: true,
	gltf: true,
	glb: true,
	stl: true,
	fbx: true,
}
