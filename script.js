/**
 * 3D PIPELINE SAKE GAME ENGINE
 * Strictly utilizes HTML5 Canvas 2D Context for raw rasterization of calculated 3D coordinates.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Settings & Grid Scale
const GRID_SIZE = 14; 
let score = 0;
let gameOver = false;

// Snake Application State
let snake = [
    {x: 0, y: 0}, // Head
    {x: -1, y: 0},
    {x: -2, y: 0}  // Tail
];
let direction = {x: 1, y: 0}; // Initial movement vector
let nextDirection = {x: 1, y: 0};
let food = {x: 3, y: 3};

// Timing for game ticks (independent of rendering framerate)
let lastTickTime = 0;
const tickInterval = 300; // Move snake every 300ms

// Camera & Render Settings
const cameraZ = 12.0; 
const fov = 55;
// Static rotation angles to tilt the game board for a cool isometric/3D view
const pitch = 0.8;  // Tilt down (X-axis rotation)
const yaw = 0.5;    // Turn slightly (Y-axis rotation)

// Base 3D geometry layout for a unit Cube (Centered at 0,0,0)
const unitCubeVertices = [
    {x: -0.4, y: -0.4, z: -0.4}, {x: 0.4, y: -0.4, z: -0.4},
    {x: 0.4, y:  0.4, z: -0.4}, {x: -0.4, y:  0.4, z: -0.4},
    {x: -0.4, y: -0.4, z:  0.4}, {x: 0.4, y: -0.4, z:  0.4},
    {x: 0.4, y:  0.4, z:  0.4}, {x: -0.4, y:  0.4, z:  0.4}
];

const cubeFaces = [
    { indices: [0, 1, 2, 3], baseColor: [16, 185, 129] },  // Front
    { indices: [1, 5, 6, 2], baseColor: [5,  150, 105] },  // Right
    { indices: [5, 4, 7, 6], baseColor: [16, 185, 129] },  // Back
    { indices: [4, 0, 3, 7], baseColor: [5,  150, 105] },  // Left
    { indices: [4, 5, 1, 0], baseColor: [52, 211, 153] },  // Top
    { indices: [3, 2, 6, 7], baseColor: [4,  120, 87] }   // Bottom
];

// Input Management
window.addEventListener('keydown', e => {
    switch(e.key) {
        case 'ArrowUp':    if (direction.y === 0) nextDirection = {x: 0, y: -1}; break;
        case 'ArrowDown':  if (direction.y === 0) nextDirection = {x: 0, y: 1};  break;
        case 'ArrowLeft':  if (direction.x === 0) nextDirection = {x: -1, y: 0}; break;
        case 'ArrowRight': if (direction.x === 0) nextDirection = {x: 1, y: 0};  break;
    }
});

function generateFood() {
    while(true) {
        let rx = Math.floor(Math.random() * GRID_SIZE) - GRID_SIZE/2;
        let ry = Math.floor(Math.random() * GRID_SIZE) - GRID_SIZE/2;
        // Ensure food doesn't spawn on top of the snake
        if (!snake.some(seg => seg.x === rx && seg.y === ry)) {
            food = {x: rx, y: ry};
            break;
        }
    }
}

/**
 * Helper Math: Rotate 3D vector points around origin via Tilt Matrices
 */
function rotatePoint(p, radX, radY) {
    // Pitch (Rotation around X axis)
    let y1 = p.y * Math.cos(radX) - p.z * Math.sin(radX);
    let z1 = p.y * Math.sin(radX) + p.z * Math.cos(radX);
    
    // Yaw (Rotation around Y axis)
    let x2 = p.x * Math.cos(radY) + z1 * Math.sin(radY);
    let z2 = -p.x * Math.sin(radY) + z1 * Math.cos(radY);
    
    return {x: x2, y: y1, z: z2};
}

/**
 * CORE GRAPHICS ENGINE & GAME LOOP
 */
