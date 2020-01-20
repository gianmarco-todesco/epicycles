// gian marco todesco - gianmarco.todesco@gmail.com

/* eslint-disable prefer-const */
/* eslint-disable eqeqeq */

'use strict'

// --------------------------------------------------------
// Curve
// --------------------------------------------------------
class Curve {
    constructor() {
        this.points = []
    }
    addIfNotTooClose(x,y, minSquaredDistance) {
        // add point if not too close to the last one
        const points = this.points
        const n = points.length
        if(n>0) {
            const dx = points[n-1][0] - x
            const dy = points[n-1][1] - y
            if(dx * dx + dy * dy < minSquaredDistance) return;            
        }
        this.points.push([x,y])
    }
    get length() { return this.points.length }
    get pixelLength() {
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
    clear() { this.points = [] }
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
            ctx.myCircle(x, y, Math.min(5, r*0.05))
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
        this.draw(ctx, this.dtime)
        ctx.restore()        
    }

    animate() {
        // compute time and dtime
        const time = performance.now() * 0.001
        this.dtime = time - this.time
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
        const zoomSpeed = 3.0
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
        this.zoomTarget = Math.min(4, this.zoomTarget + 1)
    }
    zoomout() {
        this.zoomTarget = Math.max(0, this.zoomTarget - 1)

    }
    resetPanAndZoom() {
        this.zoom = this.zoomTarget = 0
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
// PointerHandler class:
//    handle mouse and touch events
// --------------------------------------------------------

class PointerHandler {

    constructor(canvas) {
        this.canvas = canvas
        this.startStroke = function() {}
        this.stroke = function(x,y) {}
        this.endStroke = function() {}
        this.handleMouse()
        this.handleTouch()
        canvas.addEventListener("click", ()=>{})
        this.strokeStarted = false
    }

    notifyStartStroke() {
        if(!this.strokeStarted) {
            this.strokeStarted = true
            this.startStroke()
        }
    }
    notifyStroke(x,y) {
        if(this.strokeStarted) this.stroke(x,y)
    }
    notifyEndStroke() {
        if(this.strokeStarted) {
            this.strokeStarted = false
            this.endStroke()
        }
    }
    

    handleMouse() {
        const me = this
        let offx = 0
        let offy = 0
        function onMouseDown (e) {
            e.preventDefault()
            document.addEventListener('pointermove', onDrag)
            document.addEventListener('pointerup', onRelease)
            offx = e.offsetX - e.clientX
            offy = e.offsetY - e.clientY
            me.notifyStartStroke()
        }
        function onDrag (e) {
            e.preventDefault()
            var x = e.clientX + offx - me.canvas.width/2 
            var y = e.clientY + offy - me.canvas.height/2
            me.notifyStroke(x, y)
        }
        function onRelease (e) {
            e.preventDefault()
            document.removeEventListener('pointermove', onDrag)
            document.removeEventListener('pointerup', onRelease)
            me.notifyEndStroke()
        }
        this.canvas.addEventListener('pointerdown', onMouseDown)        
    }

    handleTouch() {
        const me = this
        function onTouchStart(e) {
            e.preventDefault()
            me.notifyStartStroke()
        }
        function onTouchEnd(e) {
            e.preventDefault()
            me.notifyEndStroke()
        }
        function onTouchCancel(e) {
            e.preventDefault()
            me.notifyEndStroke()
        }
        function onTouchMove(e) {
            e.preventDefault()
            let touches = e.changedTouches
            if(touches.length>0) {
                var x = touches[0].offsetX - canvas.width/2
                var y = touches[0].offsetY - canvas.height/2
                me.notifyStroke(x,y)
            }
        }
        const canvas = this.canvas
        canvas.addEventListener("touchstart", onTouchStart, false, {passive: false})
        canvas.addEventListener("touchend", onTouchEnd, false, {passive: false})
        canvas.addEventListener("touchcancel", onTouchCancel, false, {passive: false})
        canvas.addEventListener("touchmove", onTouchMove, false, {passive: false})
        
    }
}

// --------------------------------------------------------
// main class
// --------------------------------------------------------

class Application {
    constructor() {
        const me = this
        this.phi = 0
        this.omega = 0.1
        this.rmin = 0
        this.tail = new Curve()
        this.targetCrv = new Curve()
        this.stroking = false
        const canvas = document.getElementById('c')
        const viewer = this.viewer = new Viewer(canvas)
        const ph = this.pointerHandler = new PointerHandler(canvas)
        this.es = new EpicycleSystem()
        this.circleCount = 0
        ph.startStroke = () => me.startStroke()
        ph.endStroke = () => me.endStroke()
        ph.stroke = (x,y) => { me.targetCrv.addIfNotTooClose(x,y, 50) }
        viewer.draw = (ctx, dtime) => me.draw(ctx, dtime)
        viewer.startMainLoop()
    }

    startStroke() {
        this.tail.clear()
        this.targetCrv.clear()
        this.es.clear()
        this.stroking = true
        this.viewer.resetPanAndZoom()
    }

    endStroke() {
        const length = this.targetCrv.pixelLength
        if (length > 10) {            
            this.omega = 50.0 * Math.PI*2 / length; 
            this.es.computeDft(this.targetCrv)   
            if(this.es.items.length == 0) this.targetCrv.clear()
            else this.targetCrv.points.push(this.targetCrv.points[0])
        } else {
            this.targetCrv.clear()
        }
        this.stroking = false
    }

    drawCurve(ctx, crv) {
        const pts = crv.points
        if(pts.length>=2) {
            ctx.beginPath()    
            ctx.moveTo(pts[0][0], pts[0][1])
            for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
            ctx.stroke()
        }
    }

    addPointToTail(x,y) {
        const pts = this.tail.points
        pts.push([x,y,this.phi])
        let i = 0
        while(i<pts.length-1 && this.phi - pts[i][2] > 1.8 * Math.PI) i++
        pts.splice(0,i)
    }

    draw(ctx, dtime) {
        const es = this.es
        const viewer = this.viewer
        if(!this.stroking && es.items.length>0) {
            this.phi += dtime * this.omega * ctx.pixelSize
            es.computeCircles(this.phi, this.rmin)        
            viewer.setZoomCenter(es.penx, es.peny)        
            es.draw(ctx);
            this.addPointToTail(es.penx, es.peny)
        }
        ctx.strokeStyle = 'rgb(50,240,250,0.8)'
        ctx.lineWidth = 5 * ctx.pixelSize
        this.drawCurve(ctx, this.targetCrv)    
    
        ctx.strokeStyle = 'blue'
        ctx.lineWidth = 1 * ctx.pixelSize
        this.drawCurve(ctx, this.tail)   
        
        if(this.es.circles.length>0) {
            const r = 3 * ctx.pixelSize
            ctx.strokeStyle ='black'
            ctx.fillStyle = 'blue'
            ctx.beginPath()
            ctx.myCircle(es.penx, es.peny, r)
            ctx.fill() 
            ctx.stroke() 
        }
        this.updateCircleCount()

    }
    updateCircleCount() {
        const count = this.es.circles.length
        if(count != this.circleCount) {
            this.circleCount = count
            let text = ""
            if(count > 1) {
                text = " : " + (count-1) + (count == 2 ? "circle" : "circles")
            }
            const span = document.getElementById('circle-count')
            span.innerHTML = text
        }
    }

    changeSpeed(d) {
        this.omega = Math.max(0, this.omega + d * 0.5)
    }
    changePrecision(d) {
        const span = document.getElementById('min-radius')
        this.rmin = Math.max(0, this.rmin + d)
        span.innerHTML = this.rmin
        this.tail.clear()        
    }
}

const app = new Application()
