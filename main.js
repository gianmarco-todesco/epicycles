// gian marco todesco - gianmarco.todesco@gmail.com

/* eslint-disable prefer-const */
/* eslint-disable eqeqeq */

'use strict'

// --------------------------------------------------------
// Curve
// --------------------------------------------------------
class Curve {
    constructor() {
        this.points = [];
    }
    add(x,y) {
        // add point if not too close to the last one
        const points = this.points
        const n = points.length
        if(n>0) {
            const dx = points[n-1][0] - x
            const dy = points[n-1][1] - y
            if(dx * dx + dy * dy < 50) return;            
        }
        this.points.push([x,y])
    }
    get length() {
        const points = this.points
        const n = points.length
        if(n < 2) return 0.0
        let s = 0.0
        let oldx = points[n-1][0]
        let oldy = points[n-1][1]   
        for(var i=0; i<n; i++) {
            let dx = points[i][0] - oldx
            let dy = points[i][1] - oldy
            s += Math.sqrt(dx*dx+dy*dy)  
            oldx = points[i][0]
            oldy = points[i][1]    
        }
        return s
    }
}

// --------------------------------------------------------
// EpicycleSystem
// --------------------------------------------------------
class EpicycleSystem {
    constructor() {
        this.center = { re:0, im:0 }
        this.items = []
        this.circles = []
        this.penx = 0
        this.peny = 0
    }

    clear() {
        this.circles = []
        this.items = []
        this.center.re = 0
        this.center.im = 0
        this.penx = this.peny = 0
    }

    computeDft(crv) {
        this.clear()
        const pts = crv.points
        if(pts.length < 10) return

        const n = pts.length
        const d = Math.floor(n / 2)
        for (let k = -d; k < -d + n; k++) {
            const phi = 2 * Math.PI * k / n
            let re = 0
            let im = 0
            for (let j = 0; j < n; j++) {
                const re1 = pts[j][0]
                const im1 = pts[j][1]
                const re2 = Math.cos(phi * j)
                const im2 = -Math.sin(phi * j)
                var re3 = re1 * re2 - im1 * im2
                var im3 = re1 * im2 + re2 * im1
                re += re3
                im += im3
            }
            re /= n
            im /= n
            if (k == 0) {
                this.center.re = re
                this.center.im = im
            } else {
                const r = Math.sqrt(re * re + im * im)
                this.items.push({ re, im, k, r })
            }
        }
        this.items.sort((a, b) => b.r - a.r)
    }


    computeCircles(phi, rmin) {
        const circles = this.circles = []
        const items = this.items
        this.penx = this.peny = 0
        if (items.length == 0) return
        let x = this.center.re
        let y = this.center.im
    
        const n = items.length + 1 // il +1 deriva da dft.center con k=0
        for (let i = 0; i < n - 1; i++) {
            
            if(items[i].r < rmin) break;
            // aggiungo il cerchio i-esimo
            circles.push({ x, y, r: items[i].r })
            // calcolo le coordinate del centro del cerchio successivo
            const re1 = items[i].re
            const im1 = items[i].im
            const k = items[i].k
            const re2 = Math.cos(phi * k)
            const im2 = Math.sin(phi * k)
            var dx = re1 * re2 - im1 * im2
            var dy = re1 * im2 + re2 * im1
            x += dx
            y += dy
        }
        circles.push({ x, y, r: 0 })
        this.penx = x
        this.peny = y
        
    }

    draw (ctx) {
        const circles = this.circles
        if (circles.length == 0) return
        ctx.lineWidth = ctx.pixelSize * 1
        ctx.strokeStyle = 'rgb(200,200,200,0.5)'
        const r1 = 1.5
    
        circles.forEach((circle, i) => {
            const { x, y, r } = circle
            const opacity = 1.0 / (1 + i * 0.05)
            
            if(r>0) {
                ctx.beginPath()
                ctx.myCircle(x,y, r)
                let green = 220 + 20 * opacity;
                let blue = 240 - 20 * opacity;
                ctx.fillStyle = 'rgb(240,' + green + ',' + blue + ',' + opacity + ')'
                ctx.fill();
                ctx.strokeStyle = 'rgb(20,20,20,' + opacity + ')'
                
                ctx.stroke();    
            }
    
            ctx.beginPath()
            ctx.myCircle(x, y, r*0.05)
            ctx.fill();
            ctx.stroke();
    
            ctx.fillStyle = 'rgb(50,50,50)'
            ctx.fill();
    
            if (i > 0) {
                ctx.beginPath();
                ctx.moveTo(x, y)
                ctx.lineTo(circles[i-1].x, circles[i-1].y)
                ctx.strokeStyle = 'rgb(20,20,20,' + opacity + ')'
                ctx.stroke();
            }
        })   
    }
}

