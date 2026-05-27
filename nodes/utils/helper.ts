import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { imageSize } from 'image-size';

/**
 * Tải file bất kỳ (ảnh, pdf, zip...) và lưu vào thư mục tạm trong n8n.
 * Không cần sharp hay bất kỳ native module nào.
 */
export async function saveFile(url: string): Promise<string | null> {
	try {
		const n8nUserFolder = process.env.N8N_USER_FOLDER || path.join(os.homedir(), '.n8n');
		const dataStoragePath = path.join(n8nUserFolder, 'temp_files');

		if (!fs.existsSync(dataStoragePath)) {
			fs.mkdirSync(dataStoragePath, { recursive: true });
		}

		// Lấy phần mở rộng từ URL
		const urlPath = new URL(url).pathname;
		const rawExt = path.extname(urlPath).toLowerCase() || '';

		const { data, headers } = await axios.get(url, { responseType: 'arraybuffer' });

		// Fallback extension từ Content-Type nếu URL không có extension
		const contentType = (headers['content-type'] || '').toLowerCase();
		let ext = rawExt;
		if (!ext) {
			if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
			else if (contentType.includes('png')) ext = '.png';
			else if (contentType.includes('webp')) ext = '.webp';
			else if (contentType.includes('gif')) ext = '.gif';
			else if (contentType.includes('mp4')) ext = '.mp4';
			else ext = '.bin';
		}

		const timestamp = Date.now();
		const filePath = path.join(dataStoragePath, `temp-${timestamp}${ext}`);
		fs.writeFileSync(filePath, Buffer.from(data));
		return filePath;
	} catch (error) {
		console.error('Lỗi khi tải/lưu file:', error);
		return null;
	}
}

/**
 * Xoá file đã lưu
 */
export function removeFile(filePath: string): void {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
	} catch (error) {
		console.error('Lỗi khi xoá file:', error);
	}
}

/**
 * Lấy metadata ảnh dùng image-size (pure JS, không cần native module).
 * Được zca-js gọi khi upload ảnh để lấy width/height/size.
 */
export async function imageMetadataGetter(filePath: string) {
	try {
		const data = await fs.promises.readFile(filePath);
		const dimensions = imageSize(data);
		return {
			width: dimensions.width ?? 0,
			height: dimensions.height ?? 0,
			size: data.length,
		};
	} catch (error) {
		console.error('Error getting image metadata:', error);
		try {
			const stats = await fs.promises.stat(filePath);
			return { width: 0, height: 0, size: stats.size };
		} catch {
			return { width: 0, height: 0, size: 0 };
		}
	}
}
