// === VISUALLY UPGRADED SLOT MACHINE - FULLY REPLACED createSlotMachine() & createScene() ===

let currentUser = null;
let gameEngine = null;
let gameScene = null;
let isSpinning = false;
let currentBet = 10;
let reels = [];
let reelMeshes = [];
let loadedTextures = {};

const symbolKeys = ['BAR', 'CHERRY', 'CROWN', 'DIAMOND', 'FREE_SPIN', 'SCATTER', 'SEVEN', 'WILD'];
const symbolImageMap = {
    'BAR': '/images/bar.png',
    'CHERRY': '/images/cherry.png',
    'CROWN': '/images/crown.png',
    'DIAMOND': '/images/diamond.png',
    'FREE_SPIN': '/images/free_spin.png',
    'SCATTER': '/images/scatter.png',
    'SEVEN': '/images/seven.png',
    'WILD': '/images/wild.png'
};

function preloadTextures(scene) {
    const assetsManager = new BABYLON.AssetsManager(scene);
    for (const key in symbolImageMap) {
        const path = symbolImageMap[key];
        const task = assetsManager.addTextureTask(key, path);
        task.onSuccess = t => loadedTextures[key] = t.texture;
    }
    return new Promise((resolve, reject) => {
        assetsManager.onFinish = () => resolve(loadedTextures);
        assetsManager.load();
    });
}

function initGame() {
    const canvas = document.getElementById('renderCanvas');
    gameEngine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

    const tempScene = new BABYLON.Scene(gameEngine);
    preloadTextures(tempScene).then(() => {
        tempScene.dispose();
        gameScene = createScene();
        gameEngine.runRenderLoop(() => gameScene.render());

        window.addEventListener('resize', () => gameEngine.resize());
    });
}

