// Game state
let currentUser = null;
let gameEngine = null;
let gameScene = null;
let isSpinning = false;
let currentBet = 10;
let reels = [];
let reelMeshes = [];

// Updated symbols with image paths
const symbols = [
    { name: 'cherry', path: '/images/cherry.png', multiplier: 5 },
    { name: 'bar', path: '/images/bar.png', multiplier: 8 },
    { name: 'crown', path: '/images/crown.png', multiplier: 15 },
    { name: 'seven', path: '/images/seven.png', multiplier: 50 },
    { name: 'diamond', path: '/images/diamond.png', multiplier: 100 },
    { name: 'wild', path: '/images/wild.png', multiplier: 25 },
    { name: 'scatter', path: '/images/scatter.png', multiplier: 20 },
    { name: 'free_spin', path: '/images/free_spin.png', multiplier: 30 }
];

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
    
    fetch('/api/user')
        .then(res => res.json())
        .then(data => {
            currentUser = data;
            updateBalance();
        });
}

function initGame() {
    if (typeof BABYLON === 'undefined') {
        console.log('Waiting for Babylon.js to load...');
        setTimeout(initGame, 100);
        return;
    }
    
    const canvas = document.getElementById('renderCanvas');
    gameEngine = new BABYLON.Engine(canvas, true);
    gameScene = createScene();
    
    gameEngine.runRenderLoop(() => {
        gameScene.render();
    });
    
    window.addEventListener('resize', () => {
        gameEngine.resize();
    });
}

function createScene() {
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
    light.intensity = 0.8;
    
    const spotLight = new BABYLON.SpotLight("spotLight",
        new BABYLON.Vector3(0, 10, 0),
        new BABYLON.Vector3(0, -1, 0),
        Math.PI / 3, 2, scene);
    spotLight.intensity = 2;
    
    const dirLight = new BABYLON.DirectionalLight("dirLight",
        new BABYLON.Vector3(0, -1, 1), scene);
    dirLight.intensity = 0.5;
    
    createSlotMachine(scene);
    createEnvironment(scene);
    
    return scene;
}

function createSlotMachine(scene) {
    const machineMat = new BABYLON.StandardMaterial("machineMat", scene);
    machineMat.diffuseColor = new BABYLON.Color3(0.8, 0.1, 0.2);
    machineMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    machineMat.emissiveColor = new BABYLON.Color3(0.1, 0.01, 0.02);
    
    const body = BABYLON.MeshBuilder.CreateBox("body", 
        {width: 10, height: 8, depth: 3}, scene);
    body.material = machineMat;
    body.position.y = 0;
    
    const top = BABYLON.MeshBuilder.CreateBox("top", 
        {width: 10, height: 1, depth: 3}, scene);
    top.material = machineMat;
    top.position.y = 4.5;
    
    const positions = [-3, 0, 3];
    
    for (let i = 0; i < 3; i++) {
        const reelContainer = BABYLON.MeshBuilder.CreateBox(`reelContainer${i}`, 
            {width: 2.5, height: 6, depth: 0.3}, scene);
        reelContainer.position = new BABYLON.Vector3(positions[i], 0, 1.6);
        
        const reelMat = new BABYLON.StandardMaterial(`reelMat${i}`, scene);
        reelMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.1);
        reelMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.05);
        reelContainer.material = reelMat;
        
        const reel = createReel(scene, i);
        reel.position = new BABYLON.Vector3(positions[i], 0, 1.8);
        reelMeshes.push(reel);
        
        const frame = BABYLON.MeshBuilder.CreateBox(`frame${i}`, 
            {width: 2.8, height: 2.5, depth: 0.1}, scene);
        frame.position = new BABYLON.Vector3(positions[i], 0, 1.9);
        const frameMat = new BABYLON.StandardMaterial(`frameMat${i}`, scene);
        frameMat.diffuseColor = new BABYLON.Color3(1, 0.84, 0);
        frameMat.specularColor = new BABYLON.Color3(1, 1, 0.5);
        frameMat.emissiveColor = new BABYLON.Color3(0.3, 0.25, 0);
        frame.material = frameMat;
        
        const light1 = new BABYLON.PointLight(`reelLight${i}`, 
            new BABYLON.Vector3(positions[i], 2, 2), scene);
        light1.diffuse = new BABYLON.Color3(1, 0.84, 0);
        light1.intensity = 0.5;
    }
}

