// ===============================================
//  game.js – Beautiful 3D Slot Machine (EMOJI FIX)
//  Symbols are now displayed using Babylon.js GUI and emojis.
// ===============================================

let currentUser = null;
let gameEngine = null;
let gameScene = null;
let isSpinning = false;
let currentBet = 10;
let reels = [];
let reelMeshes = [];
// REMOVED: loadedTextures = {};
let particleSystem = null;
let glowFrames = [];
let spotLightInterval = null;

const symbolKeys = ['BAR', 'CHERRY', 'CROWN', 'DIAMOND', 'FREE_SPIN', 'SCATTER', 'SEVEN', 'WILD'];
// CHANGED: Use a map to store the actual emoji symbols
const symbolEmojiMap = {
    BAR: '🍒', // Cherry is often used as a common symbol
    CHERRY: '🔔',
    CROWN: '👑',
    DIAMOND: '💎',
    FREE_SPIN: '⭐',
    SCATTER: '💰',
    SEVEN: '7️⃣',
    WILD: '⭐' // Used WILD for the star/wild symbol
};

// ====================== AUTH ======================
// (Authentication functions remain unchanged)
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
    } catch (e) {
        console.error('Jackpot load failed:', e);
    }
}

function animateValue(id, start, end, duration) {
    const el = document.getElementById(id);
    const range = end - start;
    let current = start;
    const increment = range !== 0 ? range / (duration / 16) : 0; 

    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end) || increment === 0) {
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
    if (isNaN(amount) || amount <= 0) return showFundsError('Enter valid amount');
    try {
        const res = await fetch('/api/funds/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser.balance = data.balance;
            updateBalance();
            closeFundsModal();
        } else {
            showFundsError(data.error || 'Failed');
        }
    } catch (e) {
        showFundsError('Network error');
    }
}

async function withdrawFunds() {
    const amount = parseFloat(document.getElementById('fundsAmount').value);
    if (isNaN(amount) || amount <= 0) return showFundsError('Enter valid amount');
    try {
        const res = await fetch('/api/funds/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser.balance = data.balance;
            updateBalance();
            closeFundsModal();
        } else {
            showFundsError(data.error || 'Failed');
        }
    } catch (e) {
        showFundsError('Network error');
    }
}

function showFundsError(msg) {
    const el = document.getElementById('fundsError');
    el.textContent = msg;
    el.classList.remove('hidden');
}

// ====================== GAME NAV ======================
function playGame() {
    document.getElementById('lobbyContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    
    if (gameEngine) {
        if (gameScene) gameScene.dispose();
        gameScene = null;
        reels = [];
        reelMeshes = [];
        glowFrames = [];
        if (spotLightInterval) {
            clearInterval(spotLightInterval);
            spotLightInterval = null;
        }
    }
    
    if (!gameEngine) initGame();
    updateGameUI();
}

function backToLobby() {
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('lobbyContainer').style.display = 'block';
    fetch('/api/user')
        .then(r => r.json())
        .then(d => {
            currentUser = d;
            updateBalance();
        });
}

function updateGameUI() {
    document.getElementById('gameBalance').textContent = currentUser.balance.toFixed(2);
    document.getElementById('gameBet').textContent = currentBet.toFixed(2);
    document.getElementById('betDisplay').textContent = currentBet.toFixed(2);
}

function changeBet(delta) {
    currentBet = Math.max(5, Math.min(currentUser.balance, currentBet + delta));
    updateGameUI();
}

// ====================== BABYLON.JS SETUP ======================
// REMOVED: preloadTextures function is no longer needed

function initGame() {
    const canvas = document.getElementById('renderCanvas');
    gameEngine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

    // Since we don't need to wait for textures, we initialize the scene directly
    gameScene = createScene();
    gameEngine.runRenderLoop(() => gameScene.render());
    window.addEventListener('resize', () => gameEngine.resize());
}

function createScene() {
    const scene = new BABYLON.Scene(gameEngine);
    scene.clearColor = new BABYLON.Color4(0.02, 0, 0.05, 1);
    
    // Create the AdvancedDynamicTexture overlay once for the entire scene
    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
        BABYLON.MeshBuilder.CreatePlane("adt_anchor", { size: 10 }, scene), 
        1024, 
        1024, 
        true
    );
    advancedTexture.rootContainer.name = "ADTRoot";
    advancedTexture.scale(0.1); // Scale down the ADT so text isn't massive

    // HDR Environment (falls back gracefully if missing)
    try {
        const hdr = BABYLON.CubeTexture.CreateFromPrefilteredData("/env/casino.env", scene);
        scene.environmentTexture = hdr;
        scene.environmentIntensity = 1.4;
    } catch (e) {
        console.log("HDR env missing – using default lighting");
    }

    const camera = new BABYLON.ArcRotateCamera("cam", Math.PI / 2, Math.PI / 2.8, 18, BABYLON.Vector3.Zero(), scene);
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 25;
    camera.attachControl(document.getElementById('renderCanvas'), true);

    new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.6;

    const spot = new BABYLON.SpotLight("spot", new BABYLON.Vector3(0,15,-10), new BABYLON.Vector3(0,-1,0.5), Math.PI/2.5, 10, scene);
    spot.intensity = 2;
    
    spotLightInterval = setInterval(() => {
        const colors = ["#ff0080","#00ffff","#ffff00","#ff00ff"];
        spot.diffuse = BABYLON.Color3.FromHex(colors[Math.floor(Math.random()*colors.length)]);
    }, 800);

    createCasinoFloor(scene);
    createSlotMachine(scene, advancedTexture); // Pass the texture to be used for symbols
    createWinParticlesSystem(scene);

    return scene;
}

