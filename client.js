/// <reference types="@citizenfx/client" />

const config = JSON.parse(LoadResourceFile(GetCurrentResourceName(), 'config.json'));

const vehicles = JSON.parse(LoadResourceFile(GetCurrentResourceName(), 'vehicles.json'));

const Delay = (ms) => new Promise((res) => setTimeout(res, ms));

let cam; 
let camInfo;
let ped;
let interval;
const playerId = PlayerId();
let QBCore = null;

let isTattooMode = false;
let currentTattooIndex = 0;
let currentTattooZone = 0;
let tattooCam = null;
let tattooCamPos = { x: 0, y: 0, z: 0 };
const CAMERA_SPEED = 0.05;

const TATTOO_COLLECTIONS = {
    mpbusiness_overlays: {
        name: "Business",
        tattoos: [
            {nameHash: 'MP_Buis_M_Neck_000', addedX: 0.3, addedY: 0.2, addedZ: 0.5, rotZ: 119.4},
            {nameHash: 'MP_Buis_M_Neck_001', addedX: 0.3, addedY: -0.2, addedZ: 0.7, rotZ: 56.9},
            {nameHash: 'MP_Buis_M_Neck_002', addedX: 0.0, addedY: 0.3, addedZ: 0.6, rotZ: 164.8},
            {nameHash: 'MP_Buis_M_Neck_003', addedX: -0.3, addedY: -0.2, addedZ: 0.6, rotZ: -54.1},
            {nameHash: 'MP_Buis_M_LeftArm_000', addedX: 0.3, addedY: 0.2, addedZ: 0.0, rotZ: 115.5},
            {nameHash: 'MP_Buis_M_LeftArm_001', addedX: -0.7, addedY: 0.1, addedZ: 0.0, rotZ: -68.4},
            {nameHash: 'MP_Buis_M_RightArm_000', addedX: 0.3, addedY: -0.7, addedZ: 0.5, rotZ: 17.7},
            {nameHash: 'MP_Buis_M_RightArm_001', addedX: 0.3, addedY: 0.3, addedZ: 0.0, rotZ: 145.4},
            {nameHash: 'MP_Buis_M_Stomach_000', addedX: 0.7, addedY: 0.4, addedZ: 0.3, rotZ: 117.3},
            {nameHash: 'MP_Buis_M_Chest_000', addedX: 0.7, addedY: 0.4, addedZ: 0.3, rotZ: 117.3},
            {nameHash: 'MP_Buis_M_Chest_001', addedX: 0.7, addedY: 0.4, addedZ: 0.3, rotZ: 117.3},
            {nameHash: 'MP_Buis_M_Back_000', addedX: -0.7, addedY: -0.3, addedZ: 0.3, rotZ: -53.6}
        ]
    },
    mphipster_overlays: {
        name: "Hipster",
        tattoos: [
            {nameHash: 'FM_Hip_M_Tat_000', addedX: -0.7, addedY: -0.4, addedZ: 0.5, rotZ: -55.6},
            {nameHash: 'FM_Hip_M_Tat_001', addedX: -0.4, addedY: -0.7, addedZ: 0.2, rotZ: -49.7},
            {nameHash: 'FM_Hip_M_Tat_002', addedX: 0.4, addedY: 0.5, addedZ: 0.4, rotZ: 129.5},
            {nameHash: 'FM_Hip_M_Tat_003', addedX: -0.8, addedY: 0.1, addedZ: 0.0, rotZ: -71.9},
            {nameHash: 'FM_Hip_M_Tat_004', addedX: 0.4, addedY: 0.2, addedZ: 0.0, rotZ: -182.6},
            {nameHash: 'FM_Hip_M_Tat_005', addedX: -0.1, addedY: 0.3, addedZ: 0.6, rotZ: -182.6},
            {nameHash: 'FM_Hip_M_Tat_006', addedX: 0.5, addedY: -0.3, addedZ: 0.2, rotZ: 38.9},
            {nameHash: 'FM_Hip_M_Tat_007', addedX: -0.1, addedY: 0.8, addedZ: -0.2, rotZ: 156.7},
            {nameHash: 'FM_Hip_M_Tat_008', addedX: 0.4, addedY: -0.5, addedZ: 0.5, rotZ: 51.8},
            {nameHash: 'FM_Hip_M_Tat_009', addedX: -0.7, addedY: -0.4, addedZ: -0.5, rotZ: -23.5},
            {nameHash: 'FM_Hip_M_Tat_010', addedX: 0.5, addedY: -0.4, addedZ: -0.1, rotZ: 37.8}
        ]
    }
};

const TATTOO_ZONES = [
    { name: "Torso", component: 3, collection: "mpbusiness_overlays" },
    { name: "Head", component: 0, collection: "mpbusiness_overlays" },
    { name: "Left Arm", component: 3, collection: "mpbusiness_overlays" },
    { name: "Right Arm", component: 3, collection: "mpbusiness_overlays" },
    { name: "Left Leg", component: 4, collection: "mpbusiness_overlays" },
    { name: "Right Leg", component: 4, collection: "mpbusiness_overlays" }
];

if (config.useQBVehicles) {
	QBCore = exports[config.coreResourceName].GetCoreObject();
}

