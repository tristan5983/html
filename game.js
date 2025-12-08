// Game state
let currentUser = null;
let gameEngine = null;
let gameScene = null;
let isSpinning = false;
let currentBet = 10;
let reels = [];
let reelMeshes = [];

// Global variable to hold the promise of loaded textures
let textureLoadPromise = null;

// *** Symbols now map to actual file names ***
const symbolKeys = ['BAR', 'CHERRY', 'CROWN', 'DIAMOND', 'FREE_SPIN', 'SCATTER', 'SEVEN', 'WILD'];
const symbolImageMap = {
    'BAR': { key: 'BAR', path: '/images/bar.png' },
    'CHERRY': { key: 'CHERRY', path: '/images/cherry.png' },
    'CROWN': { key: 'CROWN', path: '/images/crown.png' },
    'DIAMOND': { key: 'DIAMOND', path: '/images/diamond.png' },
    'FREE_SPIN': { key: 'FREE_SPIN', path: '/images/free_spin.png' },
    'SCATTER': { key: 'SCATTER', path: '/images/scatter.png' },
    'SEVEN': { key: 'SEVEN', path: '/images/seven.png' },
    'WILD': { key: 'WILD', path: '/images/wild.png' }
};

// --- PRELOAD FUNCTION ---
// Loads all textures and returns a promise that resolves with the loaded texture map
function preloadTextures(scene) {
    const texturePromises = [];
    const loadedTextures = {};

    for (const key in symbolImageMap) {
        const data = symbolImageMap[key];
        
        // Create the texture
        const texture = new BABYLON.Texture(data.path, scene, 
            false, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        
        loadedTextures[key] = texture;
        
        // Push the promise that resolves when the texture is ready
        texturePromises.push(new Promise((resolve, reject) => {
            texture.onLoadObservable.add(() => resolve());
            texture.onErrorObservable.add((error) => {
                console.error(`Failed to load texture: ${data.path}`, error);
                reject(error);
            });
        }));
    }
    
    // Return the promise that waits for ALL textures
    return Promise.all(texturePromises).then(() => loadedTextures);
}


// Auth functions
async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showLobby();
            loadJackpot();
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Login failed. Please try again.');
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            showLobby();
            loadJackpot();
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError('Registration failed. Please try again.');
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
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    clearError();
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
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
    }
}

async function loadJackpot() {
    try {
        const response = await fetch('/api/jackpot');
        const data = await response.json();
        document.getElementById('jackpotAmount').textContent = data.amount.toFixed(2);
        
        // Animate jackpot increase
        setInterval(async () => {
            const response = await fetch('/api/jackpot');
            const data = await response.json();
            animateValue('jackpotAmount', parseFloat(document.getElementById('jackpotAmount').textContent), data.amount, 1000);
        }, 5000);
    } catch (error) {
        console.error('Failed to load jackpot:', error);
    }
}

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = current.toFixed(2);
    }, 16);
}

// Funds management
function showFundsModal() {
    document.getElementById('fundsModal').classList.add('show');
    document.getElementById('fundsAmount').value = '';
    document.getElementById('fundsError').classList.add('hidden');
}

function closeFundsModal() {
    document.getElementById('fundsModal').classList.remove('show');
}

async function addFunds() {
    const amount = parseFloat(document.getElementById('fundsAmount').value);
    
    if (!amount || amount <= 0) {
        showFundsError('Please enter a valid amount');
        return;
    }
    
    try {
        const response = await fetch('/api/funds/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.balance = data.balance;
            updateBalance();
            closeFundsModal();
        } else {
            showFundsError(data.error);
        }
    } catch (error) {
        showFundsError('Failed to add funds');
    }
}

async function withdrawFunds() {
    const amount = parseFloat(document.getElementById('fundsAmount').value);
    
    if (!amount || amount <= 0) {
        showFundsError('Please enter a valid amount');
        return;
    }
    
    try {
        const response = await fetch('/api/funds/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.balance = data.balance;
            updateBalance();
            closeFundsModal();
        } else {
            showFundsError(data.error);
        }
    } catch (error) {
        showFundsError('Failed to withdraw funds');
    }
}

