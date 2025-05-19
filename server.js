/// <reference types="@citizenfx/server" />
/// <reference types="image-js" />

const imagejs = require('image-js');
const fs = require('fs');

const resName = GetCurrentResourceName();
const mainSavePath = `resources/${resName}/images`;

console.log(`[${resName}] Starting server-side script`);
console.log(`[${resName}] Save path: ${mainSavePath}`);

try {
	if (!fs.existsSync(mainSavePath)) {
		console.log(`[${resName}] Creating images directory`);
		fs.mkdirSync(mainSavePath, { recursive: true });
	}

	onNet('takeScreenshot', async (filename, type) => {
		try {
			console.log(`[${resName}] Taking screenshot: ${filename} (${type})`);
			
			const savePath = `${mainSavePath}/${type}`;
			if (!fs.existsSync(savePath)) {
				console.log(`[${resName}] Creating type directory: ${type}`);
				fs.mkdirSync(savePath, { recursive: true });
			}

			console.log(`[${resName}] Requesting screenshot from client`);
			exports['screenshot-basic'].requestClientScreenshot(
				source,
				{
					fileName: savePath + '/' + filename + '.png',
					encoding: 'png',
					quality: 1.0,
				},
				async (err, fileName) => {
					if (err) {
						console.error(`[${resName}] Screenshot error:`, err);
						return;
					}
					
					console.log(`[${resName}] Processing screenshot: ${fileName}`);
					try {
						let image = await imagejs.Image.load(fileName);
						const coppedImage = image.crop({ x: image.width / 4.5, width: image.height });

						image.data = coppedImage.data;
						image.width = coppedImage.width;
						image.height = coppedImage.height;

						for (let x = 0; x < image.width; x++) {
							for (let y = 0; y < image.height; y++) {
								const pixelArr = image.getPixelXY(x, y);
								const r = pixelArr[0];
								const g = pixelArr[1];
								const b = pixelArr[2];

								if (g > r + b) {
									image.setPixelXY(x, y, [255, 255, 255, 0]);
								}
							}
						}

						console.log(`[${resName}] Saving processed image: ${fileName}`);
						await image.save(fileName);
						console.log(`[${resName}] Screenshot saved successfully`);
					} catch (imageError) {
						console.error(`[${resName}] Image processing error:`, imageError);
					}
				}
			);
		} catch (screenshotError) {
			console.error(`[${resName}] Screenshot process error:`, screenshotError);
		}
	});
} catch (error) {
	console.error(`[${resName}] Initialization error:`, error.message);
}