async function takeScreenshotForComponent(pedType, type, component, drawable, texture, cameraSettings) {
	if (type === 'TATTOO') {
		await Delay(200);
		emitNet('takeScreenshot', `${pedType}_tattoo_${component}_${drawable}`, 'tattoos');
		await Delay(3000); // Augmentation du délai à 3 secondes pour s'assurer que la photo est prise
		return;
	}

	const cameraInfo = cameraSettings ? cameraSettings : config.cameraSettings[type][component];

	// Special case for eyebrows (overlay ID 2)
	const componentNumber = type === 'OVERLAY' && component === 2 ? '22' : component;

	setWeatherTime();

	await Delay(500);

	if (!camInfo || camInfo.zPos !== cameraInfo.zPos || camInfo.fov !== cameraInfo.fov) {
		camInfo = cameraInfo;

		if (cam) {
			DestroyAllCams(true);
			DestroyCam(cam, true);
			cam = null;
		}

		SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
		SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);

		await Delay(50);

		const [playerX, playerY, playerZ] = GetEntityCoords(ped);
		const [fwdX, fwdY, fwdZ] = GetEntityForwardVector(ped);

		const fwdPos = {
			x: playerX + fwdX * 1.2,
			y: playerY + fwdY * 1.2,
			z: playerZ + fwdZ + camInfo.zPos,
		};

		cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', fwdPos.x, fwdPos.y, fwdPos.z, 0, 0, 0, camInfo.fov, true, 0);

		PointCamAtCoord(cam, playerX, playerY, playerZ + camInfo.zPos);
		SetCamActive(cam, true);
		RenderScriptCams(true, false, 0, true, false, 0);
	}

	await Delay(50);

	SetEntityRotation(ped, camInfo.rotation.x, camInfo.rotation.y, camInfo.rotation.z, 2, false);

	emitNet('takeScreenshot', `${pedType}_${type == 'PROPS' ? 'prop_' : ''}${componentNumber}_${drawable}${texture ? `_${texture}`: ''}`, 'clothing');
	await Delay(2000);
	return;
}

async function takeScreenshotForObject(object, hash) {

	setWeatherTime();

	await Delay(500);

	if (cam) {
		DestroyAllCams(true);
		DestroyCam(cam, true);
		cam = null;
	}

	let [[minDimX, minDimY, minDimZ], [maxDimX, maxDimY, maxDimZ]] = GetModelDimensions(hash);
	let modelSize = {
		x: maxDimX - minDimX,
		y: maxDimY - minDimY,
		z: maxDimZ - minDimZ
	}
	let fov = Math.min(Math.max(modelSize.x, modelSize.z) / 0.15 * 10, 60);


	const [objectX, objectY, objectZ] = GetEntityCoords(object, false);
	const [fwdX, fwdY, fwdZ] = GetEntityForwardVector(object);

	const center = {
		x: objectX + (minDimX + maxDimX) / 2,
		y: objectY + (minDimY + maxDimY) / 2,
		z: objectZ + (minDimZ + maxDimZ) / 2,
	}

	const fwdPos = {
		x: center.x + fwdX * 1.2 + Math.max(modelSize.x, modelSize.z) / 2,
		y: center.y + fwdY * 1.2 + Math.max(modelSize.x, modelSize.z) / 2,
		z: center.z + fwdZ,
	};

	console.log(modelSize.x, modelSize.z)

	cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', fwdPos.x, fwdPos.y, fwdPos.z, 0, 0, 0, fov, true, 0);

	PointCamAtCoord(cam, center.x, center.y, center.z);
	SetCamActive(cam, true);
	RenderScriptCams(true, false, 0, true, false, 0);

	await Delay(50);

	emitNet('takeScreenshot', `${hash}`, 'objects');

	await Delay(2000);

	return;

}

async function takeScreenshotForVehicle(vehicle, hash, model) {
	setWeatherTime();

	await Delay(500);

	if (cam) {
		DestroyAllCams(true);
		DestroyCam(cam, true);
		cam = null;
	}

	// Position fixe absolue de la caméra
	const camPos = {
		x: -1265.58, // Position fixe absolue X (légèrement décalée de la position du véhicule)
		y: -3378.08, // Position fixe absolue Y (légèrement décalée de la position du véhicule)
		z: 16.13     // Position fixe absolue Z (hauteur augmentée pour regarder vers le bas)
	};

	// FOV fixe pour tous les véhicules
	const fov = 65.0;

	cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', camPos.x, camPos.y, camPos.z, 0, 0, 0, fov, true, 0);

	// Point la caméra vers la position fixe du véhicule, un peu plus bas
	PointCamAtCoord(cam, config.greenScreenVehiclePosition.x, config.greenScreenVehiclePosition.y, config.greenScreenVehiclePosition.z + 0.5);
	SetCamActive(cam, true);
	RenderScriptCams(true, false, 0, true, false, 0);

	await Delay(50);

	emitNet('takeScreenshot', `${model}`, 'vehicles');

	await Delay(2000);

	return;
}

function SetPedOnGround() {
	const [x, y, z] = GetEntityCoords(ped, false);
	const [retval, ground] = GetGroundZFor_3dCoord(x, y, z, 0, false);
	SetEntityCoords(ped, x, y, ground, false, false, false, false);

}

function ClearAllPedProps() {
	for (const prop of Object.keys(config.cameraSettings.PROPS)) {
		ClearPedProp(ped, parseInt(prop));
	}
}

async function ResetPedComponents() {

	if (config.debug) console.log(`DEBUG: Resetting Ped Components`);

	SetPedDefaultComponentVariation(ped);

	await Delay(150);

	SetPedComponentVariation(ped, 0, 0, 1, 0); // Head
	SetPedComponentVariation(ped, 1, 0, 0, 0); // Mask
	SetPedComponentVariation(ped, 2, -1, 0, 0); // Hair
	SetPedComponentVariation(ped, 7, 0, 0, 0); // Accessories
	SetPedComponentVariation(ped, 5, 0, 0, 0); // Bags
	SetPedComponentVariation(ped, 6, -1, 0, 0); // Shoes
	SetPedComponentVariation(ped, 9, 0, 0, 0); // Armor
	SetPedComponentVariation(ped, 3, -1, 0, 0); // Torso
	SetPedComponentVariation(ped, 8, -1, 0, 0); // Undershirt
	SetPedComponentVariation(ped, 4, -1, 0, 0); // Legs
	SetPedComponentVariation(ped, 11, -1, 0, 0); // Top
	SetPedHairColor(ped, 45, 15);

	ClearAllPedProps();

	return;
}

function setWeatherTime() {
	if (config.debug) console.log(`DEBUG: Setting Weather & Time`);
	SetRainLevel(0.0);
	SetWeatherTypePersist('EXTRASUNNY');
	SetWeatherTypeNow('EXTRASUNNY');
	SetWeatherTypeNowPersist('EXTRASUNNY');
	NetworkOverrideClockTime(18, 0, 0);
	NetworkOverrideClockMillisecondsPerGameMinute(1000000);
}