function showFundsError(message) {
    const errorEl = document.getElementById('fundsError');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
}

// Game functions
function playGame(gameType) {
    document.getElementById('lobbyContainer').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'block';
    
    if (!gameEngine) {
        initGame();
    }
    
    updateGameUI();
}

function backToLobby() {
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('lobbyContainer').style.display = 'block';
    
    // Refresh user data
    fetch('/api/user')
        .then(res => res.json())
        .then(data => {
            currentUser = data;
            updateBalance();
        });
}

// --- INIT GAME FUNCTION (UPDATED TO AWAIT TEXTURES) ---
function initGame() {
    const canvas = document.getElementById('renderCanvas');
    gameEngine = new BABYLON.Engine(canvas, true);
    
    // A. Start loading textures immediately on a temporary scene
    textureLoadPromise = preloadTextures(new BABYLON.Scene(gameEngine));

    textureLoadPromise.then((loadedTextures) => {
        // B. Once textures are ready, create the scene
        gameScene = createScene(canvas, loadedTextures); 
        
        // C. Start the render loop
        gameEngine.runRenderLoop(() => {
            gameScene.render();
        });
        
        window.addEventListener('resize', () => {
            gameEngine.resize();
        });

    }).catch(error => {
        // D. Handle a critical error if textures fail to load
        console.error("Critical error: One or more textures failed to load.", error);
        showError("Game assets failed to load. Please refresh.");
    });
}