function createCasinoFloor(scene) {
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    const mat = new BABYLON.PBRMaterial("floorMat", scene);
    mat.albedoColor = new BABYLON.Color3(0.02, 0.01, 0.08);
    mat.metallic = 0.1;
    mat.roughness = 0.9;
    ground.material = mat;
    ground.position.y = -5;
}

function createWinParticlesSystem(scene) {
    try {
        particleSystem = new BABYLON.ParticleSystem("coins", 3000, scene);
        particleSystem.particleTexture = new BABYLON.Texture("/textures/coin.png", scene);
    } catch (e) {
        console.log("Coin texture missing – particles disabled");
        return;
    }
    particleSystem.emitter = new BABYLON.Vector3(0, 2, 2);
    particleSystem.minSize = 0.2;
    particleSystem.maxSize = 0.8;
    particleSystem.minLifeTime = 1;
    particleSystem.maxLifeTime = 3;
    particleSystem.emitRate = 0;
    particleSystem.direction1 = new BABYLON.Vector3(-3, 8, -3);
    particleSystem.direction2 = new BABYLON.Vector3(3, 8, 3);
    particleSystem.gravity = new BABYLON.Vector3(0, -15, 0);
    particleSystem.color1 = new BABYLON.Color4(1, 0.8, 0.2, 1);
    particleSystem.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
}

function triggerWinParticles() {
    if (!particleSystem) return;
    particleSystem.emitter = new BABYLON.Vector3(0, 1, 1.8);
    particleSystem.emitRate = 1200;
    particleSystem.start();
    setTimeout(() => { particleSystem.emitRate = 0; }, 1000);
}

