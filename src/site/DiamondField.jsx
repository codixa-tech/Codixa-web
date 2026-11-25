import { useEffect, useRef } from 'react';
import { C_PATH, DIAMOND_PATH } from '../components/Logo.jsx';

// The brand's diamond pattern as a live grid. Diamonds that fall inside the Codixa mark light up,
// so the logo is literally built out of the pattern; the cursor pushes nearby diamonds to cyan.
const MARK = { x: 262, y: 237, w: 481, h: 549 };

export default function DiamondField({ active, isRTL }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cPath = new Path2D(C_PATH);
    const dPath = new Path2D(DIAMOND_PATH);

    let W = 0;
    let H = 0;
    let dpr = 1;
    let points = [];
    let raf = 0;
    let visible = true;
    let startAt = 0;
    let lastPointer = -1e9;
    let lastFrame = 0;
    const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

    function layout() {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);

      const mobile = W < 820;
      const gap = mobile ? 20 : W > 1500 ? 28 : 25;
      const markH = mobile ? Math.min(H * 0.4, W * 0.8) : Math.min(H * 0.74, W * 0.4);
      const scale = markH / MARK.h;
      const markW = MARK.w * scale;
      const marginX = mobile ? (W - markW) / 2 : Math.max(W * 0.06, (W - 1240) / 2);
      const ox = mobile ? marginX : isRTL ? marginX : W - marginX - markW;
      const oy = mobile ? H - markH - H * 0.09 : (H - markH) / 2 + H * 0.03;

      const m = new DOMMatrix().translate(ox, oy).scale(scale).translate(-MARK.x, -MARK.y);
      const cp = new Path2D();
      cp.addPath(cPath, m);
      const dp = new Path2D();
      dp.addPath(dPath, m);

      points = [];
      const cols = Math.ceil(W / gap) + 1;
      const rows = Math.ceil(H / gap) + 1;
      const originX = ox + (isRTL ? markW : 0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * gap + (r % 2 ? gap / 2 : 0);
          const y = r * gap;
          const inD = ctx.isPointInPath(dp, x * 1, y * 1);
          const inC = !inD && ctx.isPointInPath(cp, x, y);
          const dist = Math.hypot(x - originX, y - oy);
          points.push({ x, y, inC, inD, delay: dist * 0.9 + Math.random() * 120, phase: Math.random() * Math.PI * 2 });
        }
      }
      draw(performance.now());
    }

    function draw(now) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      pointer.x += (pointer.tx - pointer.x) * 0.18;
      pointer.y += (pointer.ty - pointer.y) * 0.18;
      const t = startAt ? now - startAt : 0;
      const R = 160;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const k = d2 < R * R ? 1 - Math.sqrt(d2) / R : 0;
        let s = 1.6 + k * 3.2;
        let color;
        let alpha;

        if (p.inC || p.inD) {
          const lit = reduced ? 1 : startAt ? Math.min(1, Math.max(0, (t - p.delay) / 420)) : 0;
          const wave = reduced ? 0 : 0.18 * Math.sin(now * 0.0016 + p.phase + p.x * 0.01);
          s = 1.8 + lit * (2.4 + wave * 2) + k * 2.2;
          if (p.inD) {
            color = '6,182,212';
            alpha = 0.25 + lit * 0.75;
          } else {
            color = k > 0.15 ? '6,182,212' : '37,99,235';
            alpha = 0.2 + lit * (0.72 + wave);
          }
        } else {
          color = k > 0.05 ? '6,182,212' : '59,91,160';
          alpha = 0.16 + k * 0.7;
        }

        ctx.fillStyle = `rgba(${color},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x + s, p.y);
        ctx.lineTo(p.x, p.y + s);
        ctx.lineTo(p.x - s, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    function loop(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const interacting = now - lastPointer < 1200;
      const intro = startAt && now - startAt < 2600;
      // Idle shimmer runs at ~30fps; cursor interaction and the intro sweep run at full rate.
      if (interacting || intro || now - lastFrame > 33) {
        draw(now);
        lastFrame = now;
      }
      if (!reduced) raf = requestAnimationFrame(loop);
    }
    const kick = () => {
      if (!raf && !reduced) raf = requestAnimationFrame(loop);
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = e.clientX - rect.left;
      pointer.ty = e.clientY - rect.top;
      if (pointer.x < -999) {
        pointer.x = pointer.tx;
        pointer.y = pointer.ty;
      }
      lastPointer = performance.now();
      kick();
      if (reduced) draw(performance.now());
    };
    const onLeave = () => {
      pointer.tx = pointer.ty = -9999;
      if (reduced) {
        pointer.x = pointer.y = -9999;
        draw(performance.now());
      }
    };

    const ro = new ResizeObserver(() => layout());
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    const host = canvas.parentElement;
    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', kick);

    canvas._start = () => {
      if (!startAt) startAt = performance.now();
      kick();
      if (reduced) draw(performance.now());
    };
    layout();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', kick);
    };
  }, [isRTL]);

  useEffect(() => {
    if (active) canvasRef.current?._start?.();
  }, [active, isRTL]);

  return <canvas ref={canvasRef} className="hero__field" aria-hidden="true" />;
}