// --------------------------------------------------------
// Viewer class:
//    main animation loop; zoom & pan; basic drawing functions
// --------------------------------------------------------

class Viewer {
    constructor(canvas) {
        this.canvas = canvas
        const ctx = this.ctx = canvas.getContext('2d')
        this.zoom = 0
        this.zoomTarget = 0
        this.zoomCenter = [0,0]
        this.zoomScale = 1
        ctx.pixelSize = 1
        this.pany = 0
        this.time = performance.now()
        this.draw = function() {}
        ctx.myCircle = (x,y,r) => { ctx.moveTo(x+r,y,r); ctx.arc(x,y,r,0,Math.PI*2)}
    }

    repaint() {
        const canvas = this.canvas
        const width = this.width = canvas.width = canvas.clientWidth
        const height = this.height = canvas.height = canvas.clientHeight
        const ctx = this.ctx
        // clear
        ctx.clearRect(0,0,width,height)
        // set origin at the canvas center
        ctx.save()
        ctx.translate(width/2, height/2)
        if(this.zoom>0) {
            const sc = this.zoomScale
            ctx.scale(sc,sc)
            const t = (1 - Math.cos(Math.min(Math.PI, this.zoom)))*0.5
            ctx.translate(-this.zoomCenter[0] * t, -this.zoomCenter[1] * t)
        }
        // draw
        this.draw(ctx)
        ctx.restore()        
    }

    animate() {
        // compute time and dtime
        const time = performance.now()
        const dtime = this.dtime = time - this.time
        this.time = time         
        this.updateZoom()
    }

    _setZoom(zoom) {
        this.zoom = zoom
        this.zoomScale = Math.exp(this.zoom*0.5)
        this.ctx.pixelSize = 1.0/this.zoomScale
    }

    updateZoom() {
        const dtime = this.dtime
        const zoomSpeed = 0.001
        let zoom = this.zoom
        let target = this.zoomTarget
        if(zoom<target) this._setZoom(Math.min(target, zoom + zoomSpeed*dtime)) 
        else if(zoom > target) this._setZoom(Math.max(target, zoom - zoomSpeed*dtime))

    }

    startMainLoop() {
        const me = this
        function mainLoop() {
            me.animate()           
            me.repaint()
            requestAnimationFrame(mainLoop)
        }
        mainLoop()
    }

    zoomin() {
        this.zoomTarget = this.zoomTarget + 1
    }
    zoomout() {
        this.zoomTarget = Math.max(0, this.zoomTarget - 1)

    }
    resetPanAndZoom() {
        this.zoom = this.targetZoom = 0
        this._setZoom(0)
        this.zoomCenter = [0,0]

    }
    
    setZoomCenter(x,y) {
        const k = 0.1
        this.zoomCenter[0] = this.zoomCenter[0] * k + x * (1-k)
        this.zoomCenter[1] = this.zoomCenter[1] * k + y * (1-k)
    }
}

// --------------------------------------------------------
// parametri
// --------------------------------------------------------

// velocità di rotazione del primo epiciclo
let omega = 0.1

let maxTailLength = 1000
let rmin = 0

// --------------------------------------------------------
// variabili
// --------------------------------------------------------

// traccia lasciata dal punto blu
let tail = new Curve()

// curva disegnata dall'utente
let targetCrv = new Curve()

// modalita': se stroking vale true allora l'utente sta disegnando
let stroking = false

const viewer = new Viewer(document.getElementById('c'))
let canvas = viewer.canvas
viewer.startMainLoop()