// CHANGED: Accept the advancedTexture
function createSlotMachine(scene, advancedTexture) {
    // Optional 3D model (graceful fallback)
    BABYLON.SceneLoader.ImportMeshAsync("", "/models/", "slot_machine.glb", scene).then((container) => {
        const root = container.meshes[0];
        root.scaling = new BABYLON.Vector3(3, 3, 3);
        root.position.y = -2.5;
        root.rotation.y = Math.PI;

        container.meshes.forEach(m => {
            if (m.material) {
                if (!(m.material instanceof BABYLON.PBRMaterial)) {
                    const pbr = new BABYLON.PBRMaterial(m.material.name + "_pbr", scene);
                    pbr.albedoColor = m.material.albedoColor || m.material.diffuseColor || BABYLON.Color3.White();
                    pbr.metallic = 0.98;
                    pbr.roughness = 0.12;
                    m.material = pbr;
                } else {
                    m.material.metallic = 0.98;
                    m.material.roughness = 0.12;
                }
            }
        });
    }).catch(() => console.log("3D model missing – using reels only"));

    const positions = [-3, 0, 3];

    for (let i = 0; i < 3; i++) {
        // CHANGED: Pass the advancedTexture to createReel
        const reel = createReel(scene, i, advancedTexture); 
        reel.position.x = positions[i];
        reelMeshes.push(reel);

        // Glowing frame (unchanged)
        const frame = BABYLON.MeshBuilder.CreatePlane(`frame${i}`, { width: 3.3, height: 3.3 }, scene);
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

// CHANGED: Accept advancedTexture
function createReel(scene, index, advancedTexture) {
    const parent = new BABYLON.TransformNode(`reel${index}`, scene);
    const symbols = [];

    for (let i = 0; i < 20; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(`sym${index}_${i}`, { width: 2.2, height: 2.2 }, scene);
        plane.position.y = i * 2.5 - 25;
        plane.position.z = 0.05;
        plane.parent = parent;

        // NEW: Material is now simple and dark (no texture/transparency logic needed)
        const mat = new BABYLON.StandardMaterial(`mat${index}_${i}`, scene);
        mat.backFaceCulling = false;
        mat.diffuseColor = BABYLON.Color3.FromHexString("#2e323e"); // Dark gray/blue for the symbol background
        mat.specularColor = BABYLON.Color3.Black();
        mat.emissiveColor = BABYLON.Color3.FromHexString("#444b61"); // Slight internal glow
        plane.material = mat;

        const key = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        const emoji = symbolEmojiMap[key];

        // NEW: Create an overlay to display the emoji
        const textBlock = new BABYLON.GUI.TextBlock();
        textBlock.text = emoji;
        textBlock.color = "white";
        textBlock.fontSize = 150; // Large size for visibility
        advancedTexture.addControl(textBlock);

        // Link the text block to the plane's position
        textBlock.linkWithMesh(plane);
        
        // Offset the emoji slightly in front of the reel plane
        textBlock.linkOffsetX = 0;
        textBlock.linkOffsetY = 0;
        
        // This makes sure the emoji always faces the camera
        plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL; 

        // Glow rim (unchanged)
        const glow = BABYLON.MeshBuilder.CreatePlane("glow", { width: 2.4, height: 2.4 }, scene);
        glow.position.z = -0.02;
        glow.parent = plane;
        const gm = new BABYLON.StandardMaterial("glowMat", scene);
        gm.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
        gm.alpha = 0.7;
        glow.material = gm;

        symbols.push({ plane, symbol: key, textBlock }); // Store the textBlock for potential future updates
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

    await Promise.all(reelMeshes.map((reel, i) => spinReel(reel, i)));

    const visibleSymbols = reelMeshes.map((reel, i) => {
        let idx = Math.round(-reel.position.y / 2.5) % 20;
        if (idx < 0) idx += 20;
        return reels[i][idx] ? reels[i][idx].symbol : symbolKeys[0]; 
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

        const animatable = gameScene.beginDirectAnimation(reel, [anim], 0, 100, false, duration / 1000, () => {
            reel.position.y = targetY;
            if (animatable) animatable.stop(); 
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
            const bounceEase = new BABYLON.BounceEase();
            bounceEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

            BABYLON.Animation.CreateAndStartAnimation("pulseX", f, "scaling.x", 
                60, 
                40, 
                1, 
                1.5, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, 
                bounceEase); 
                
            BABYLON.Animation.CreateAndStartAnimation("pulseY", f, "scaling.y", 
                60, 
                40, 
                1, 
                1.5, 
                BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE, 
                bounceEase);
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
    } catch (e) {
        console.error("Result submit failed:", e);
    }
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

// ====================== BOOTSTRAP ======================
(function bootstrap() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        console.log("🎰 Game JS loaded successfully!"); 

        const loginBtn = document.getElementById('loginButton'); 
        if (loginBtn) loginBtn.addEventListener('click', login);

        const registerBtn = document.getElementById('registerButton');
        if (registerBtn) registerBtn.addEventListener('click', showRegister);
        
        document.getElementById('loginPassword')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') login();
        });
        document.getElementById('registerPassword')?.addEventListener('keypress', e => {
            if (e.key === 'Enter') register();
        });

        window.login = login;
        window.showRegister = showRegister;
        window.register = register;
        window.playGame = playGame;
    }
})();