// --- CREATE SCENE FUNCTION (UPDATED SIGNATURE) ---
function createScene(canvas, loadedTextures) {
    const scene = new BABYLON.Scene(gameEngine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
    
    const camera = new BABYLON.ArcRotateCamera("camera", 
        Math.PI / 2, Math.PI / 2.5, 15, 
        new BABYLON.Vector3(0, 0, 0), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 20;
    
    const light = new BABYLON.HemisphericLight("light", 
        new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    const spotLight = new BABYLON.SpotLight("spotLight",
        new BABYLON.Vector3(0, 10, 0),
        new BABYLON.Vector3(0, -1, 0),
        Math.PI / 3, 2, scene);
    spotLight.intensity = 1.5;
    
    createSlotMachine(scene, loadedTextures);
    createEnvironment(scene);
    
    return scene;
}

// --- CREATE SLOT MACHINE FUNCTION (UPDATED SIGNATURE) ---
function createSlotMachine(scene, loadedTextures) {
    const machineMat = new BABYLON.StandardMaterial("machineMat", scene);
    machineMat.diffuseColor = new BABYLON.Color3(0.8, 0.1, 0.2);
    machineMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    
    const body = BABYLON.MeshBuilder.CreateBox("body", 
        {width: 10, height: 8, depth: 3}, scene);
    body.material = machineMat;
    body.position.y = 0;
    
    const top = BABYLON.MeshBuilder.CreateBox("top", 
        {width: 10, height: 1, depth: 3}, scene);
    top.material = machineMat;
    top.position.y = 4.5;
    
    // Performance Hint: Freeze Static Meshes
    body.freezeWorldMatrix();
    top.freezeWorldMatrix();
    
    const positions = [-3, 0, 3];
    
    for (let i = 0; i < 3; i++) {
        const reelContainer = BABYLON.MeshBuilder.CreateBox(`reelContainer${i}`, 
            {width: 2.5, height: 6, depth: 0.3}, scene);
        reelContainer.position = new BABYLON.Vector3(positions[i], 0, 1.6);
        
        const reelMat = new BABYLON.StandardMaterial(`reelMat${i}`, scene);
        reelMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.15);
        reelMat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        reelContainer.material = reelMat;
        reelContainer.freezeWorldMatrix(); 
        
        const reel = createReel(scene, i, loadedTextures);
        reel.position = new BABYLON.Vector3(positions[i], 0, 1.8);
        reelMeshes.push(reel);
        
        // The visible yellow frame (payline indicator)
        const frame = BABYLON.MeshBuilder.CreateBox(`frame${i}`, 
            {width: 2.8, height: 2.5, depth: 0.1}, scene);
        frame.position = new BABYLON.Vector3(positions[i], 0, 1.9);
        const frameMat = new BABYLON.StandardMaterial(`frameMat${i}`, scene);
        frameMat.diffuseColor = new BABYLON.Color3(1, 0.84, 0); // Yellow
        frameMat.specularColor = new BABYLON.Color3(1, 1, 1);
        frame.material = frameMat;
        frame.freezeWorldMatrix();
    }
}

// --- CREATE REEL FUNCTION (UPDATED TO USE PRE-LOADED TEXTURES) ---
function createReel(scene, index, loadedTextures) {
    const symbolTexts = [];
    const parent = new BABYLON.TransformNode(`reel${index}`, scene);
    
    // No texture loading needed here; we use the loadedTextures map
    
    for (let i = 0; i < 20; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(`symbol${index}_${i}`, 
            {width: 2, height: 2}, scene);
        
        // Z-Position adjustment to ensure symbol plane (z=1.95) renders 
        // in front of the yellow frame (z=1.9)
        plane.position = new BABYLON.Vector3(0, i * 2.5 - 25, 0.15); 
        plane.parent = parent;
        
        const mat = new BABYLON.StandardMaterial(`symbolMat${index}_${i}`, scene);
        
        // Choose a random symbol key and USE its texture from the pre-loaded map
        const symbolKey = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        const texture = loadedTextures[symbolKey];

        // Material settings for Emissive Texture and Visibility
        mat.backFaceCulling = false;
        mat.hasAlpha = true;         
        
        // Use the texture as the EMISSIVE map for brightness
        mat.emissiveTexture = texture; 
        
        // Ensure ALL lighting properties are black to prevent white noise/specular highlights
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1); 
        mat.diffuseColor = new BABYLON.Color3(0, 0, 0); 
        mat.specularColor = new BABYLON.Color3(0, 0, 0); 
        mat.ambientColor = new BABYLON.Color3(0, 0, 0); 
        
        plane.material = mat;
        
        symbolTexts.push({plane, symbol: symbolKey, texture});
    }
    
    reels[index] = symbolTexts;
    return parent;
}

function createEnvironment(scene) {
    const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
    groundMat.diffuseColor = new BABYLON.Color3(0.1, 0.05, 0.15);
    groundMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    
    const ground = BABYLON.MeshBuilder.CreateGround("ground", 
        {width: 50, height: 50}, scene);
    ground.material = groundMat;
    ground.position.y = -4;
    ground.freezeWorldMatrix();
}

function updateGameUI() {
    document.getElementById('gameBalance').textContent = currentUser.balance.toFixed(2);
    document.getElementById('gameBet').textContent = currentBet.toFixed(2);
    document.getElementById('betDisplay').textContent = currentBet.toFixed(2);
    
    fetch('/api/jackpot')
        .then(res => res.json())
        .then(data => {
            document.getElementById('gameJackpot').textContent = data.amount.toFixed(2);
        });
}

function changeBet(amount) {
    currentBet = Math.max(5, Math.min(currentUser.balance, currentBet + amount));
    document.getElementById('gameBet').textContent = currentBet.toFixed(2);
    document.getElementById('betDisplay').textContent = currentBet.toFixed(2);
}

async function spin() {
    if (isSpinning || currentUser.balance < currentBet) {
        if (currentUser.balance < currentBet) {
            showResult('Insufficient funds!');
        }
        return;
    }
    
    isSpinning = true;
    document.getElementById('spinButton').disabled = true;
    hideResult();
    
    const spinPromises = reelMeshes.map((reel, i) => {
        return spinReel(reel, i);
    });
    
    await Promise.all(spinPromises);
    
    const visibleSymbols = reelMeshes.map(reel => {
        // Calculate the symbol index that landed on the payline (center of the view)
        let rawIndex = -reel.position.y / 2.5;
        let index = Math.round(rawIndex) % 20;
        if (index < 0) index += 20; 
        return reels[reelMeshes.indexOf(reel)][index].symbol;
    });
    
    await submitGameResult(visibleSymbols);
    
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
}

// --- SPIN REEL FUNCTION (FIXED ANIMATION CLEANUP) ---
function spinReel(reel, index) {
    return new Promise((resolve) => {
        const animationName = `reelSpinAnim${index}`;
        const duration = 2000 + index * 500; // Staggered stop time
        const startY = reel.position.y;
        
        // Total distance to cover during the animation
        const reelHeight = 20 * 2.5; 
        const cycles = 4; 
        
        // Find the precise stopping position for a random symbol
        const finalSymbolIndex = Math.floor(Math.random() * 20); 
        const targetY = -finalSymbolIndex * 2.5; // Final Y position for the winning symbol

        // Calculate the required final position to land perfectly after the full cycles
        const finalPositionTarget = startY - (cycles * reelHeight) + (startY % reelHeight) + targetY;
        
        // Use Babylon.js Easing for Realistic Stop
        const reelAnimation = new BABYLON.Animation(
            animationName, 
            "position.y", 
            60, // frames per second
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keys = [
            { frame: 0, value: startY },
            { frame: 100, value: finalPositionTarget }
        ];

        reelAnimation.setKeys(keys);

        // Cubic Ease Out provides a smooth deceleration
        const easing = new BABYLON.CubicEase();
        easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
        reelAnimation.setEasingFunction(easing);

        // Start the animation and get the Animatable object
        const animatable = gameScene.beginDirectAnimation(reel, [reelAnimation], 0, 100, false, duration / 100, () => {
            
            reel.position.y = targetY; // Ensure snap to the *exact* final position
            
            // Explicitly end and dispose of the animatable
            animatable.dispose(); 
            
            resolve();
        });
    });
}

async function submitGameResult(symbols) {
    let winAmount = 0;
    
    // The switch statement now uses your string symbol keys
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        const symbol = symbols[0];
        switch(symbol) {
            case 'DIAMOND': winAmount = currentBet * 100; break;
            case 'SEVEN': winAmount = currentBet * 50; break;
            case 'CROWN': winAmount = currentBet * 25; break;
            case 'BAR': winAmount = currentBet * 15; break;
            case 'WILD': winAmount = currentBet * 10; break;
            case 'CHERRY': winAmount = currentBet * 8; break;
            case 'SCATTER': winAmount = currentBet * 5; break;
            default: winAmount = currentBet * 2; break; 
        }
        showResult(`🎉 JACKPOT! +$${winAmount.toFixed(2)} 🎉`);
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2]) {
        winAmount = currentBet * 2;
        showResult(`✨ WIN! +$${winAmount.toFixed(2)} ✨`);
    }
    
    try {
        const response = await fetch('/api/game/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                betAmount: currentBet,
                winAmount: winAmount,
                symbols: symbols,
                gameType: 'slots'
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.balance = data.balance;
            updateGameUI();
            document.getElementById('gameWin').textContent = winAmount.toFixed(2);
            
            if (data.jackpot) {
                animateValue('gameJackpot', parseFloat(document.getElementById('gameJackpot').textContent), data.jackpot, 500);
            }
        }
    } catch (error) {
        console.error('Failed to submit game result:', error);
    }
}

function showResult(message) {
    const resultEl = document.getElementById('resultOverlay');
    resultEl.textContent = message;
    resultEl.classList.add('show');
    
    setTimeout(() => {
        hideResult();
    }, 3000);
}

function hideResult() {
    document.getElementById('resultOverlay').classList.remove('show');
}

// Enter key handlers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('registerPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
});
