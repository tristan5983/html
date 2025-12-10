(function bootstrapGame() {
/* ============================================================
   Royal Casino - 3D Slot Machine (Texture-Based Final Version)
   ============================================================ */

let currentUser = null;
let gameEngine = null;
let gameScene = null;
let isSpinning = false;
let currentBet = 10;
let reels = [];
let reelMeshes = [];
let particleSystem = null;
let glowFrames = [];
let spotLightInterval = null;

// Slot symbols
const symbolKeys = [
    "BAR", "CHERRY", "CROWN", "DIAMOND",
    "FREE_SPIN", "SCATTER", "SEVEN", "WILD"
];

// Texture paths for each symbol
const symbolTextureMap = {
    BAR: "/textures/symbol_bar.png",
    CHERRY: "/textures/symbol_cherry.png",
    CROWN: "/textures/symbol_crown.png",
    DIAMOND: "/textures/symbol_diamond.png",
    FREE_SPIN: "/textures/symbol_freespin.png",
    SCATTER: "/textures/symbol_scatter.png",
    SEVEN: "/textures/symbol_seven.png",
    WILD: "/textures/symbol_wild.png"
};

/* ============================================================
   AUTH
   ============================================================ */

async function login() {
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!username || !password) return showError("Please fill in all fields");

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            showLobby();
            loadJackpot();
        } else showError(data.error || "Login failed");
    } catch {
        showError("Connection error");
    }
}

async function register() {
    const username = document.getElementById("registerUsername").value.trim();
    const password = document.getElementById("registerPassword").value;

    if (!username || !password) return showError("Please fill in all fields");

    try {
        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            showLobby();
            loadJackpot();
        } else showError(data.error || "Registration failed");
    } catch {
        showError("Connection error");
    }
}

async function logout() {
    await fetch("/api/logout", { method: "POST" });
    currentUser = null;
    location.reload();
}

function showLogin() {
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");
    clearError();
}

function showRegister() {
    document.getElementById("registerForm").classList.remove("hidden");
    document.getElementById("loginForm").classList.add("hidden");
    clearError();
}

function showError(msg) {
    const el = document.getElementById("errorMessage");
    el.textContent = msg;
    el.classList.remove("hidden");
}

function clearError() {
    document.getElementById("errorMessage").classList.add("hidden");
}

function showLobby() {
    document.getElementById("authContainer").style.display = "none";
    document.getElementById("lobbyContainer").style.display = "block";
    updateBalance();
}

function updateBalance() {
    if (!currentUser) return;
    document.getElementById("userBalance").textContent = currentUser.balance.toFixed(2);
    document.getElementById("gameBalance").textContent = currentUser.balance.toFixed(2);
}

/* ============================================================
   JACKPOT + FUNDS
   ============================================================ */

async function loadJackpot() {
    try {
        const res = await fetch("/api/jackpot");
        const data = await res.json();

        document.getElementById("jackpotAmount").textContent = data.amount.toFixed(2);
        document.getElementById("gameJackpot").textContent = data.amount.toFixed(2);

        setInterval(async () => {
            try {
                const r = await fetch("/api/jackpot");
                const d = await r.json();
                animateValue(
                    "jackpotAmount",
                    parseFloat(document.getElementById("jackpotAmount").textContent),
                    d.amount,
                    1000
                );
                animateValue(
                    "gameJackpot",
                    parseFloat(document.getElementById("gameJackpot").textContent),
                    d.amount,
                    1000
                );
            } catch (e) {
                console.error("Jackpot refresh failed:", e);
            }
        }, 5000);
    } catch (e) {
        console.error("Jackpot load failed:", e);
    }
}

function animateValue(id, start, end, duration) {
    const el = document.getElementById(id);
    const range = end - start;
    let current = start;
    const increment = range !== 0 ? range / (duration / 16) : 0;

    const timer = setInterval(() => {
        current += increment;
        if (
            (increment > 0 && current >= end) ||
            (increment < 0 && current <= end) ||
            increment === 0
        ) {
            current = end;
            clearInterval(timer);
        }
        el.textContent = current.toFixed(2);
    }, 16);
}

function showFundsModal() {
    document.getElementById("fundsModal").classList.add("show");
}

