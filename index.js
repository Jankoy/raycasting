"use strict";
class Vector2D {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    static zero() {
        return new Vector2D(0, 0);
    }
    add(that) {
        return new Vector2D(this.x + that.x, this.y + that.y);
    }
    sub(that) {
        return new Vector2D(this.x - that.x, this.y - that.y);
    }
    mul(that) {
        return new Vector2D(this.x * that.x, this.y * that.y);
    }
    div(that) {
        return new Vector2D(this.x / that.x, this.y / that.y);
    }
    scale(factor) {
        return new Vector2D(this.x * factor, this.y * factor);
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    norm() {
        const l = this.length();
        if (l === 0)
            return Vector2D.zero();
        else
            return this.scale(1 / l);
    }
    distanceTo(that) {
        return that.sub(this).length();
    }
    array() {
        return [this.x, this.y];
    }
}
const eps = 1e-3;
function fillCircle(ctx, center, radius) {
    ctx.beginPath();
    ctx.arc(...center.array(), radius, 0, 2 * Math.PI);
    ctx.fill();
}
function strokeLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(...p1.array());
    ctx.lineTo(...p2.array());
    ctx.stroke();
}
function canvasSize(ctx) {
    return new Vector2D(ctx.canvas.width, ctx.canvas.height);
}
function snap(x, dx) {
    if (dx > 0)
        return Math.ceil(x + eps);
    if (dx < 0)
        return Math.floor(x + -eps);
    return x;
}
function hittingCell(p1, p2) {
    const d = p2.sub(p1);
    return new Vector2D(Math.floor(p2.x + Math.sign(d.x) * eps), Math.floor(p2.y + Math.sign(d.y) * eps));
}
function rayStep(p1, p2) {
    let p3 = p2;
    const d = p2.sub(p1);
    if (d.x !== 0) {
        const k = d.y / d.x;
        const c = p1.y - k * p1.x;
        {
            const x3 = snap(p2.x, d.x);
            const y3 = x3 * k + c;
            p3 = new Vector2D(x3, y3);
        }
        if (k !== 0) {
            const y3 = snap(p2.y, d.y);
            const x3 = (y3 - c) / k;
            const temp = new Vector2D(x3, y3);
            if (p2.distanceTo(temp) < p2.distanceTo(p3))
                p3 = temp;
        }
    }
    else {
        const y3 = snap(p2.y, d.y);
        const x3 = p2.x;
        p3 = new Vector2D(x3, y3);
    }
    return p3;
}
function sceneSize(scene) {
    const y = scene.length;
    let x = Number.MIN_VALUE;
    for (let row of scene) {
        x = Math.max(x, row.length);
    }
    return new Vector2D(x, y);
}
function minimap(ctx, p1, p2, position, size, scene) {
    ctx.reset();
    ctx.fillStyle = "#181818";
    ctx.strokeStyle = "#363636";
    ctx.fillRect(0, 0, ...canvasSize(ctx).array());
    const gridSize = sceneSize(scene);
    ctx.translate(...position.array());
    ctx.scale(...size.div(gridSize).array());
    ctx.lineWidth = 0.05;
    ctx.fillStyle = "#363636";
    for (let y = 0; y < gridSize.y; ++y)
        for (let x = 0; x < gridSize.x; ++x)
            if (scene[y][x] === 1)
                ctx.fillRect(x, y, 1, 1);
    for (let x = 0; x <= gridSize.x; ++x) {
        const p1 = new Vector2D(x, 0);
        const p2 = new Vector2D(x, gridSize.y);
        strokeLine(ctx, p1, p2);
    }
    for (let y = 0; y <= gridSize.y; ++y) {
        const p1 = new Vector2D(0, y);
        const p2 = new Vector2D(gridSize.x, y);
        strokeLine(ctx, p1, p2);
    }
    ctx.fillStyle = "magenta";
    ctx.strokeStyle = "magenta";
    fillCircle(ctx, p1, 0.2);
    if (p2 !== null) {
        while (true) {
            const c = hittingCell(p1, p2);
            if (c.x < 0 || c.x >= gridSize.x || c.y < 0 || c.y >= gridSize.y || scene[c.y][c.x] !== 0)
                break;
            fillCircle(ctx, p2, 0.2);
            strokeLine(ctx, p1, p2);
            const p3 = rayStep(p1, p2);
            fillCircle(ctx, p3, 0.2);
            strokeLine(ctx, p2, p3);
            p1 = p2;
            p2 = p3;
        }
    }
}
(() => {
    let scene = [
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const game = document.getElementById("game");
    if (game === null) {
        throw new Error("No canvas with id `game` is found");
    }
    const ctx = game.getContext("2d");
    if (ctx === null) {
        throw new Error("2D context is not supported");
    }
    const p1 = sceneSize(scene).mul(new Vector2D(0.5, 0.5));
    const minimapPosition = Vector2D.zero().add(canvasSize(ctx).scale(0.03));
    let cellSize = ctx.canvas.width * 0.03;
    const minimapSize = sceneSize(scene).scale(cellSize);
    game.addEventListener("mousemove", (ev) => {
        const p2 = new Vector2D(ev.offsetX, ev.offsetY).sub(minimapPosition).div(minimapSize).mul(sceneSize(scene));
        minimap(ctx, p1, p2, minimapPosition, minimapSize, scene);
    });
    minimap(ctx, p1, null, minimapPosition, minimapSize, scene);
})();
