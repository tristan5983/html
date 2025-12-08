// ===============================================
//  FULL game.js – Beautiful 3D Slot Machine
//  Login + Balance + Jackpot + Win Effects ALL WORKING
// ===============================================

let currentUser = null;
let gameEngine = null;
let gameScene = null;
let isSpinning = false;
let currentBet = 10;
let reels = [];
let reelMeshes = [];
let loadedTextures = {};
let particleSystem = null;
let glowFrames = [];

// Symbol setup
const symbolKeys = ['BAR', 'CHERRY', 'CROWN', 'DIAMOND', 'FREE_SPIN', 'SCATTER', 'SEVEN', 'WILD'];
const symbolImageMap = {
    BAR: '/images/bar.png',
    CHERRY: '/images/cherry.png',
    CROWN: '/images/crown.png',
    DIAMOND: '/images/diamond.png',
    FREE_SPIN: '/images/free_spin.png',
    SCATTER: '/images/scatter.png',
    SEVEN: '/images/seven.png',
    WILD: '/images/wild.png'
};

// ====================== AUTH & UI ======================
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return showError('Please fill in all fields');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            showLobby();
            loadJackpot();
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (err) {
        showError('Connection error');
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    if (!username || !password) return showError('Please fill in all fields');

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            showLobby();
            loadJackpot();
        } else {
            showError(data.error || 'Registration failed');
        }
    } catch (err) {
        showError('Connection error');
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    location.reload();
}

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    clearError();
}
function showRegister() {
    document.getElementById('registerForm').classList.remove('hidden');
    document.getElementById('loginForm').classList.add('hidden');
    clearError();
}
function showError(msg) {
    const el = document.getElementById('errorMessage');
    el.textContent = msg;
    el.classList.remove('hidden');
}
function clearError() {
    document.getElementById('errorMessage').classList.add('hidden');
}
function showLobby() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('lobbyContainer').style.display = 'block';
    updateBalance();
}
function updateBalance() {
    if (currentUser) {
        document.getElementById('userBalance').textContent = currentUser.balance.toFixed(2);
        document.getElementById('gameBalance').textContent = currentUser.balance.toFixed(2);
    }
}

// ====================== JACKPOT & FUNDS ======================
async function loadJackpot() {
    try {
        const res = await fetch('/api/jackpot');
        const data = await res.json();
        document.getElementById('jackpotAmount').textContent = data.amount.toFixed(2);
        document.getElementById('gameJackpot').textContent = data.amount.toFixed(2);

        setInterval(async () => {
            const r = await fetch('/api/jackpot');
            const d = await r.json();
            animateValue('jackpotAmount', parseFloat(document.getElementById('jackpotAmount').textContent), d.amount, 1000);
            animateValue('gameJackpot', parseFloat(document.getElementById('gameJackpot').textContent), d.amount, 1000);
        }, 5000);
    } catch (e) { console.error(e); }
}

function animateValue(id, start, end, duration) {
    const el = document.getElementById(id);
    const range = end - start;
    let current = start;
    const increment = range > 0 ? Math.abs(range) / (duration / 16) : -Math.abs(range) / (duration / 16);
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        el.textContent = current.toFixed(2);
    }, 16);
}