function closeFundsModal() {
    document.getElementById("fundsModal").classList.remove("show");
}

async function addFunds() {
    const amount = parseFloat(document.getElementById("fundsAmount").value);
    if (isNaN(amount) || amount <= 0) return showFundsError("Enter valid amount");

    try {
        const res = await fetch("/api/funds/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });

        const data = await res.json();
        if (res.ok) {
            currentUser.balance = data.balance;
            updateBalance();
            closeFundsModal();
        } else showFundsError(data.error || "Failed");
    } catch (e) {
        showFundsError("Network error");
    }
}

async function withdrawFunds() {
    const amount = parseFloat(document.getElementById("fundsAmount").value);
    if (isNaN(amount) || amount <= 0) return showFundsError("Enter valid amount");

    try {
        const res = await fetch("/api/funds/withdraw", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount })
        });

        const data = await res.json();
        if (res.ok) {
            currentUser.balance = data.balance;
            updateBalance();
        } else showFundsError(data.error || "Failed");
    } catch (e) {
        showFundsError("Network error");
    }
}

function showFundsError(msg) {
    const el = document.getElementById("fundsError");
    el.textContent = msg;
    el.classList.remove("hidden");
}

/* ============================================================
   GAME NAVIGATION
   ============================================================ */

function playGame() {
    document.getElementById("lobbyContainer").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";

    // Clean up previous scene if any
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
    document.getElementById("gameContainer").style.display = "none";
    document.getElementById("lobbyContainer").style.display = "block";

    fetch("/api/user")
        .then(r => r.json())
        .then(d => {
            currentUser = d;
            updateBalance();
        })
        .catch(e => console.error("Failed to refresh user:", e));
}

function updateGameUI() {
    if (!currentUser) return;
    document.getElementById("gameBalance").textContent = currentUser.balance.toFixed(2);
    document.getElementById("gameBet").textContent = currentBet.toFixed(2);
    document.getElementById("betDisplay").textContent = currentBet.toFixed(2);
}

function changeBet(delta) {
    if (!currentUser) return;
    currentBet = Math.max(5, Math.min(currentUser.balance, currentBet + delta));
    updateGameUI();
}

/* ============================================================
   BABYLON.JS SETUP
   ============================================================ */

function initGame() {
    const canvas = document.getElementById("renderCanvas");
    gameEngine = new BABYLON.Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true
    });

    gameScene = createScene();
    gameEngine.runRenderLoop(() => {
        if (gameScene) gameScene.render();
    });

    window.addEventListener("resize", () => gameEngine.resize());
}