function createScene() {
    const scene = new BABYLON.Scene(gameEngine);
    scene.clearColor = new BABYLON.Color4(0.02, 0, 0.05, 1);

    // HDR Environment for realistic reflections
    const hdr = BABYLON.CubeTexture.CreateFromPrefilteredData("/env/casino.env", scene);
    scene.environmentTexture = hdr;
    scene.environmentIntensity = 1.3;

    // Camera
    const camera = new BABYLON.ArcRotateCamera("cam", Math.PI / 2, Math.PI / 2.8, 18, BABYLON.Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 25;
    camera.attachControl(document.getElementById('renderCanvas'), true);

    // Lights
    new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.6;

    const spot = new BABYLON.SpotLight("spot", new BABYLON.Vector3(0, 15, -10), new BABYLON.Vector3(0, -1, 0.5), Math.PI / 2.5, 10, scene);
    spot.intensity = 2;

    // Flashing casino lights
    setInterval(() => {
        spot.diffuse = new BABYLON.Color3(Math.random(), Math.random() * 0.5, Math.random());
    }, 800);

    createSlotMachine(scene);
    createCasinoFloor(scene);
    createWinParticlesSystem(scene); // Pre-create for performance

    return scene;
}

let particleSystem;
function createWinParticlesSystem(scene) {
    particleSystem = new BABYLON.ParticleSystem("coins", 3000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("/textures/coin.png", scene);
    particleSystem.minSize = 0.2;
    particleSystem.maxSize = 0.8;
    particleSystem.minLifeTime = 1.0;
    particleSystem.maxLifeTime = 3.0;
    particleSystem.emitRate = 0; // We'll control manually
    particleSystem.emitter = new BABYLON.Vector3(0, 2, 2);
    particleSystem.direction1 = new BABYLON.Vector3(-3, 8, -3);
    particleSystem.direction2 = new BABYLON.Vector3(3, 8, 3);
    particleSystem.gravity = new BABYLON.Vector3(0, -15, 0);
    particleSystem.color1 = new BABYLON.Color4(1, 0.9, 0.2, 1);
    particleSystem.color2 = new BABYLON.Color4(1, 0.6, 0, 1);
    particleSystem.minEmitPower = 3;
    particleSystem.maxEmitPower = 8;
}

function triggerWinParticles() {
    if (!particleSystem) return;
    particleSystem.emitter = new BABYLON.Vector3(0, 1, 1.8);
    particleSystem.emitRate = 800;
    particleSystem.start();
    setTimeout(() => particleSystem.emitRate = 0, 800);
}

function createCasinoFloor(scene) {
    const floor = BABYLON.MeshBuilder.CreateGround("floor", { width: 100, height: 100 }, scene);
    const mat = new BABYLON.PBRMaterial("floorMat", scene);
    mat.albedoColor = new BABYLON.Color3(0.05, 0.02, 0.1);
    mat.metallic = 0.1;
    mat.roughness = 0.9;
    floor.material = mat;
    floor.position.y = -5;
}

function createSlotMachine(scene) {
    // Import real 3D model instead of red box
    BABYLON.SceneLoader.ImportMeshAsync("", "/models/", "slot_machine.glb", scene).then((container) => {
        const machine = container.meshes[0];
        machine.scaling = new BABYLON.Vector3(3, 3, 3);
        machine.position.y = -2.5;
        machine.rotation.y = Math.PI;

        // Convert all materials to shiny PBR
        container.meshes.forEach(mesh => {
            if (mesh.material) {
                const pbr = new BABYLON.PBRMaterial(mesh.material.name + "_pbr", scene);
                pbr.albedoColor = mesh.material.diffuseColor || BABYLON.Color3.White();
                pbr.metallic = 0.95;
                pbr.roughness = 0.15;
                mesh.material = pbr;
            }
        });
    });

    const positions = [-3, 0, 3];
    const glowFrames = [];

    for (let i = 0; i < 3; i++) {
        const reel = createReel(scene, i);
        reel.position.x = positions[i];
        reelMeshes.push(reel);

        // Glowing neon frame
        const frame = BABYLON.MeshBuilder.CreatePlane(`frame${i}`, { width: 3.2, height: 3.2 }, scene);
        frame.position = new BABYLON.Vector3(positions[i], 0, 1.9);
        const mat = new BABYLON.StandardMaterial("frameMat", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 0.7, 0);
        mat.diffuseColor = BABYLON.Color3.Black();
        mat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
        mat.emissiveFresnelParameters.bias = 0.4;
        mat.emissiveFresnelParameters.power = 3;
        mat.emissiveFresnelParameters.leftColor = BABYLON.Color3.Yellow();
        mat.emissiveFresnelParameters.rightColor = BABYLON.Color3.Red();
        frame.material = mat;
        glowFrames.push(frame);
    }

    // Store for win animation
    window.glowFrames = glowFrames;
}

function createReel(scene, index) {
    const parent = new BABYLON.TransformNode(`reel${index}`, scene);
    const symbols = [];

    for (let i = 0; i < 20; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(`sym${index}_${i}`, { width: 2.2, height: 2.2 }, scene);
        plane.position.y = i * 2.5 - 25;
        plane.position.z = 0.05;
        plane.parent = parent;

        const mat = new BABYLON.StandardMaterial(`mat${index}_${i}`, scene);
        mat.backFaceCulling = false;

        const key = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        const tex = loadedTextures[key];
        if (tex && tex.isReady()) {
            mat.emissiveTexture = tex;
            mat.emissiveColor = new BABYLON.Color3(1.4, 1.4, 1.4); // Overbright!
            mat.opacityTexture = tex;
            mat.useAlphaFromDiffuseTexture = true;
        } else {
            mat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.4);
        }

        // Disable all lighting
        mat.diffuseColor = BABYLON.Color3.Black();
        mat.specularColor = BABYLON.Color3.Black();

        // Glow border
        const glow = BABYLON.MeshBuilder.CreatePlane("glow", { width: 2.4, height: 2.4 }, scene);
        glow.position.z = -0.02;
        glow.parent = plane;
        const glowMat = new BABYLON.StandardMaterial("glow", scene);
        glowMat.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
        glowMat.alpha = 0.7;
        glow.material = glowMat;

        plane.material = mat;
        symbols.push({ plane, symbol: key });
    }

    reels[index] = symbols;
    return parent;
}

// Enhanced win animation
function celebrateWin() {
    triggerWinParticles();

    // Pulse frames
    window.glowFrames?.forEach(frame => {
        const anim = BABYLON.Animation.CreateAndStartAnimation("pulse", frame.scaling, "x", 60, 60,
            1, 1.3, BABYLON.Animation.ANIMATIONLOOPMODE_RELATIVE, new BABYLON.BounceEase());
        BABYLON.Animation.CreateAndStartAnimation("pulseY", frame.scaling, "y", 60, 60,
            1, 1.3, BABYLON.Animation.ANIMATIONLOOPMODE_RELATIVE, new BABYLON.BounceEase());
    });
}

// In submitGameResult(), after win:
if (winAmount > 0) {
    showResult(`JACKPOT! +$${winAmount.toFixed(2)}`);
    celebrateWin();
}