const es = new EpicycleSystem()

const pi2 = Math.PI*2



// --------------------------------------------------------
// gestione click&drag del mouse
// --------------------------------------------------------
let offx = 0
let offy = 0
function onMouseDown (e) {
    // l'utente ha fatto click nel canvas.
    // comincio a seguire globalmente gli eventi di mouse-move e mouse-up
    document.addEventListener('pointermove', onDrag)
    document.addEventListener('pointerup', onRelease)
    // mi ricordo la differenza fra coordinate rispetto al canvas (offsetX,offsetY)
    // e rispetto al documento (e.clientX, e.clientY)
    offx = e.offsetX - e.clientX
    offy = e.offsetY - e.clientY
    // informo il programma che l'utente ha cominciato a disegnare
    strokeStart()
}
function onDrag (e) {
    // il mouse si è mosso (dopo il click)
    // calcolo le coordinate del mouse rispetto al centro del canvas
    var x = e.clientX + offx - canvas.width/2 
    var y = e.clientY + offy - canvas.height/2
    // informo il programma che l'utente ha prolungato il disegno fino al punto (x,y)
    stroke(x, y)
}
function onRelease (e) {
    // l'utente ha finito di disegnare. smetto di seguire mouse-move e mouse-up
    document.removeEventListener('pointermove', onDrag)
    document.removeEventListener('pointerup', onRelease)
    // informo il programma che il disegno è finito
    strokeEnd()
}
// tutte le volte che l'utente fa click nel canvas chiamo la funzione onMouseDown
canvas.addEventListener('pointerdown', onMouseDown)


// --------------------------------------------------------
// gestione touch
// --------------------------------------------------------
let ongoingTouches = [];
function onTouchStart(e) {
    e.preventDefault()
    let touches = e.changedTouches
    strokeStart()
}
function onTouchEnd(e) {
    e.preventDefault()
    strokeEnd()
}
function onTouchCancel(e) {
    e.preventDefault()
    strokeEnd()
}
function onTouchMove(e) {
    e.preventDefault()
    let touches = e.changedTouches
    if(touches.length>0) {
        var x = touches[0].offsetX - canvas.width/2
        var y = touches[0].offsetY - canvas.height/2
        stroke(x,y)
    }
}

canvas.addEventListener("touchstart", onTouchStart, false, {passive: false})
canvas.addEventListener("touchend", onTouchEnd, false)
canvas.addEventListener("touchcancel", onTouchCancel, false)
canvas.addEventListener("touchmove", onTouchMove, false)
canvas.addEventListener("click", ()=>{})

// --------------------------------------------------------
// manage user input (strokeStart(), stroke(), strokeEnd())
// --------------------------------------------------------

// l'utente ha cominciato a tracciare una curva
function strokeStart () {
    // cancello le curve precedenti
    tail = new Curve()
    targetCrv = new Curve()
    es.clear()
    // cambio lo stato del programa
    stroking = true
    viewer.resetPanAndZoom()
}

// l'utente ha disegnato un pezzetto di curva
function stroke (x, y) {
    // aggiungo il punto (x,y) a targetCrv solo se non è troppo vicino all'ultimo
    // punto disegnato
    targetCrv.add(x,y)
}
// l'utente ha finito di disegnare: calcolo la DFT (se la curva disegnata è abbastanza lunga)
function strokeEnd () {
    if (targetCrv.points.length > 10) {
        const length = targetCrv.length
        omega = 20.0 * Math.PI*2 / length; 
        es.computeDft(targetCrv)

    } else {
        targetCrv = []
    }
    stroking = false
}

let phi = 0
// let rmin = 0

// --------------------------------------------------------

function changeSpeed(d) {
    omega += 0.01 * d
}

function changePrecision(d) {
    rmin = Math.max(0, rmin + d * 5)
}