function createScene() {
    const scene = new BABYLON.Scene(gameEngine);
    scene.clearColor = new BABYLON.Color4(0.02, 0, 0.05, 1);

    // HDR Environment (optional)
    try {
        const hdr = BABYLON.CubeTexture.CreateFromPrefilteredData("/env/casino.env", scene);
        scene.environmentTexture = hdr;
        scene.environmentIntensity = 1.4;
    } catch {
        console.log("HDR env missing – using default lighting");
    }

    const camera = new BABYLON.ArcRotateCamera(
        "cam",
        Math.PI / 2,
        Math.PI / 2.8,
        18,
        BABYLON.Vector3.Zero(),
        scene
    );
    camera.lowerRadiusLimit = 12;
    camera.upperRadiusLimit = 25;
    camera.attachControl(document.getElementById("renderCanvas"), true);

    const hemi = new BABYLON.HemisphericLight(
        "hemi",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    hemi.intensity = 0.6;

    const spot = new BABYLON.SpotLight(
        "spot",
        new BABYLON.Vector3(0, 15, -10),
        new BABYLON.Vector3(0, -1, 0.5),
        Math.PI / 2.5,
        10,
        scene
    );
    spot.intensity = 2;

    spotLightInterval = setInterval(() => {
        const colors = ["#ff0080", "#00ffff", "#ffff00", "#ff00ff"];
        spot.diffuse = BABYLON.Color3.FromHexString(
            colors[Math.floor(Math.random() * colors.length)]
        );
    }, 800);

    createCasinoFloor(scene);
    createSlotMachine(scene);
    createWinParticlesSystem(scene);
    
    // **********************************************
    // * NEW: Post-Processing Effects for Dramatic Look
    // **********************************************
    try {
        // 1. Glow Layer (for the frames and glowing materials)
        const glowLayer = new BABYLON.GlowLayer("glow", scene, { 
            mainTextureSamples: 3, 
            blurKernelSize: 64 
        });
        glowLayer.intensity = 0.5;

        // 2. Chromatic Aberration (subtle distortion effect)
        const chromaticAberration = new BABYLON.ChromaticAberrationPostProcess(
            "chromatic", 
            1.0, // Scale (1.0 is default)
            camera
        );
        // Subtle offset to create a chromatic effect
        chromaticAberration.red.x = -1.0; 
        chromaticAberration.green.x = -1.0;
        chromaticAberration.blue.x = -1.0;
        chromaticAberration.direction.x = 0;

        // 3. Bloom (makes bright areas brighter)
        const bloom = new BABYLON.BloomEffect.BloomRenderingPipeline(
            "bloomPipeline", 
            scene, 
            0.5 // Scale
        );
        bloom.bloomWeight = 0.7; 
        bloom.bloomThreshold = 0.5;

    } catch (e) {
        console.warn("Post-processing effects failed to load. Ensure babylonjs.postProcess.min.js is included.", e);
    }

    return scene;
}

function createCasinoFloor(scene) {
    const ground = BABYLON.MeshBuilder.CreateGround(
        "ground",
        { width: 100, height: 100 },
        scene
    );
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

    particleSystem.emitter = new BABYLON.Vector3(0, 1, 1.8);
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
    particleSystem.emitRate = 1200;
    particleSystem.start();
    setTimeout(() => {
        if (particleSystem) particleSystem.emitRate = 0;
    }, 1000);
}

/* ============================================================
   SLOT MACHINE (TEXTURE-BASED)
   ============================================================ */

function createReel(scene, index) {
    const parent = new BABYLON.TransformNode(`reel${index}`, scene);
    const symbols = [];

    for (let i = 0; i < 20; i++) {
        const plane = BABYLON.MeshBuilder.CreatePlane(
            `sym${index}_${i}`,
            { width: 2.2, height: 2.2 },
            scene
        );
        plane.position.y = i * 2.5 - 25;
        plane.position.z = 0.05;
        plane.parent = parent;

        const key = symbolKeys[Math.floor(Math.random() * symbolKeys.length)];
        const texPath = symbolTextureMap[key];

        const mat = new BABYLON.StandardMaterial(`mat${index}_${i}`, scene);
        mat.backFaceCulling = false;
        mat.specularColor = BABYLON.Color3.Black();

        if (texPath) {
            try {
                mat.diffuseTexture = new BABYLON.Texture(texPath, scene);
            } catch (e) {
                console.warn(`Texture missing for symbol ${key}:`, texPath);
                mat.diffuseColor = BABYLON.Color3.FromHexString("#2e323e");
                mat.emissiveColor = BABYLON.Color3.FromHexString("#444b61");
            }
        } else {
            mat.diffuseColor = BABYLON.Color3.FromHexString("#2e323e");
            mat.emissiveColor = BABYLON.Color3.FromHexString("#444b61");
        }

        plane.material = mat;

        // Optional subtle glow behind each symbol
        const glow = BABYLON.MeshBuilder.CreatePlane(
            `glow${index}_${i}`,
            { width: 2.4, height: 2.4 },
            scene
        );
        glow.position.z = -0.02;
        glow.parent = plane;
        const gm = new BABYLON.StandardMaterial(`glowMat${index}_${i}`, scene);
        gm.emissiveColor = new BABYLON.Color3(1, 0.8, 0.3);
        gm.alpha = 0.7;
        glow.material = gm;

        symbols.push({ plane, symbol: key });
    }

    reels[index] = symbols;
    return parent;
}


function createSlotMachine(scene) {
    const positions = [-3, 0, 3]; // Original global X positions
    const scaleFactor = 3;
    const machineRootY = -2.5;
    const reelGlobalZ = 1.9;
    
    // NOTE: Ensure your file is named EXACTLY 'slot_machine.glb' in the '/models/' folder
    const rootUrl = "/models/"; 
    const fileName = "slot_machine.glb";

    // 1. Create reels and glow frames (Reels are now the primary focus)
    for (let i = 0; i < 3; i++) {
        const reel = createReel(scene, i);
        reel.position.x = positions[i];
        reelMeshes.push(reel);

        const frame = BABYLON.MeshBuilder.CreatePlane(
            `frame${i}`,
            { width: 3.3, height: 3.3 },
            scene
        );
        frame.position = new BABYLON.Vector3(positions[i], 0, reelGlobalZ);
        const fm = new BABYLON.StandardMaterial(`frameMat${i}`, scene);
        fm.emissiveColor = new BABYLON.Color3(1, 0.7, 0);
        frame.material = fm;
        glowFrames.push(frame);
    }

    // 2. Load the Optional 3D model using the standard API call.
    // If this fails (which we are accepting), the catch block executes and the reels remain.
    BABYLON.SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, scene)
        .then(container => {
            console.log("3D Model loaded successfully. Applying transformations...");
            
            const root = container.meshes[0];

            // Add all assets from the container to the scene
            container.addAllToScene(); 

            // A. Position and scale the main machine model
            root.scaling = new BABYLON.Vector3(scaleFactor, scaleFactor, scaleFactor);
            root.position.y = machineRootY;
            root.rotation.y = Math.PI; // Rotate 180 degrees to face the camera

            // B. Adjust materials (Existing logic - added a try/catch here for safety)
            try {
                container.meshes.forEach(m => {
                    if (m.material) {
                        if (!(m.material instanceof BABYLON.PBRMaterial)) {
                            const pbr = new BABYLON.PBRMaterial(m.material.name + "_pbr", scene);
                            pbr.albedoColor =
                                m.material.albedoColor ||
                                m.material.diffuseColor ||
                                BABYLON.Color3.White();
                            pbr.metallic = 0.98;
                            pbr.roughness = 0.12;
                            m.material = pbr;
                        } else {
                            m.material.metallic = 0.98;
                            m.material.roughness = 0.12;
                        }
                    }
                });
            } catch (e) {
                console.error("Material adjustment failed:", e);
            }

            // C. Parent and reposition the existing reel meshes and glow frames
            reelMeshes.forEach((reel, i) => {
                // Attach the reel to the machine root
                reel.setParent(root);

                // Counteract the 3x root scale to keep reel size correct
                reel.scaling = new BABYLON.Vector3(1 / scaleFactor, 1 / scaleFactor, 1 / scaleFactor);

                // Calculate local position relative to the scaled root:
                const reelPosX = positions[i] / scaleFactor;
                const reelPosY = (0 - machineRootY) / scaleFactor;
                const reelPosZ = (reelGlobalZ / scaleFactor) - 0.05;

                reel.position = new BABYLON.Vector3(reelPosX, reelPosY, reelPosZ);

                // Counteract the root's 180-degree rotation so the symbols face the camera
                reel.rotation.y = Math.PI; 
            });

            glowFrames.forEach((frame, i) => {
                frame.setParent(root);
                frame.scaling = new BABYLON.Vector3(1 / scaleFactor, 1 / scaleFactor, 1 / scaleFactor);
                
                // Position frame slightly in front of the reel
                const framePosX = positions[i] / scaleFactor;
                const framePosY = (0 - machineRootY) / scaleFactor;
                const framePosZ = reelGlobalZ / scaleFactor;
                
                frame.position = new BABYLON.Vector3(framePosX, framePosY, framePosZ);

                // Counteract the root's 180-degree rotation
                frame.rotation.y = Math.PI;
            });
            
            console.log("Reels successfully parented and positioned.");
        })
        .catch((error) => {
            // FALLBACK: The model failed to load. The reels are already in the scene.
            console.error("3D model failed to load. Falling back to reels only.", error);
        });
}