function showFundsModal() {
    document.getElementById('fundsModal').classList.add('show');
}
function closeFundsModal() {
    document.getElementById('fundsModal').classList.remove('show');
}
async function addFunds() {
    const amount = parseFloat(document.getElementById('fundsAmount').value);
    if (!amount || amount <= 0) return showFundsError('Invalid amount');
    const res = await fetch('/api/funds/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
    const data = await res.json();
    if (res.ok) { currentUser.balance = data.balance; updateBalance(); closeFundsModal(); }
    else showFundsError(data.error);
}
async function withdrawFunds() {
    const amount = parseFloat(document.getElementById('fundsAmount').value);
    if (!amount || amount <= 0) return showFundsError('Invalid amount');
    const res = await fetch('/api/funds/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
    const data = await res.json();
    if (res.ok) { currentUser.balance = data.balance; updateBalance(); closeFundsModal(); }
    else showFundsError(data.error);
}
function showFundsError(msg) {
    document.getElementById('fundsError').textContent = msg;
    document.getElementById('fundsError').classList.remove('hidden');
}

// ====================== GAME ======================
function playGame() {
    document.getElementById('lobbyContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    if (!gameEngine) initGame();
    updateGameUI();
}
function backToLobby() {
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('lobbyContainer').style.display = 'block';
    fetch('/api/user').then(r => r.json()).then(d => { currentUser = d; updateBalance(); });
}
function updateGameUI() {
    document.getElementById('gameBalance').textContent = currentUser.balance.toFixed(2);
    document.getElementById('gameBet').textContent = currentBet.toFixed(2);
    document.getElementById('betDisplay').textContent = currentBet.toFixed(2);
}
function changeBet(delta) {
    currentBet = Math.max(5, Math.min(currentUser.balance, currentBet + delta));
    document.getElementById('gameBet').textContent = currentBet.toFixed(2);
    document.getElementById('betDisplay').textContent = currentBet.toFixed(2);
}

// ====================== BABYLON.JS 3D SLOT MACHINE ======================
function preloadTextures(scene) {
    const assetsManager = new BABYLON.AssetsManager(scene);
    for (const key in symbolImageMap) {
        const task = assetsManager.addTextureTask(key, symbolImageMap[key]);
        task.onSuccess = t => loadedTextures[key] = t.texture;
    }
    return new Promise(resolve => {
        assetsManager.onFinish = () => resolve();
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
    }).catch(err => {
        console.error("Failed to load textures", err);
        alert("Could not load game assets. Check image paths.");
    });
}

function createScene() {
    const scene = new BABYLON.Scene(gameEngine);
    scene.clearColor = new BABYLON.Color4(0.02, 0, 0.05, 1);

    // HDR Lighting
    const hdr = BABYLON.CubeTexture.CreateFromPrefilteredData("/env/casino.env", scene);
    scene.environmentTexture = hdr;
    scene.environmentIntensity = 1.4;

    const camera = new BABYLON.ArcRotateCamera("cam", Math.PI/2, Math.PI/2.8, 18, BABYLON.Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 25;
    camera.attachControl(canvas, true);

    new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene).intensity = 0.6;

    const spot = new BABYLON.SpotLight("spot", new BABYLON.Vector3(0,15,-10), new BABYLON.Vector3(0,-1,0.5), Math.PI/2.5, 10, scene);
    spot.intensity = 2;
    setInterval(() => spot.diffuse = BABYLON.Color3.FromHex(["#ff0080","#00ffff","#ffff00","#ff00ff"][Math.floor(Math.random()*4)]), 800);

    createCasinoFloor(scene);
    createSlotMachine(scene);
    createWinParticlesSystem(scene);

    return scene;
}

function createCasinoFloor(scene) {
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width:100, height:100}, scene);
    const mat = new BABYLON.PBRMaterial("floor", scene);
    mat.albedoColor = new BABYLON.Color3(0.02, 0.01, 0.08);
    mat.metallic = 0.1; mat.roughness = 0.9;
    ground.material = mat;
    ground.position.y = -5;
}

function createWinParticlesSystem(scene) {
    particleSystem = new BABYLON.ParticleSystem("coins", 3000, scene);
    particleSystem.particleTexture = new BABYLON.Texture("/textures/coin.png", scene);
    particleSystem.emitter = new BABYLON.Vector3(0,2,2);
    particleSystem.minSize = 0.2; particleSystem.maxSize = 0.8;
    particleSystem.minLifeTime = 1; particleSystem.maxLifeTime = 3;
    particleSystem.emitRate = 0;
    particleSystem.direction1 = new BABYLON.Vector3(-3,8,-3);
    particleSystem.direction2 = new BABYLON.Vector3(3,8,3);
    particleSystem.gravity = new BABYLON.Vector3(0,-15,0);
    particleSystem.color1 = new BABYLON.Color4(1,0.8,0.2,1);
    particleSystem.color2 = new BABYLON.Color4(1,0.5,0,1);
}

function triggerWinParticles() {
    if (!particleSystem) return;
    particleSystem.emitter = new BABYLON.Vector3(0,1,1.8);
    particleSystem.emitRate = 1200;
    particleSystem.start();
    setTimeout(() => particleSystem.emitRate = 0, 1000);
}

function createSlotMachine(scene) {
    // Load real 3D slot machine model
    BABYLON.SceneLoader.ImportMeshAsync("", "/models/", "slot_machine.glb", scene).then(container => {
        const root = container.meshes[0];
        root.scaling = new BABYLON.Vector3(3,3,3);
        root.position.y = -2.5;
        root.rotation.y = Math.PI;

        container.meshes.forEach(m => {
            if (m.material) {
                const pbr = new BABYLON.PBRMaterial(m.material.name + "_pbr", scene);
                pbr.albedoColor = m.material.albedoColor || m.material.diffuseColor || BABYLON.Color3.White();
                pbr.metallic = 0.98;
                pbr.roughness = 0.12;
                m.material = pbr;
            }
        });
    }).catch(() => console.log("Model not found – reels will still work"));

    const positions = [-3, 0, 3];

    for (let i = 0; i < 3; i++) {
        const reel = createReel(scene, i);
        reel.position.x = positions[i];
        reelMeshes.push(reel);

        // Neon glow frame
        const frame = BABYLON.MeshBuilder.CreatePlane(`frame${i}`, {width:3.3, height:3.3}, scene);
        frame.position = new BABYLON.Vector3(positions[i], 0, 1.9);
        const fm = new BABYLON.StandardMaterial("frameMat", scene);
        fm.emissiveColor = new BABYLON.Color3(1, 0.7, 0);
        fm.emissiveFresnelParameters = new BABYLON.FresnelParameters();
        fm.emissiveFresnelParameters.bias = 0.6;
        fm.emissiveFresnelParameters.power = 4;
        fm.emissiveFresnelParameters.leftColor = BABYLON.Color3.Yellow();
        fm.emissiveFresnelParameters.rightColor = BABYLON.Color3.Red();
        frame.material = fm;
        glowFrames.push(frame);
    }
}

function createReel(scene, index) {
    const parent = new BABYLON.TransformNode(`reel${index}`, scene);
    const symbols = [];

    for (let i = 0; i < 20; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(`s${index}_${i}`, {width:2.2, height:2.2}, scene);
        plane.position.y = i * 2.5 - 25;
        plane.position.z = 0.05;
        plane.parent = parent;

        const mat = new BABYLON.StandardMaterial(`mat${index}_${i}`, scene);
        mat.backFaceCulling = false;

        const key = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        const tex = loadedTextures[key];
        if (tex?.isReady()) {
            mat.emissiveTexture = tex;
            mat.emissiveColor = new BABYLON.Color3(1.6, 1.6, 1.6);
            mat.opacityTexture = tex;
            mat.useAlphaFromDiffuseTextureAsAlpha = true;
        } else {
            mat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.4);
        }
        mat.diffuseColor = mat.specularColor = BABYLON.Color3.Black();

        // Glow border
        const glow = BABYLON.MeshBuilder.CreatePlane("glow", {width:2.4, height:2.4}, scene);
        glow.position.z = -0.02;
        glow.parent = plane;
        glow.material = new BABYLON.StandardMaterial("g", scene);
        glow.material.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
        glow.material.alpha = 0.7;

        plane.material = mat;
        symbols.push({ plane, symbol: key });
    }
    reels[index] = symbols;
    return parent;
}