viewer.draw = function(ctx) {
    if(!stroking && es.items.length>0) {
        phi += this.dtime * 0.001 * omega
        es.computeCircles(phi, rmin)        
        this.setZoomCenter(es.penx, es.peny)        
        es.draw(ctx);
        tail.points.push([es.penx, es.peny])
    }

    if(targetCrv.points.length>=2) {
        const pts = targetCrv.points
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.strokeStyle = 'rgb(50,240,250,0.8)'
        ctx.lineWidth = 5 * ctx.pixelSize
        ctx.stroke()
    }

    // disegno la traccia blu se c'è
    if (tail.points.length > 2) {
        const pts = tail.points
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.strokeStyle = 'blue'
        ctx.lineWidth = 1 * ctx.pixelSize
        ctx.stroke()
    }
    
}


// --------------------------------------------------------
// Calcola la posizione e il raggio degli epicicli
// --------------------------------------------------------
function computeEpicycles () {
    circles = []
    if (dft.items.length == 0) return
    let x = dft.center.re
    let y = dft.center.im

    // tempo in secondi dall'inizio
    const time = performance.now() * 0.001
    var phi = 2 * Math.PI * omega * time
    const n = dft.items.length + 1 // il +1 deriva da dft.center con k=0
    for (let i = 0; i < n - 1; i++) {
        if(dft.items[i].norm < rmin) break;
        // aggiungo il cerchio i-esimo
        circles.push({ x, y, r: dft.items[i].norm })
        // calcolo le coordinate del centro del cerchio successivo
        const re1 = dft.items[i].re
        const im1 = dft.items[i].im
        const k = dft.items[i].k
        const re2 = Math.cos(phi * k)
        const im2 = Math.sin(phi * k)
        var dx = re1 * re2 - im1 * im2
        var dy = re1 * im2 + re2 * im1
        x += dx
        y += dy
    }
    circles.push({ x, y, r: 0 })
    addPointToTail(x, y)
    penx = x;
    peny = y;
    if(zoom != 1) {
        panx = -x*zoom
        pany = -y*zoom
    }
}

function changeSpeed(d) {
    omega += 0.1 * d
}


// --------------------------------------------------------
// Disegno gli epicicli
// --------------------------------------------------------
function drawEpicycles () {
    if (circles.length == 0) return
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgb(200,200,200,0.5)'
    const r1 = 1.5

    circles.forEach((circle, i) => {
        const { x, y, r } = circle
        const opacity = 1.0 / (1 + i * 0.05)
        
        if(r>0) {
            ctx.beginPath()
            addCircle([x,y], r)
            let green = 220 + 20 * opacity;
            let blue = 240 - 20 * opacity;
            ctx.fillStyle = 'rgb(240,' + green + ',' + blue + ',' + opacity + ')'
            ctx.fill();
            ctx.strokeStyle = 'rgb(20,20,20,' + opacity + ')'
            ctx.stroke();    
        }

        ctx.beginPath()
        addCircle([x, y], r*0.01)
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = 'rgb(50,50,50)'
        ctx.fill();


        if (i > 0) {
            ctx.beginPath();
            moveTo([x, y])
            lineTo([circles[i-1].x, circles[i-1].y])
            ctx.strokeStyle = 'rgb(20,20,20,' + opacity + ')'
            ctx.stroke();
        }
    })
 
    ctx.beginPath();
    addCircle([penx,peny],5)
    ctx.strokeStyle = "red"
    ctx.stroke()
    
}

// aggiunge un punto alla traccia
// se necessario cancella i punti più vecchi
function addPointToTail (x, y) {
    tail.push([x, y])
    if (tail.length > maxTailLength) {
        tail.splice(0, tail.length - maxTailLength)
    }
}
// disegno una curva
function drawCurve (crv) {
    var n = crv.length
    if (n < 2) return
    ctx.beginPath()
    moveTo(crv[0])
    for (let i = 1; i < n; i++) lineTo(crv[i])
    ctx.stroke()
}




// --------------------------------------------------------
// drawing function
// --------------------------------------------------------

function moveTo(p) { ctx.moveTo(panx + zoom*p[0], pany + zoom*p[1]) }
function lineTo(p) { ctx.lineTo(panx + zoom*p[0], pany + zoom*p[1]) }
function addCircle(p,r) { 
    const x = panx + zoom*p[0]
    const y = pany + zoom*p[1]
    ctx.moveTo(x+r*zoom,y)
    ctx.arc(x,y,r*zoom,0,pi2)
 }
