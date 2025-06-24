/// <reference types="@citizenfx/server" />
/// <reference types="image-js" />

const { oxmysql } = require('@overextended/oxmysql');
const fs = require('fs');
const imagejs = require('image-js');

const resName = GetCurrentResourceName();
const vehicleJSONPath = `resources/${resName}/vehicles.json`;
const mainSavePath = `resources/${resName}/images`;

console.log(`[${resName}] Starting server-side script`);
console.log(`[${resName}] Save path: ${mainSavePath}`);

setTimeout(async () => {
  console.log(`[${resName}] Fetching vehicle models from database...`);

  try {
    const vehicles = await oxmysql.query('SELECT * FROM vehicles');

    if (!vehicles || vehicles.length === 0) {
      console.warn(`[${resName}] Aucun véhicule trouvé dans la base de données.`);
      return;
    }

    console.log(`[${resName}] ${vehicles.length} véhicules récupérés.`);

    fs.writeFileSync(vehicleJSONPath, JSON.stringify(vehicles, null, 2));
    console.log(`[${resName}] Fichier vehicles.json créé avec succès.`);
  } catch (err) {
    console.error(`[${resName}] Erreur MySQL :`, err.message);
  }
}, 1000);

// Screenshot handling and directory setup
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
            const croppedImage = image.crop({ x: image.width / 4.5, width: image.height });

            image.data = croppedImage.data;
            image.width = croppedImage.width;
            image.height = croppedImage.height;

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
