import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Tải file bất kỳ (ảnh, pdf, zip...) và lưu vào thư mục tạm trong n8n
 */
export async function saveFile(url: string): Promise<string | null> {
	try {
		const n8nUserFolder = process.env.N8N_USER_FOLDER || path.join(os.homedir(), '.n8n');
		const dataStoragePath = path.join(n8nUserFolder, 'temp_files');

		if (!fs.existsSync(dataStoragePath)) {
			fs.mkdirSync(dataStoragePath, { recursive: true });
		}

		// Lấy phần mở rộng từ URL (nếu có), ví dụ: .png, .pdf
		const urlPath = new URL(url).pathname;
		const ext = path.extname(urlPath) || '.bin';

		const timestamp = Date.now();
		const filePath = path.join(dataStoragePath, `temp-${timestamp}${ext}`);

		const { data } = await axios.get(url, { responseType: 'arraybuffer' });
		fs.writeFileSync(filePath, data); // đúng kiểu nhị phân

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

export async function imageMetadataGetter(filePath: string) {
	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const sharp = require('sharp');
		const data = await fs.promises.readFile(filePath);
		const metadata = await sharp(data).metadata();
		return {
			height: metadata.height,
			width: metadata.width,
			size: metadata.size || data.length,
		};
	} catch (error) {
		console.error('Error getting image metadata:', error);
		// Fallback for non-image files or if sharp is missing.
		// Though zca-js might expect this to work for images.
		// If it fails, maybe return default or rethrow.
		try {
			const stats = await fs.promises.stat(filePath);
			return {
				height: 0,
				width: 0,
				size: stats.size
			}
		} catch (e) {
			return {
				height: 0,
				width: 0,
				size: 0
			}
		}
	}
}
