const canvas = document.getElementById("gc");
const ctx    = canvas.getContext("2d");
const wrap   = document.getElementById("canvas-wrap");

const GRID = 14;
const SZ   = 0.44;

const CUBE_V = [
    [-SZ,-SZ,-SZ],[ SZ,-SZ,-SZ],[ SZ, SZ,-SZ],[-SZ, SZ,-SZ],
    [-SZ,-SZ, SZ],[ SZ,-SZ, SZ],[ SZ, SZ, SZ],[-SZ, SZ, SZ]
];

const FACES = [
    [0,1,2,3],
    [1,5,6,2],
    [5,4,7,6],
    [4,0,3,7],
    [4,5,1,0],
    [3,2,6,7]
];

const SHADES = [1, 0.78, 0.60, 0.70, 0.88, 0.52];

const PITCH  = 0.52;   
const YAW    = 0.42;  
const CAM_Z  = 22;

const cosPitch = Math.cos(PITCH), sinPitch = Math.sin(PITCH);
const cosYaw   = Math.cos(YAW),   sinYaw   = Math.sin(YAW);

const BG        = "#0e0e14";
const GRID_LINE = "rgba(140,138,165,0.09)";
const HEAD_RGB  = [110, 106, 178];   
const BODY_RGB  = [82,  79,  148];   
const FOOD_RGB  = [178, 118, 105];  

const SPEED = 300;   // ms per step

let snake, dir, nextDir, food, score, gameOver, lastMove;

let autoScale = 1, offX = 0, offY = 0;

function rotate(x, y, z) {
    const y1 = y * cosPitch - z * sinPitch;
    const z1 = y * sinPitch + z * cosPitch;
    const x2 = x * cosYaw   + z1 * sinYaw;
    const z2 = -x * sinYaw  + z1 * cosYaw;
    return [x2, y1, z2];
}

function computeFit() {
    const corners = [
        [-GRID/2, -GRID/2, -0.5],
        [ GRID/2, -GRID/2, -0.5],
        [ GRID/2,  GRID/2, -0.5],
        [-GRID/2,  GRID/2, -0.5]
    ];
    const pts = corners.map(([x, y, z]) => {
        const [rx, ry, rz] = rotate(x, y, z);
        const s = CAM_Z / (CAM_Z - rz);
        return [rx * s, ry * s];
    });
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    autoScale = Math.min(
        canvas.width  / (maxX - minX),
        canvas.height / (maxY - minY)
    ) * 0.88;
    offX = canvas.width  / 2 - ((minX + maxX) / 2) * autoScale;
    offY = canvas.height / 2 - ((minY + maxY) / 2) * autoScale;
}

function project(x, y, z) {
    const [rx, ry, rz] = rotate(x, y, z);
    const s = (CAM_Z / (CAM_Z - rz)) * autoScale;
    return { x: rx * s + offX, y: ry * s + offY, z: rz };
}

function resize() {
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight || Math.round(canvas.width * 0.68);
    computeFit();
}

window.addEventListener("resize", resize);
resize();

function rndFood() {
    while (true) {
        const x = Math.floor(Math.random() * GRID) - GRID / 2;
        const y = Math.floor(Math.random() * GRID) - GRID / 2;
        if (!snake.some(s => s.x === x && s.y === y)) return { x, y };
    }
}

function init() {
    snake   = [{ x:0,y:0 }, { x:-1,y:0 }, { x:-2,y:0 }];
    dir     = { x:1, y:0 };
    nextDir = { x:1, y:0 };
    food    = rndFood();
    score   = 0;
    gameOver  = false;
    lastMove  = 0;

    document.getElementById("score-val").textContent  = "0";
    document.getElementById("status-val").textContent = "playing";
    document.getElementById("sdot").className         = "";
    document.getElementById("overlay").classList.remove("show");
}
window.addEventListener("keydown", e => {
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))
        e.preventDefault();

    if (e.key === "ArrowUp"    && dir.y === 0) nextDir = { x: 0, y:-1 };
    if (e.key === "ArrowDown"  && dir.y === 0) nextDir = { x: 0, y: 1 };
    if (e.key === "ArrowLeft"  && dir.x === 0) nextDir = { x:-1, y: 0 };
    if (e.key === "ArrowRight" && dir.x === 0) nextDir = { x: 1, y: 0 };
});

document.getElementById("restart-btn").addEventListener("click", init);

function drawGrid() {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth   = 1;

    for (let i = -GRID / 2; i <= GRID / 2; i++) {
        const a = project(i,      -GRID/2, -0.52);
        const b = project(i,       GRID/2, -0.52);
        const c = project(-GRID/2, i,      -0.52);
        const d = project( GRID/2, i,      -0.52);

        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
}

function drawCube(gx, gy, [r, g, b]) {
    const verts = CUBE_V.map(([vx, vy, vz]) => project(vx + gx, vy + gy, vz));
    const queue = FACES
        .map((f, i) => ({
            f, i,
            depth: (verts[f[0]].z + verts[f[1]].z + verts[f[2]].z + verts[f[3]].z) / 4
        }))
        .sort((a, b) => a.depth - b.depth);

    for (const { f, i } of queue) {
        const s = SHADES[i];
        ctx.beginPath();
        ctx.moveTo(verts[f[0]].x, verts[f[0]].y);
        for (let k = 1; k < f.length; k++)
            ctx.lineTo(verts[f[k]].x, verts[f[k]].y);
        ctx.closePath();

        ctx.fillStyle   = `rgba(${Math.round(r*s)},${Math.round(g*s)},${Math.round(b*s)},0.92)`;
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth   = 0.5;
        ctx.fill();
        ctx.stroke();
    }
}

function render() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    snake.forEach((s, i) =>
        drawCube(s.x, s.y, i === 0 ? HEAD_RGB : BODY_RGB)
    );

    drawCube(food.x, food.y, FOOD_RGB);
}
function update() {
    dir = nextDir;

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const lim  = GRID / 2;
    if (
        head.x >= lim || head.x < -lim ||
        head.y >= lim || head.y < -lim ||
        snake.some(s => s.x === head.x && s.y === head.y)
    ) {
        gameOver = true;
        document.getElementById("status-val").textContent = "game over";
        document.getElementById("sdot").className         = "dead";
        document.getElementById("final-score").textContent = "Score: " + score;
        document.getElementById("overlay").classList.add("show");
        return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        score += 10;
        document.getElementById("score-val").textContent = score;
        food = rndFood();
    } else {
        snake.pop();
    }
}

function loop(t) {
    if (!gameOver && t - lastMove > SPEED) {
        update();
        lastMove = t;
    }
    render();
    requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);