function stopWeatherResource() {
	if (config.debug) console.log(`DEBUG: Stopping Weather Resource`);
	if ((GetResourceState('qb-weathersync') == 'started') || (GetResourceState('qbx_weathersync') == 'started')) {
		TriggerEvent('qb-weathersync:client:DisableSync');
		return true;
	} else if (GetResourceState('weathersync') == 'started') {
		TriggerEvent('weathersync:toggleSync')
		return true;
	} else if (GetResourceState('esx_wsync') == 'started') {
		SendNUIMessage({
			error: 'weathersync',
		});
		return false;
	} else if (GetResourceState('cd_easytime') == 'started') {
		TriggerEvent('cd_easytime:PauseSync', false)
		return true;
	} else if (GetResourceState('vSync') == 'started' || GetResourceState('Renewed-Weathersync') == 'started') {
		TriggerEvent('vSync:toggle', false)
		return true;
	}
	return true;
};

function startWeatherResource() {
	if (config.debug) console.log(`DEBUG: Starting Weather Resource again`);
	if ((GetResourceState('qb-weathersync') == 'started') || (GetResourceState('qbx_weathersync') == 'started')) {
		TriggerEvent('qb-weathersync:client:EnableSync');
	} else if (GetResourceState('weathersync') == 'started') {
		TriggerEvent('weathersync:toggleSync')
	} else if (GetResourceState('cd_easytime') == 'started') {
		TriggerEvent('cd_easytime:PauseSync', true)
	} else if (GetResourceState('vSync') == 'started' || GetResourceState('Renewed-Weathersync') == 'started') {
		TriggerEvent('vSync:toggle', true)
	}
}

async function LoadComponentVariation(ped, component, drawable, texture) {
	texture = texture || 0;

	if (config.debug) console.log(`DEBUG: Loading Component Variation: ${component} ${drawable} ${texture}`);

	SetPedPreloadVariationData(ped, component, drawable, texture);
	while (!HasPedPreloadVariationDataFinished(ped)) {
		await Delay(50);
	}
	SetPedComponentVariation(ped, component, drawable, texture, 0);

	return;
}

async function LoadPropVariation(ped, component, prop, texture) {
	texture = texture || 0;

	if (config.debug) console.log(`DEBUG: Loading Prop Variation: ${component} ${prop} ${texture}`);

	SetPedPreloadPropData(ped, component, prop, texture);
	while (!HasPedPreloadPropDataFinished(ped)) {
		await Delay(50);
	}
	ClearPedProp(ped, component);
	SetPedPropIndex(ped, component, prop, texture, 0);

	return;
}

function createGreenScreenVehicle(vehicleHash, vehicleModel) {
	return new Promise(async(resolve, reject) => {
		if (config.debug) console.log(`DEBUG: Spawning Vehicle ${vehicleModel}`);
		const timeout = setTimeout(() => {
			resolve(null);
		}, config.vehicleSpawnTimeout)
		if (!HasModelLoaded(vehicleHash)) {
			RequestModel(vehicleHash);
			while (!HasModelLoaded(vehicleHash)) {
				await Delay(100);
			}
		}
		const vehicle = CreateVehicle(vehicleHash, config.greenScreenVehiclePosition.x, config.greenScreenVehiclePosition.y, config.greenScreenVehiclePosition.z, 0, true, true);
		if (vehicle === 0) {
			clearTimeout(timeout);
			resolve(null);
		}
		clearTimeout(timeout);
		resolve(vehicle);
	});
}

async function LoadFacialHair(ped, index) {
	if (config.debug) console.log(`DEBUG: Loading Facial Hair: ${index}`);
	SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);
	SetPedHeadOverlay(ped, 1, index, 1.0); // 1 = Facial Hair, 1.0 = full opacity
	SetPedHeadOverlayColor(ped, 1, 1, 0, 0); // Set beard color to black (1 = Facial Hair, 1 = Color Type, 0 = Color Index)
	await Delay(50);
	return;
}

RegisterCommand('screenshotvehicle', async (source, args) => {
    const vehicleModels = vehicles.map(v => v.model.toLowerCase());



    const ped = PlayerPedId();
    const type = args[0] ? args[0].toLowerCase() : 'all';
    const primarycolor = 68	; // Gris classique GTA
	const secondarycolor = 68	; // Gris classique GTA

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);
    SetEntityCoords(ped, config.greenScreenHiddenSpot.x, config.greenScreenHiddenSpot.y, config.greenScreenHiddenSpot.z, false, false, false);
    SetPlayerControl(playerId, false);

    ClearAreaOfVehicles(config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, 10, false, false, false, false, false);

    await Delay(100);

    if (type === 'all') {
        SendNUIMessage({
            start: true,
        });
        for (const vehicleModel of vehicleModels) {
            const vehicleHash = GetHashKey(vehicleModel);
            if (!IsModelValid(vehicleHash)) continue;

            const vehicleClass = GetVehicleClassFromName(vehicleHash);

            if (!config.includedVehicleClasses[vehicleClass]) {
                SetModelAsNoLongerNeeded(vehicleHash);
                continue;
            }

            SendNUIMessage({
                type: vehicleModel,
                value: vehicleModels.indexOf(vehicleModel) + 1,
                max: vehicleModels.length + 1
            });

            const vehicle = await createGreenScreenVehicle(vehicleHash, vehicleModel);

            if (vehicle === 0 || vehicle === null) {
                SetModelAsNoLongerNeeded(vehicleHash);
                console.log(`ERROR: Could not spawn vehicle. Broken Vehicle: ${vehicleModel}`);
                continue;
            }

            SetEntityRotation(vehicle, config.greenScreenVehicleRotation.x, config.greenScreenVehicleRotation.y, config.greenScreenVehicleRotation.z, 0, false);

            FreezeEntityPosition(vehicle, true);

            SetVehicleWindowTint(vehicle, 1);

            SetVehicleColours(vehicle, primarycolor, secondarycolor || primarycolor);

			SetVehicleExtraColours(vehicle, 0, 0);

            await Delay(50);

            await takeScreenshotForVehicle(vehicle, vehicleHash, vehicleModel);

            DeleteEntity(vehicle);
            SetModelAsNoLongerNeeded(vehicleHash);
        }
        SendNUIMessage({
            end: true,
        });
    } else {
        const vehicleModel = type;
        const vehicleHash = GetHashKey(vehicleModel);
        if (IsModelValid(vehicleHash)) {
            SendNUIMessage({
                type: vehicleModel,
                value: vehicleModels.indexOf(vehicleModel) + 1,
                max: vehicleModels.length + 1
            });

            const vehicle = await createGreenScreenVehicle(vehicleHash, vehicleModel);

            if (vehicle === 0 || vehicle === null) {
                SetModelAsNoLongerNeeded(vehicleHash);
                console.log(`ERROR: Could not spawn vehicle. Broken Vehicle: ${vehicleModel}`);
                return;
            }

            SetEntityRotation(vehicle, config.greenScreenVehicleRotation.x, config.greenScreenVehicleRotation.y, config.greenScreenVehicleRotation.z, 0, false);

            FreezeEntityPosition(vehicle, true);

            SetVehicleWindowTint(vehicle, 1);

            if (primarycolor) SetVehicleColours(vehicle, primarycolor, secondarycolor || primarycolor);

            await Delay(50);

            await takeScreenshotForVehicle(vehicle, vehicleHash, vehicleModel);

            DeleteEntity(vehicle);
            SetModelAsNoLongerNeeded(vehicleHash);
        } else {
            console.log('ERROR: Invalid vehicle model');
        }
    }
    SetPlayerControl(playerId, true);
    startWeatherResource();
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    cam = null;
});