function createReel(scene, index) {
    const symbolMeshes = [];
    const parent = new BABYLON.TransformNode(`reel${index}`, scene);
    
    for (let i = 0; i < 20; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(`symbol${index}_${i}`, 
            {width: 2.2, height: 2.2}, scene);
        plane.position.y = i * 2.5 - 25;
        plane.parent = parent;
        
        const mat = new BABYLON.StandardMaterial(`symbolMat${index}_${i}`, scene);
        
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        
        const texture = new BABYLON.Texture(symbol.path, scene, false, true);
        texture.hasAlpha = true;
        mat.diffuseTexture = texture;
        mat.specularColor = new BABYLON.Color3(0, 0, 0);
        mat.emissiveColor = new BABYLON.Color3(0.4, 0.4, 0.4);
        mat.backFaceCulling = false;
        
        plane.material = mat;
        
        symbolMeshes.push({plane, symbol, texture});
    }
    
    reels[index] = symbolMeshes;
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
    
    const particleSystem = new BABYLON.ParticleSystem("particles", 200, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);
    particleSystem.emitter = new BABYLON.Vector3(0, 5, 0);
    particleSystem.minEmitBox = new BABYLON.Vector3(-10, 0, -5);
    particleSystem.maxEmitBox = new BABYLON.Vector3(10, 0, 5);
    particleSystem.color1 = new BABYLON.Color4(1, 0.84, 0, 0.3);
    particleSystem.color2 = new BABYLON.Color4(1, 0, 0.4, 0.3);
    particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    particleSystem.minSize = 0.05;
    particleSystem.maxSize = 0.15;
    particleSystem.minLifeTime = 2;
    particleSystem.maxLifeTime = 4;
    particleSystem.emitRate = 50;
    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    particleSystem.gravity = new BABYLON.Vector3(0, 1, 0);
    particleSystem.direction1 = new BABYLON.Vector3(-0.5, 1, -0.5);
    particleSystem.direction2 = new BABYLON.Vector3(0.5, 1, 0.5);
    particleSystem.minAngularSpeed = 0;
    particleSystem.maxAngularSpeed = Math.PI;
    particleSystem.minEmitPower = 0.5;
    particleSystem.maxEmitPower = 1;
    particleSystem.updateSpeed = 0.01;
    particleSystem.start();
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
    
    const visibleSymbols = reelMeshes.map((reel, idx) => {
        const index = Math.round(-reel.position.y / 2.5) % 20;
        const positiveIndex = ((index % 20) + 20) % 20;
        return reels[idx][positiveIndex].symbol;
    });
    
    await submitGameResult(visibleSymbols);
    
    isSpinning = false;
    document.getElementById('spinButton').disabled = false;
}

function spinReel(reel, index) {
    return new Promise((resolve) => {
        const duration = 2000 + index * 500;
        const rotations = 5 + index;
        const startY = reel.position.y;
        const distance = rotations * 2.5 * 20;
        
        const startTime = Date.now();
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            reel.position.y = startY - (distance * eased);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                const finalSymbolIndex = Math.floor(Math.random() * 20);
                reel.position.y = -finalSymbolIndex * 2.5;
                resolve();
            }
        }
        
        animate();
    });
}

async function submitGameResult(symbolObjs) {
    let winAmount = 0;
    
    if (!symbolObjs || symbolObjs.length !== 3 || !symbolObjs[0]) {
        console.error('Invalid symbols:', symbolObjs);
        isSpinning = false;
        document.getElementById('spinButton').disabled = false;
        return;
    }
    
    const symbolNames = symbolObjs.map(s => s.name);
    
    if (symbolObjs[0].name === symbolObjs[1].name && symbolObjs[1].name === symbolObjs[2].name) {
        winAmount = currentBet * symbolObjs[0].multiplier;
        showResult(`🎉 JACKPOT! ${symbolObjs[0].name.toUpperCase()}! +$${winAmount.toFixed(2)} 🎉`);
    } 
    else if (symbolObjs[0].name === symbolObjs[1].name || symbolObjs[1].name === symbolObjs[2].name) {
        winAmount = currentBet * 2;
        showResult(`✨ WIN! +$${winAmount.toFixed(2)} ✨`);
    }
    else if (symbolObjs.some(s => s.name === 'wild')) {
        winAmount = currentBet * 3;
        showResult(`🎰 WILD! +$${winAmount.toFixed(2)} 🎰`);
    }
    
    try {
        const response = await fetch('/api/game/result', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                betAmount: currentBet,
                winAmount: winAmount,
                symbols: symbolNames,
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

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('registerPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') register();
    });
});