/* ============================================================
   SPIN & WIN LOGIC
   ============================================================ */

async function spin() {
    if (!currentUser) return;
    if (isSpinning || currentUser.balance < currentBet) {
        if (currentUser.balance < currentBet) showResult("Insufficient funds!");
        return;
    }

    isSpinning = true;
    document.getElementById("spinButton").disabled = true;
    hideResult();

    await Promise.all(reelMeshes.map((reel, i) => spinReel(reel, i)));

    const visibleSymbols = reelMeshes.map((reel, i) => {
        let idx = Math.round(-reel.position.y / 2.5) % 20;
        if (idx < 0) idx += 20;
        return reels[i][idx] ? reels[i][idx].symbol : symbolKeys[0];
    });

    await submitGameResult(visibleSymbols);

    isSpinning = false;
    document.getElementById("spinButton").disabled = false;
}

function spinReel(reel, index) {
    return new Promise(resolve => {
        const duration = 2000 + index * 600;
        const targetY = -Math.floor(Math.random() * 20) * 2.5;

        const anim = new BABYLON.Animation(
            `spin${index}`,
            "position.y",
            60,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        anim.setKeys([
            { frame: 0, value: reel.position.y },
            { frame: 100, value: reel.position.y - 50 + targetY }
        ]);

        const ease = new BABYLON.CubicEase();
        ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
        anim.setEasingFunction(ease);

        let animatable = null;
        animatable = gameScene.beginDirectAnimation(
            reel,
            [anim],
            0,
            100,
            false,
            duration / 1000,
            () => {
                reel.position.y = targetY;
                if (animatable) animatable.stop();
                resolve();
            }
        );
    });
}

async function submitGameResult(symbols) {
    let winAmount = 0;
    const s = symbols[0];

    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        winAmount =
            currentBet *
            ({
                DIAMOND: 100,
                SEVEN: 50,
                CROWN: 25,
                BAR: 15,
                WILD: 10,
                CHERRY: 8,
                SCATTER: 5
            }[s] || 2);

        showResult(`JACKPOT! +$${winAmount.toFixed(2)}`);
        triggerWinParticles();
        pulseFrames();
    } else if (symbols[0] === symbols[1] || symbols[1] === symbols[2]) {
        winAmount = currentBet * 2;
        showResult(`WIN +$${winAmount.toFixed(2)}`);
        triggerWinParticles();
    }

    try {
        const res = await fetch("/api/game/result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                betAmount: currentBet,
                winAmount,
                symbols,
                gameType: "slots"
            })
        });

        const data = await res.json();
        if (res.ok) {
            currentUser.balance = data.balance;
            updateGameUI();
            document.getElementById("gameWin").textContent = winAmount.toFixed(2);
        }
    } catch (e) {
        console.error("Result submit failed:", e);
    }
}