RegisterCommand('screenshot', async (source, args) => {
	const modelHashes = [GetHashKey('mp_m_freemode_01'), GetHashKey('mp_f_freemode_01')];

	SendNUIMessage({
		start: true,
	});

	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);


	await Delay(100);

	for (const modelHash of modelHashes) {
		if (IsModelValid(modelHash)) {
			if (!HasModelLoaded(modelHash)) {
				RequestModel(modelHash);
				while (!HasModelLoaded(modelHash)) {
					await Delay(100);
				}
			}

			SetPlayerModel(playerId, modelHash);
			await Delay(150);
			SetModelAsNoLongerNeeded(modelHash);

			await Delay(150);

			ped = PlayerPedId();

			const pedType = modelHash === GetHashKey('mp_m_freemode_01') ? 'male' : 'female';
			SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
			SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
			FreezeEntityPosition(ped, true);
			await Delay(50);
			SetPlayerControl(playerId, false);

			interval = setInterval(() => {
				ClearPedTasksImmediately(ped);
			}, 1);

			for (const type of Object.keys(config.cameraSettings)) {
				for (const stringComponent of Object.keys(config.cameraSettings[type])) {
					await ResetPedComponents();
					await Delay(150);
					const component = parseInt(stringComponent);
					if (type === 'CLOTHING') {
						const drawableVariationCount = GetNumberOfPedDrawableVariations(ped, component);
						for (let drawable = 0; drawable < drawableVariationCount; drawable++) {
							const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);
							SendNUIMessage({
								type: config.cameraSettings[type][component].name,
								value: drawable,
								max: drawableVariationCount,
							});
							if (config.includeTextures) {
								for (let texture = 0; texture < textureVariationCount; texture++) {
									await LoadComponentVariation(ped, component, drawable, texture);
									await takeScreenshotForComponent(pedType, type, component, drawable, texture);
								}
							} else {
								await LoadComponentVariation(ped, component, drawable);
								await takeScreenshotForComponent(pedType, type, component, drawable);
							}
						}
					} else if (type === 'PROPS') {
						const propVariationCount = GetNumberOfPedPropDrawableVariations(ped, component);
						for (let prop = 0; prop < propVariationCount; prop++) {
							const textureVariationCount = GetNumberOfPedPropTextureVariations(ped, component, prop);
							SendNUIMessage({
								type: config.cameraSettings[type][component].name,
								value: prop,
								max: propVariationCount,
							});

							if (config.includeTextures) {
								for (let texture = 0; texture < textureVariationCount; texture++) {
									await LoadPropVariation(ped, component, prop, texture);
									await takeScreenshotForComponent(pedType, type, component, prop, texture);
								}
							} else {
								await LoadPropVariation(ped, component, prop);
								await takeScreenshotForComponent(pedType, type, component, prop);
							}
						}
					}
				}
			}
			SetModelAsNoLongerNeeded(modelHash);
			SetPlayerControl(playerId, true);
			FreezeEntityPosition(ped, false);
			clearInterval(interval);
		}
	}
	SetPedOnGround();
	startWeatherResource();
	SendNUIMessage({
		end: true,
	});
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	camInfo = null;
	cam = null;
});


RegisterCommand('screenshotopeyes', async (source, args) => {
    const modelHashes = [
        { hash: GetHashKey('mp_m_freemode_01'), type: 'male' },
        { hash: GetHashKey('mp_f_freemode_01'), type: 'female' }
    ];

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    for (const { hash: modelHash, type: pedType } of modelHashes) {
        if (IsModelValid(modelHash)) {
            if (!HasModelLoaded(modelHash)) {
                RequestModel(modelHash);
                while (!HasModelLoaded(modelHash)) {
                    await Delay(100);
                }
            }

            SetPlayerModel(playerId, modelHash);
            await Delay(150);
            SetModelAsNoLongerNeeded(modelHash);

            await Delay(150);

            ped = PlayerPedId();

            SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
            SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
            FreezeEntityPosition(ped, true);
            await Delay(50);
            SetPlayerControl(playerId, false);

            interval = setInterval(() => {
                ClearPedTasksImmediately(ped);
            }, 1);

            await ResetPedComponents();
            await Delay(150);

            // Force une tête de base et enlève les lunettes/masques
            SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 1.0, true);
            ClearAllPedProps(ped);
            SetPedComponentVariation(ped, 1, 0, 0, 0); // Pas de masque
            SetPedComponentVariation(ped, 2, -1, 0, 0); // Enlève les cheveux
            SetPedHairColor(ped, 1, 1); // Couleur des cheveux noire

            const maxIndex = 30;

            for (let index = 0; index <= maxIndex; index++) {
                SendNUIMessage({
                    type: "Eye Color",
                    value: index,
                    max: maxIndex,
                });

                SetPedEyeColor(ped, index);
                await Delay(200);

                camInfo = null;
                cam = null;

                await takeScreenshotForComponent(pedType, 'OVERLAY', 11, index);
            }

            SetModelAsNoLongerNeeded(modelHash);
            SetPlayerControl(playerId, true);
            FreezeEntityPosition(ped, false);
            clearInterval(interval);
        }
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});