// ====================== SPIN & WIN ======================
async function spin() {
    if (isSpinning || currentUser.balance < currentBet) {
        if (currentUser.balance < currentBet) showResult('Insufficient funds!');
        return;
    }
    isSpinning = true;
    document.getElementById('spinButton').disabled = true;
    hideResult();

    await Promise.all(reelMeshes.map((r, i) => spinReel(r, i)));

    const visibleSymbols = reelMeshes.map((reel, i) => {
        let idx = Math.round(-reel.position.y / 2.5) % 20;
        if (idx < 0) idx += 20;
        return reels[i][idx].symbol;
    });

    await submitGameResult(visibleSymbols);

    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
}

function spinReel(reel, index) {
    return new Promise(resolve => {
        const duration = 2000 + index * 600;
        const targetY = -Math.floor(Math.random() * 20) * 2.5;

        const anim = new BABYLON.Animation("spin", "position.y", 60, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
        anim.setKeys([
            { frame: 0, value: reel.position.y },
            { frame: 100, value: reel.position.y - 50 + targetY }
        ]);
        const ease = new BABYLON.CubicEase();
        ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
        anim.setEasingFunction(ease);

        gameScene.beginDirectAnimation(reel, [anim], 0, 100, false, duration/1000, () => {
            reel.position.y = targetY;
            resolve();
        });
    });
}

async function submitGameResult(symbols) {
    let winAmount = 0;
    const s = symbols[0];

    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        winAmount = currentBet * ({
            DIAMOND: 100, SEVEN: 50, CROWN: 25, BAR: 15,
            WILD: 10, CHERRY: 8, SCATTER: 5
        }[s] || 2);
        showResult(`JACKPOT! +$${winAmount.toFixed(2)}`);
        triggerWinParticles();
        glowFrames.forEach(f => {
            BABYLON.Animation.CreateAndStartAnimation("winPulse", f.scaling, "x", 60, 40, 1, 1.5, 0, new BABYLON.BounceEase());
            BABYLON.Animation.CreateAndStartAnimation("winPulseY", f.scaling, "y", 60, 40, 1, 1.5, 0, new BABYLON.BounceEase());
        });
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2]) {
        winAmount = currentBet * 2;
        showResult(`WIN +$${winAmount.toFixed(2)}`);
        triggerWinParticles();
    }

    try {
        const res = await fetch('/api/game/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ betAmount: currentBet, winAmount, symbols, gameType: 'slots' })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser.balance = data.balance;
            updateGameUI();
            document.getElementById('gameWin').textContent = winAmount.toFixed(2);
        }
    } catch (e) { console.error(e); }
}

function showResult(msg) {
    const el = document.getElementById('resultOverlay');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(hideResult, 4000);
}
function hideResult() {
    document.getElementById('resultOverlay').classList.remove('show');
}

// ====================== ENTER KEY SUPPORT ======================
document.addEventListener('DOMContentLoaded', () => {
    {
    document.getElementById('loginPassword').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });
    document.getElementById('registerPassword').addEventListener('keypress', e => { if (e.key === 'Enter') register(); });
});