function pulseFrames() {
    glowFrames.forEach(f => {
        const bounceEase = new BABYLON.BounceEase();
        bounceEase.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);

        BABYLON.Animation.CreateAndStartAnimation(
            "pulseX",
            f,
            "scaling.x",
            60,
            40,
            1,
            1.5,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
            bounceEase
        );

        BABYLON.Animation.CreateAndStartAnimation(
            "pulseY",
            f,
            "scaling.y",
            60,
            40,
            1,
            1.5,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE,
            bounceEase
        );
    });
}

/* ============================================================
   RESULT DISPLAY
   ============================================================ */

function showResult(msg) {
    const el = document.getElementById("resultOverlay");
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(hideResult, 4000);
}

function hideResult() {
    document.getElementById("resultOverlay").classList.remove("show");
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function init() {
        console.log("🎰 Game JS loaded successfully!");

        const loginBtn = document.getElementById("loginButton");
        if (loginBtn) loginBtn.addEventListener("click", login);

        const registerBtn = document.getElementById("registerButton");
        if (registerBtn) registerBtn.addEventListener("click", showRegister);

        document.getElementById("loginPassword")?.addEventListener("keypress", e => {
            if (e.key === "Enter") login();
        });
        document.getElementById("registerPassword")?.addEventListener("keypress", e => {
            if (e.key === "Enter") register();
        });

        // Global bindings for inline onclick handlers
        window.login = login;
        window.showRegister = showRegister;
        window.showLogin = showLogin;
        window.register = register;
        window.playGame = playGame;
        window.logout = logout;
        window.addFunds = addFunds;
        window.withdrawFunds = withdrawFunds;
        window.showFundsModal = showFundsModal;
        window.closeFundsModal = closeFundsModal;
        window.spin = spin;
        window.changeBet = changeBet;
        window.backToLobby = backToLobby;
    }
})();