RegisterCommand('screenshotbeard', async (source, args) => {
	const modelHash = GetHashKey('mp_m_freemode_01'); // Only male model has beards

	SendNUIMessage({
		start: true,
	});

	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);

	await Delay(100);

	if (IsModelValid(modelHash)) {
		if (!HasModelLoaded(modelHash)) {
			RequestModel(modelHash);
			while (!HasModelLoaded(modelHash)) {
				await Delay(100);
			}
		}

		SetPlayerModel(playerId, modelHash);
		await Delay(150);
		SetModelAsNoLongerNeeded(modelHash);

		await Delay(150);

		ped = PlayerPedId();

		SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
		SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
		FreezeEntityPosition(ped, true);
		await Delay(50);
		SetPlayerControl(playerId, false);

		interval = setInterval(() => {
			ClearPedTasksImmediately(ped);
		}, 1);

		await ResetPedComponents();
		await Delay(150);

		// Get number of facial hair variations dynamically
		const overlayID = 1; // ID for facial hair
		const maxIndex = GetPedHeadOverlayNum(overlayID);

		if (config.debug) console.log(`DEBUG: Found ${maxIndex} facial hair variations`);

		for (let index = 0; index <= maxIndex; index++) {
			SendNUIMessage({
				type: "Facial Hair",
				value: index,
				max: maxIndex,
			});
			
			await LoadFacialHair(ped, index);
			await takeScreenshotForComponent('male', 'OVERLAY', 1, index);
		}

		SetModelAsNoLongerNeeded(modelHash);
		SetPlayerControl(playerId, true);
		FreezeEntityPosition(ped, false);
		clearInterval(interval);
	}

	SetPedOnGround();
	startWeatherResource();
	SendNUIMessage({
		end: true,
	});
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	camInfo = null;
	cam = null;
});

RegisterCommand('screenshothair', async (source, args) => {
	const modelHashes = [GetHashKey('mp_m_freemode_01'), GetHashKey('mp_f_freemode_01')];

	SendNUIMessage({
		start: true,
	});

	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);

	await Delay(100);

	for (const modelHash of modelHashes) {
		if (IsModelValid(modelHash)) {
			if (!HasModelLoaded(modelHash)) {
				RequestModel(modelHash);
				while (!HasModelLoaded(modelHash)) {
					await Delay(100);
				}
			}

			SetPlayerModel(playerId, modelHash);
			await Delay(150);
			SetModelAsNoLongerNeeded(modelHash);

			await Delay(150);

			ped = PlayerPedId();

			const pedType = modelHash === GetHashKey('mp_m_freemode_01') ? 'male' : 'female';
			SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
			SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
			FreezeEntityPosition(ped, true);
			await Delay(50);
			SetPlayerControl(playerId, false);

			interval = setInterval(() => {
				ClearPedTasksImmediately(ped);
			}, 1);

			await ResetPedComponents();
			await Delay(150);

			// Set default head to make character more visible
			SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 1.0, true);
			
			// Set black hair and eyebrows
			SetPedHairColor(ped, 1, 1);
			SetPedHeadOverlay(ped, 2, 1, 1.0); // Set eyebrows
			SetPedHeadOverlayColor(ped, 2, 1, 1, 0); // Set eyebrows color to black

			const component = 2; // Hair component ID
			const drawableVariationCount = GetNumberOfPedDrawableVariations(ped, component);

			for (let drawable = 0; drawable < drawableVariationCount; drawable++) {
				const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);
				SendNUIMessage({
					type: "Hair",
					value: drawable,
					max: drawableVariationCount,
				});

				if (config.includeTextures) {
					for (let texture = 0; texture < textureVariationCount; texture++) {
						await LoadComponentVariation(ped, component, drawable, texture);
						SetPedHairColor(ped, 1, 1); // Ensure hair stays black after each variation
						await takeScreenshotForComponent(pedType, 'CLOTHING', component, drawable, texture);
					}
				} else {
					await LoadComponentVariation(ped, component, drawable);
					SetPedHairColor(ped, 1, 1); // Ensure hair stays black after each variation
					await takeScreenshotForComponent(pedType, 'CLOTHING', component, drawable);
				}
			}

			SetModelAsNoLongerNeeded(modelHash);
			SetPlayerControl(playerId, true);
			FreezeEntityPosition(ped, false);
			clearInterval(interval);
		}
	}

	SetPedOnGround();
	startWeatherResource();
	SendNUIMessage({
		end: true,
	});
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	camInfo = null;
	cam = null;
});

