// Which files the site accepts. Shared by the upload page (browser) and the server.
export const PHOTO_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif', 'tif', 'tiff', 'bmp'];
export const VIDEO_EXT = ['mp4', 'mov', 'm4v', 'mkv', 'avi', 'mpg', 'mpeg', 'vob', 'mts', 'm2ts', 'ts', '3gp', 'webm', 'wmv', 'flv'];

export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

export function kindOf(name: string) {
	const ext = extOf(name);
	if (PHOTO_EXT.includes(ext)) return 'photo' as const;
	if (VIDEO_EXT.includes(ext)) return 'video' as const;
	return null;
}

/** For <input type="file" accept=…> */
export const ACCEPT = ['image/*', 'video/*', ...[...PHOTO_EXT, ...VIDEO_EXT].map((e) => `.${e}`)].join(',');
