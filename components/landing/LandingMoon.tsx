"use client";

import { useEffect, useRef, useState } from "react";
import type * as THREE_NS from "three";

/** NASA LRO WAC picture of the whole surface, already bundled for the explorer. Credited in the landing and in LICENCES-AND-CITATIONS. */
const TEXTURE = "/explore/moon-2k.jpg";

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * The landing's Moon: a lit sphere, with the real surface picture, turning very slowly. The lighting is illustrative
 * (a fixed lamp that gives a crescent), not the Moon's real phase, and the page says so. three.js loads on demand, so no
 * other page pays for it. Without WebGL a still disc of the same picture is shown instead. Reduced motion: one still frame.
 */
export function LandingMoon() {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = (await import("three")) as typeof THREE_NS;
      if (cancelled) return;
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        setFallback(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.className = "block h-full w-full";
      canvas.setAttribute("aria-hidden", "true");
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0, 7);

      const texture = new THREE.TextureLoader().load(TEXTURE, () => draw());
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const geometry = new THREE.SphereGeometry(1.6, 96, 64);
      const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 });
      const moon = new THREE.Mesh(geometry, material);
      moon.rotation.set(0.12, 2.2, 0.05);
      scene.add(moon);

      // a low lamp from the right gives the crescent; a trace of fill keeps the night side from vanishing completely
      const lamp = new THREE.DirectionalLight(0xffffff, 3.2);
      lamp.position.set(5, 1.2, 1.5);
      scene.add(lamp);
      scene.add(new THREE.AmbientLight(0xffffff, 0.035));

      function size() {
        const w = el!.clientWidth;
        const h = el!.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // wide screens put the Moon to the right of the text; narrow ones centre it
        moon.position.x = camera.aspect > 1.25 ? 1.05 : 0;
        moon.position.y = camera.aspect > 1.25 ? 0 : 0.5;
        camera.updateProjectionMatrix();
      }
      function draw() {
        renderer.render(scene, camera);
      }

      size();
      const ro = new ResizeObserver(() => {
        size();
        draw();
      });
      ro.observe(el);
      draw();

      let raf = 0;
      let last = performance.now();
      if (!reducedMotion()) {
        const tick = (now: number) => {
          moon.rotation.y += ((now - last) / 1000) * 0.012; // one turn in about eight and a half minutes
          last = now;
          draw();
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        texture.dispose();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        canvas.remove();
      };
    })().catch(() => !cancelled && setFallback(true));

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div ref={host} className="absolute inset-0" data-testid="landing-moon" data-fallback={fallback}>
      {fallback && (
        <div
          role="img"
          aria-label="The Moon, an illustration of its surface"
          className="absolute right-[8%] top-1/2 aspect-square h-[70%] -translate-y-1/2 rounded-full shadow-[inset_-60px_0_80px_rgb(0_0_0/0.85)]"
          style={{ backgroundImage: `url(${TEXTURE})`, backgroundSize: "200% 100%", backgroundPosition: "50% 50%" }}
        />
      )}
    </div>
  );
}