RegisterCommand('screenshothairfemale', async (source, args) => {
	const modelHash = GetHashKey('mp_f_freemode_01'); 

	SendNUIMessage({
		start: true,
	});

	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);

	await Delay(100);

	if (IsModelValid(modelHash)) {
		if (!HasModelLoaded(modelHash)) {
			RequestModel(modelHash);
			while (!HasModelLoaded(modelHash)) {
				await Delay(100);
			}
		}

		SetPlayerModel(playerId, modelHash);
		await Delay(150);
		SetModelAsNoLongerNeeded(modelHash);

		await Delay(150);

		ped = PlayerPedId();

		SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
		SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
		FreezeEntityPosition(ped, true);
		await Delay(50);
		SetPlayerControl(playerId, false);

		interval = setInterval(() => {
			ClearPedTasksImmediately(ped);
		}, 1);

		await ResetPedComponents();
		await Delay(150);

		SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 1.0, true);

		SetPedHairColor(ped, 1, 1);
		SetPedHeadOverlay(ped, 2, 1, 1.0); 
		SetPedHeadOverlayColor(ped, 2, 1, 1, 0); 

		const component = 2;
		const drawableVariationCount = GetNumberOfPedDrawableVariations(ped, component);

		for (let drawable = 0; drawable < drawableVariationCount; drawable++) {
			const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);
			SendNUIMessage({
				type: "Female Hair",
				value: drawable,
				max: drawableVariationCount,
			});

			if (config.includeTextures) {
				for (let texture = 0; texture < textureVariationCount; texture++) {
					await LoadComponentVariation(ped, component, drawable, texture);
					SetPedHairColor(ped, 1, 1);
					await takeScreenshotForComponent('female', 'CLOTHING', component, drawable, texture);
				}
			} else {
				await LoadComponentVariation(ped, component, drawable);
				SetPedHairColor(ped, 1, 1); 
				await takeScreenshotForComponent('female', 'CLOTHING', component, drawable);
			}
		}

		SetModelAsNoLongerNeeded(modelHash);
		SetPlayerControl(playerId, true);
		FreezeEntityPosition(ped, false);
		clearInterval(interval);
	}

	SetPedOnGround();
	startWeatherResource();
	SendNUIMessage({
		end: true,
	});
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	camInfo = null;
	cam = null;
});



RegisterCommand('screenshotmaquillages', async (source, args) => {
    const modelHashes = [
        { hash: GetHashKey('mp_m_freemode_01'), type: 'male' },
        { hash: GetHashKey('mp_f_freemode_01'), type: 'female' }
    ];

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    for (const { hash: modelHash, type: pedType } of modelHashes) {
        if (IsModelValid(modelHash)) {
            if (!HasModelLoaded(modelHash)) {
                RequestModel(modelHash);
                while (!HasModelLoaded(modelHash)) {
                    await Delay(100);
                }
            }

            SetPlayerModel(playerId, modelHash);
            await Delay(150);
            SetModelAsNoLongerNeeded(modelHash);

            await Delay(150);

            ped = PlayerPedId();

            SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
            SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
            FreezeEntityPosition(ped, true);
            await Delay(50);
            SetPlayerControl(playerId, false);

            interval = setInterval(() => {
                ClearPedTasksImmediately(ped);
            }, 1);

            await ResetPedComponents();
            await Delay(150);

            const overlayID = 4; // Makeup overlay
            const maxIndex = GetPedHeadOverlayNum(overlayID);

            if (config.debug) console.log(`DEBUG: Found ${maxIndex} makeup variations for ${pedType}`);

            for (let index = 0; index <= maxIndex; index++) {
                SendNUIMessage({
                    type: "Makeup",
                    value: index,
                    max: maxIndex,
                });

                SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);
                SetPedHeadOverlay(ped, overlayID, index, 1.0); // 1.0 = full opacity
                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', overlayID, index);
            }

            SetModelAsNoLongerNeeded(modelHash);
            SetPlayerControl(playerId, true);
            FreezeEntityPosition(ped, false);
            clearInterval(interval);
        }
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});

RegisterCommand('screenshotcharacter', async (source, args) => {
    const modelHashes = [
        { hash: GetHashKey('mp_m_freemode_01'), type: 'male' },
        { hash: GetHashKey('mp_f_freemode_01'), type: 'female' }
    ];

    const skipHair = args[0]?.toLowerCase() === 'skip';

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    for (const { hash: modelHash, type: pedType } of modelHashes) {
        if (IsModelValid(modelHash)) {
            if (!HasModelLoaded(modelHash)) {
                RequestModel(modelHash);
                while (!HasModelLoaded(modelHash)) {
                    await Delay(100);
                }
            }

            SetPlayerModel(playerId, modelHash);
            await Delay(150);
            SetModelAsNoLongerNeeded(modelHash);

            await Delay(150);

            ped = PlayerPedId();

            SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
            SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
            FreezeEntityPosition(ped, true);
            await Delay(50);
            SetPlayerControl(playerId, false);

            interval = setInterval(() => {
                ClearPedTasksImmediately(ped);
            }, 1);

            await ResetPedComponents();
            await Delay(150);

            // Force une tête de base et enlève les lunettes/masques
            SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 1.0, true);
            ClearAllPedProps(ped);
            SetPedComponentVariation(ped, 1, 0, 0, 0); // Pas de masque
            SetPedComponentVariation(ped, 2, 0, 0, 0); // Cheveux courts
            SetPedHairColor(ped, 1, 1); // Cheveux noirs

            if (!skipHair) {
                // Screenshots des yeux
                const maxEyeIndex = 30;
                for (let index = 0; index <= maxEyeIndex; index++) {
                    SendNUIMessage({
                        type: "Eye Color",
                        value: index,
                        max: maxEyeIndex,
                    });

                    SetPedEyeColor(ped, index);
                    await Delay(200);

                    camInfo = null;
                    cam = null;

                    await takeScreenshotForComponent(pedType, 'OVERLAY', 11, index);
                }

                // Screenshots des sourcils
                const maxEyebrowIndex = 30;
                for (let index = 0; index <= maxEyebrowIndex; index++) {
                    SendNUIMessage({
                        type: "Eyebrows",
                        value: index,
                        max: maxEyebrowIndex,
                    });

                    SetPedHeadOverlay(ped, 2, index, 1.0);
                    SetPedHeadOverlayColor(ped, 2, 1, 1, 0);
                    await Delay(50);

                    await takeScreenshotForComponent(pedType, 'OVERLAY', 2, index);
                }

                // Screenshots des cheveux
                const component = 2;
                const drawableVariationCount = GetNumberOfPedDrawableVariations(ped, component);
                for (let drawable = 0; drawable < drawableVariationCount; drawable++) {
                    const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);
                    SendNUIMessage({
                        type: "Hair",
                        value: drawable,
                        max: drawableVariationCount,
                    });

                    if (config.includeTextures) {
                        for (let texture = 0; texture < textureVariationCount; texture++) {
                            await LoadComponentVariation(ped, component, drawable, texture);
                            SetPedHairColor(ped, 1, 1);
                            await takeScreenshotForComponent(pedType, 'CLOTHING', component, drawable, texture);
                        }
                    } else {
                        await LoadComponentVariation(ped, component, drawable);
                        SetPedHairColor(ped, 1, 1);
                        await takeScreenshotForComponent(pedType, 'CLOTHING', component, drawable);
                    }
                }
            }

            // Screenshots du maquillage
            const maxMakeupIndex = GetPedHeadOverlayNum(4);
            for (let index = 0; index <= maxMakeupIndex; index++) {
                SendNUIMessage({
                    type: "Makeup",
                    value: index,
                    max: maxMakeupIndex,
                });

                SetPedHeadOverlay(ped, 4, index, 1.0);
                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', 4, index);
            }

            // Screenshots du rouge à lèvres
            const maxLipstickIndex = GetPedHeadOverlayNum(8);
            for (let index = 0; index <= maxLipstickIndex; index++) {
                SendNUIMessage({
                    type: "Lipstick",
                    value: index,
                    max: maxLipstickIndex,
                });

                SetPedHeadOverlay(ped, 8, index, 1.0);
                SetPedHeadOverlayColor(ped, 8, 2, 1, 0);
                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', 8, index);
            }

            // Screenshots du blush
            const maxBlushIndex = GetPedHeadOverlayNum(5);
            for (let index = 0; index <= maxBlushIndex; index++) {
                SendNUIMessage({
                    type: "Blush",
                    value: index,
                    max: maxBlushIndex,
                });

                SetPedHeadOverlay(ped, 5, index, 1.0);
                SetPedHeadOverlayColor(ped, 5, 2, 1, 0);
                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', 5, index);
            }

            // Screenshots des poils de poitrine (uniquement pour le modèle masculin)
            if (pedType === 'male') {
                const maxChestHairIndex = GetPedHeadOverlayNum(10);
                for (let index = 0; index <= maxChestHairIndex; index++) {
                    SendNUIMessage({
                        type: "Chest Hair",
                        value: index,
                        max: maxChestHairIndex,
                    });

                    SetPedComponentVariation(ped, 3, 15, 0, 0);
                    SetPedHeadOverlay(ped, 10, index, 1.0);
                    SetPedHeadOverlayColor(ped, 10, 1, 0, 0);
                    await Delay(50);

                    await takeScreenshotForComponent(pedType, 'OVERLAY', 10, index);
                }
            }

            SetModelAsNoLongerNeeded(modelHash);
            SetPlayerControl(playerId, true);
            FreezeEntityPosition(ped, false);
            clearInterval(interval);
        }
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});