function updateAndRender(timestamp) {
    // Clear screen backbuffer
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ==========================================
    // STAGE 1: APPLICATION STAGE
    // ==========================================
    // Handles core mechanics processing logic, game updates, scoring, and input parsing.
    if (!gameOver && timestamp - lastTickTime > tickInterval) {
        lastTickTime = timestamp;
        direction = nextDirection;

        // Calculate targeted next position for Snake Head
        let newHead = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

        // Collision Checks (Walls boundaries)
        const boundary = GRID_SIZE / 2;
        if (newHead.x >= boundary || newHead.x < -boundary || newHead.y >= boundary || newHead.y < -boundary) {
            gameOver = true;
            document.getElementById('status').innerText = "GAME OVER";
            document.getElementById('status').style.color = "#ef4444";
        }

        // Collision Checks (Self intersection)
        if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
            gameOver = true;
            document.getElementById('status').innerText = "GAME OVER";
            document.getElementById('status').style.color = "#ef4444";
        }

        if (!gameOver) {
            snake.unshift(newHead); // Append new head node to stack array

            // Check Food collection mechanics
            if (newHead.x === food.x && newHead.y === food.y) {
                score += 10;
                document.getElementById('score').innerText = score;
                generateFood();
            } else {
                snake.pop(); // Trim tail fragment if no growth occured
            }
        }
    }

    // Pipeline Draw Queue across objects
    let renderQueue = [];

    // ==========================================
    // STAGE 2: GEOMETRY PROCESSING STAGE
    // ==========================================
    // Local transformations, Camera Views alignments, Backface Culling filters, and Screen Space projection equations.

    // --- OBJECT 1: The Game Board Platform Grid Base ---
    const halfG = GRID_SIZE / 2;
    for (let i = -halfG; i <= halfG; i++) {
        // Line templates along horizontal & vertical axes lines
        let linesData = [
            [{x: i, y: -halfG, z: -0.4}, {x: i, y: halfG, z: -0.4}],
            [{x: -halfG, y: i, z: -0.4}, {x: halfG, y: i, z: -0.4}]
        ];

        linesData.forEach(line => {
            let p1Rot = rotatePoint({x: line[0].x, y: line[0].y, z: line[0].z}, pitch, yaw);
            let p2Rot = rotatePoint({x: line[1].x, y: line[1].y, z: line[1].z}, pitch, yaw);

            // Project 3D onto 2D viewport coordinates scaling
            let fovRad = 1.0 / Math.tan((fov * Math.PI / 180) / 2);
            
            let s1 = fovRad / (cameraZ - p1Rot.z);
            let screenX1 = (p1Rot.x * s1) * (canvas.height / 2) + (canvas.width / 2);
            let screenY1 = (p1Rot.y * s1) * (canvas.height / 2) + (canvas.height / 2);

            let s2 = fovRad / (cameraZ - p2Rot.z);
            let screenX2 = (p2Rot.x * s2) * (canvas.height / 2) + (canvas.width / 2);
            let screenY2 = (p2Rot.y * s2) * (canvas.height / 2) + (canvas.height / 2);

            renderQueue.push({
                type: 'line',
                x1: screenX1, y1: screenY1, x2: screenX2, y2: screenY2,
                depth: (p1Rot.z + p2Rot.z) / 2,
                color: 'rgba(255, 255, 255, 0.08)'
            });
        });
    }

    // Function loop container converting geometric instances into dynamic polygons
    function processCubeInstance(gridX, gridY, customColorOverride) {
        // Center offsets map
        let worldX = gridX + 0.5;
        let worldY = gridY + 0.5;
        let worldZ = 0; 

        // Compute localized cube vertices matrices arrays
        let transformedVerts = unitCubeVertices.map(v => {
            let wX = v.x + worldX;
            let wY = v.y + worldY;
            let wZ = v.z + worldZ;
            return rotatePoint({x: wX, y: wY, z: wZ}, pitch, yaw);
        });

        cubeFaces.forEach(face => {
            let v0 = transformedVerts[face.indices[0]];
            let v1 = transformedVerts[face.indices[1]];
            let v2 = transformedVerts[face.indices[2]];

            // Geometric Backface Culling Math verification block
            let ax = v1.x - v0.x, ay = v1.y - v0.y, az = v1.z - v0.z;
            let bx = v2.x - v0.x, by = v2.y - v0.y, bz = v2.z - v0.z;
            let nx = ay * bz - az * by;
            let ny = az * bx - ax * bz;
            let nz = ax * by - ay * bx;

            // Dot product against camera view vector tracking vector direction
            let dot = nx * v0.x + ny * v0.y + nz * (v0.z - cameraZ);
            if (dot >= 0) return; // Discard back-facing surface geometry

            // Perspective projection loop processing
            let projectedPoints = face.indices.map(idx => {
                let p = transformedVerts[idx];
                let scale = (1.0 / Math.tan((fov * Math.PI / 180) / 2)) / (cameraZ - p.z);
                return {
                    x: (p.x * scale) * (canvas.height / 2) + (canvas.width / 2),
                    y: (p.y * scale) * (canvas.height / 2) + (canvas.height / 2)
                };
            });

            // Calculate overall depth tracking sorting indices values
            let avgZ = (v0.z + v1.z + v2.z) / 3;

            let c = customColorOverride || face.baseColor;

            renderQueue.push({
                type: 'face',
                points: projectedPoints,
                depth: avgZ,
                color: `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.95)`
            });
        });
    }

    // --- OBJECT 2: The Snake Segments Render Loop ---
    snake.forEach((segment, index) => {
        // Render head with a brighter color variant tint
        let color = index === 0 ? [16, 185, 129] : [52, 211, 153];
        processCubeInstance(segment.x, segment.y, color);
    });

    // --- OBJECT 3: Food Collectible Render Asset ---
    processCubeInstance(food.x, food.y, [239, 68, 68]); // Bright red shade targeting Food item

    // Depth buffer sorting array pass (Painter's Algorithm implementation)
    renderQueue.sort((a, b) => a.depth - b.depth);

    // ==========================================
    // STAGE 3: RASTERIZATION STAGE
    // ==========================================
    // Evaluates visual nodes structures, updates canvas context draw maps, sets styles fills.
    renderQueue.forEach(item => {
        if (item.type === 'line') {
            ctx.beginPath();
            ctx.moveTo(item.x1, item.y1);
            ctx.lineTo(item.x2, item.y2);
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (item.type === 'face') {
            ctx.beginPath();
            ctx.moveTo(item.points[0].x, item.points[0].y);
            for (let i = 1; i < item.points.length; i++) {
                ctx.lineTo(item.points[i].x, item.points[i].y);
            }
            ctx.closePath();

            // Paint interpolation layout fills
            ctx.fillStyle = item.color;
            ctx.fill();

            // Wireframe mesh borders configuration
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });

    requestAnimationFrame(updateAndRender);
}

// Fire up 3D Scene Initialization
requestAnimationFrame(updateAndRender);