setImmediate(() => {
	emit('chat:addSuggestions', [
		{
			name: '/screenshot',
			help: 'generate clothing screenshots',
		},
		{
			name: '/screenshotbeard',
			help: 'generate beard screenshots for male character',
		},
		{
			name: '/customscreenshot',
			help: 'generate custom cloting screenshots',
			params: [
				{name:"component", help:"The clothing component to take a screenshot of"},
				{name:"drawable/all", help:"The drawable variation to take a screenshot of"},
				{name:"props/clothing", help:"PROPS or CLOTHING"},
				{name:"male/female/both", help:"The gender to take a screenshot of"},
				{name:"camera settings", help:"The camera settings to use for the screenshot (optional)"},
			]
		},
		{
			name: '/screenshotobject',
			help: 'generate object screenshots',
			params: [
				{name:"object", help:"The object hash to take a screenshot of"},
			]
		},
		{
			name: '/screenshotvehicle',
			help: 'generate vehicle screenshots',
			params: [
				{name:"model/all", help:"The vehicle model or 'all' to take a screenshot of all vehicles"},
				{name:"primarycolor", help:"The primary vehicle color to take a screenshot of (optional) See: https://wiki.rage.mp/index.php?title=Vehicle_Colors"},
				{name:"secondarycolor", help:"The secondary vehicle color to take a screenshot of (optional) See: https://wiki.rage.mp/index.php?title=Vehicle_Colors"},
			]
		}
	])
  });

on('onResourceStop', (resName) => {
	if (GetCurrentResourceName() != resName) return;

	startWeatherResource();
	clearInterval(interval);
	SetPlayerControl(playerId, true);
	FreezeEntityPosition(ped, false);
});

RegisterCommand('screenshothairchest', async (source, args) => {
    const modelHash = GetHashKey('mp_m_freemode_01'); // Uniquement le modèle homme

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    if (IsModelValid(modelHash)) {
        if (!HasModelLoaded(modelHash)) {
            RequestModel(modelHash);
            while (!HasModelLoaded(modelHash)) {
                await Delay(100);
            }
        }

        SetPlayerModel(playerId, modelHash);
        await Delay(150);
        SetModelAsNoLongerNeeded(modelHash);

        await Delay(150);

        ped = PlayerPedId();

        SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
        SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
        FreezeEntityPosition(ped, true);
        await Delay(50);
        SetPlayerControl(playerId, false);

        interval = setInterval(() => {
            ClearPedTasksImmediately(ped);
        }, 1);

        await ResetPedComponents();
        await Delay(150);

        // Overlay 10 = Chest Hair
        const overlayID = 10;
        const maxIndex = GetPedHeadOverlayNum(overlayID);

        if (config.debug) console.log(`DEBUG: Found ${maxIndex} chest hair variations`);

        for (let index = 0; index <= maxIndex; index++) {
            SendNUIMessage({
                type: "Chest Hair",
                value: index,
                max: maxIndex,
            });

            SetPedComponentVariation(ped, 3, 15, 0, 0); // Torso basique, ajuste le drawable si besoin
            SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);
            SetPedHeadOverlay(ped, overlayID, index, 1.0); // 1.0 = full opacity
            SetPedHeadOverlayColor(ped, overlayID, 1, 0, 0); // Couleur noire

            await Delay(50);

            await takeScreenshotForComponent('male', 'OVERLAY', overlayID, index);
        }

        SetModelAsNoLongerNeeded(modelHash);
        SetPlayerControl(playerId, true);
        FreezeEntityPosition(ped, false);
        clearInterval(interval);
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});

RegisterCommand('screenshoteebrows', async (source, args) => {
    const modelHashes = [
        { hash: GetHashKey('mp_m_freemode_01'), type: 'male' },
        { hash: GetHashKey('mp_f_freemode_01'), type: 'female' }
    ];

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    for (const { hash: modelHash, type: pedType } of modelHashes) {
        if (IsModelValid(modelHash)) {
            if (!HasModelLoaded(modelHash)) {
                RequestModel(modelHash);
                while (!HasModelLoaded(modelHash)) {
                    await Delay(100);
                }
            }

            SetPlayerModel(playerId, modelHash);
            await Delay(150);
            SetModelAsNoLongerNeeded(modelHash);

            await Delay(150);

            ped = PlayerPedId();

            SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
            SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
            FreezeEntityPosition(ped, true);
            await Delay(50);
            SetPlayerControl(playerId, false);

            interval = setInterval(() => {
                ClearPedTasksImmediately(ped);
            }, 1);

            await ResetPedComponents();
            await Delay(150);

            // Overlay 2 = Eyebrows
            const overlayID = 2;
            const maxIndex = GetPedHeadOverlayNum(overlayID);

            if (config.debug) console.log(`DEBUG: Found ${maxIndex} eyebrow variations for ${pedType}`);

            for (let index = 0; index <= maxIndex; index++) {
                SendNUIMessage({
                    type: "Eyebrows",
                    value: index,
                    max: maxIndex,
                });

                SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);
                SetPedHeadOverlay(ped, overlayID, index, 1.0); // 1.0 = full opacity
                SetPedHeadOverlayColor(ped, overlayID, 1, 1, 0); // Couleur noire

                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', 22, index);
            }

            SetModelAsNoLongerNeeded(modelHash);
            SetPlayerControl(playerId, true);
            FreezeEntityPosition(ped, false);
            clearInterval(interval);
        }
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});

RegisterCommand('screenshotlips', async (source, args) => {
    const modelHashes = [
        { hash: GetHashKey('mp_m_freemode_01'), type: 'male' },
        { hash: GetHashKey('mp_f_freemode_01'), type: 'female' }
    ];

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    for (const { hash: modelHash, type: pedType } of modelHashes) {
        if (IsModelValid(modelHash)) {
            if (!HasModelLoaded(modelHash)) {
                RequestModel(modelHash);
                while (!HasModelLoaded(modelHash)) {
                    await Delay(100);
                }
            }

            SetPlayerModel(playerId, modelHash);
            await Delay(150);
            SetModelAsNoLongerNeeded(modelHash);

            await Delay(150);

            ped = PlayerPedId();

            SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
            SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
            FreezeEntityPosition(ped, true);
            await Delay(50);
            SetPlayerControl(playerId, false);

            interval = setInterval(() => {
                ClearPedTasksImmediately(ped);
            }, 1);

            await ResetPedComponents();
            await Delay(150);

            // Overlay 8 = Lipstick
            const overlayID = 8;
            const maxIndex = GetPedHeadOverlayNum(overlayID);

            if (config.debug) console.log(`DEBUG: Found ${maxIndex} lipstick variations for ${pedType}`);

            for (let index = 0; index <= maxIndex; index++) {
                SendNUIMessage({
                    type: "Lipstick",
                    value: index,
                    max: maxIndex,
                });

                SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);
                SetPedHeadOverlay(ped, overlayID, index, 1.0); // 1.0 = full opacity
                SetPedHeadOverlayColor(ped, overlayID, 2, 1, 0); // Couleur par défaut

                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', overlayID, index);
            }

            SetModelAsNoLongerNeeded(modelHash);
            SetPlayerControl(playerId, true);
            FreezeEntityPosition(ped, false);
            clearInterval(interval);
        }
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});

RegisterCommand('screenshotblush', async (source, args) => {
    const modelHashes = [
        { hash: GetHashKey('mp_m_freemode_01'), type: 'male' },
        { hash: GetHashKey('mp_f_freemode_01'), type: 'female' }
    ];

    SendNUIMessage({ start: true });

    if (!stopWeatherResource()) return;

    DisableIdleCamera(true);

    await Delay(100);

    for (const { hash: modelHash, type: pedType } of modelHashes) {
        if (IsModelValid(modelHash)) {
            if (!HasModelLoaded(modelHash)) {
                RequestModel(modelHash);
                while (!HasModelLoaded(modelHash)) {
                    await Delay(100);
                }
            }

            SetPlayerModel(playerId, modelHash);
            await Delay(150);
            SetModelAsNoLongerNeeded(modelHash);

            await Delay(150);

            ped = PlayerPedId();

            SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
            SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
            FreezeEntityPosition(ped, true);
            await Delay(50);
            SetPlayerControl(playerId, false);

            interval = setInterval(() => {
                ClearPedTasksImmediately(ped);
            }, 1);

            await ResetPedComponents();
            await Delay(150);

            // Overlay 5 = Blush
            const overlayID = 5;
            const maxIndex = GetPedHeadOverlayNum(overlayID);

            if (config.debug) console.log(`DEBUG: Found ${maxIndex} blush variations for ${pedType}`);

            for (let index = 0; index <= maxIndex; index++) {
                SendNUIMessage({
                    type: "Blush",
                    value: index,
                    max: maxIndex,
                });

                SetPedHeadBlendData(ped, 0, 0, 0, 0, 0, 0, 0, 0, 0, false);
                SetPedHeadOverlay(ped, overlayID, index, 1.0); // 1.0 = full opacity
                SetPedHeadOverlayColor(ped, overlayID, 2, 1, 0); // Couleur par défaut

                await Delay(50);

                await takeScreenshotForComponent(pedType, 'OVERLAY', overlayID, index);
            }

            SetModelAsNoLongerNeeded(modelHash);
            SetPlayerControl(playerId, true);
            FreezeEntityPosition(ped, false);
            clearInterval(interval);
        }
    }

    SetPedOnGround();
    startWeatherResource();
    SendNUIMessage({ end: true });
    DestroyAllCams(true);
    DestroyCam(cam, true);
    RenderScriptCams(false, false, 0, true, false, 0);
    camInfo = null;
    cam = null;
});
