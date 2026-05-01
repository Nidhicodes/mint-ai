<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { isGenerating } from '../lib/stores';

  // --- Props ---
  interface Props {
    variant?: 'mesh-gradient' | 'particle-field';
    intensity?: number;
  }

  let { variant = 'particle-field', intensity = 1 }: Props = $props();

  // --- State ---
  let webglSupported = $state(false);
  let webglChecked = $state(false);
  let prefersReducedMotion = $state(false);
  let isMobile = $state(false);
  let canvasContainer = $state<HTMLDivElement | null>(null);
  let animationId = $state<number | null>(null);
  let mouseX = $state(0);
  let mouseY = $state(0);

  // Three.js references (loaded dynamically)
  let scene: any = null;
  let camera: any = null;
  let renderer: any = null;
  let particles: any = null;
  let clock: any = null;

  // Derive effective intensity: reduce when generating
  let effectiveIntensity = $derived($isGenerating ? intensity * 0.3 : intensity);

  // --- WebGL Detection ---
  function detectWebGL(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch {
      return false;
    }
  }

  // --- Reduced Motion Detection ---
  let motionQuery: MediaQueryList | null = null;
  let mobileQuery: MediaQueryList | null = null;

  function checkReducedMotion() {
    if (typeof window === 'undefined') return;
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = motionQuery.matches;
    motionQuery.addEventListener('change', handleMotionChange);
  }

  // --- Mobile Detection ---
  function detectMobile(): boolean {
    if (typeof window === 'undefined') return false;
    // Detect via narrow viewport or touch capability
    const narrowViewport = window.matchMedia('(max-width: 640px)').matches;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return narrowViewport || (hasTouch && window.innerWidth <= 768);
  }

  function checkMobile() {
    if (typeof window === 'undefined') return;
    isMobile = detectMobile();
    mobileQuery = window.matchMedia('(max-width: 640px)');
    mobileQuery.addEventListener('change', handleMobileChange);
  }

  function handleMobileChange() {
    const wasMobile = isMobile;
    isMobile = detectMobile();
    // If switched to mobile, clean up Three.js
    if (isMobile && !wasMobile) {
      cleanupThree();
    }
  }

  function handleMotionChange(e: MediaQueryListEvent) {
    prefersReducedMotion = e.matches;
    if (prefersReducedMotion && animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // --- Mouse Parallax ---
  function handleMouseMove(e: MouseEvent) {
    if (prefersReducedMotion) return;
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }

  // --- Three.js Scene Setup (dynamic import to avoid SSR issues) ---
  async function initThreeScene() {
    if (!canvasContainer || prefersReducedMotion || isMobile) return;

    const THREE = await import('three');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    canvasContainer.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Create particle field
    const particleCount = 120;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Mint color palette for particles
    const mintColors = [
      new THREE.Color(0x22c55e), // mint-500
      new THREE.Color(0x4ade80), // mint-400
      new THREE.Color(0x86efac), // mint-300
      new THREE.Color(0x16a34a), // mint-600
      new THREE.Color(0xbbf7d0), // mint-200
    ];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 12;
      positions[i3 + 1] = (Math.random() - 0.5) * 10;
      positions[i3 + 2] = (Math.random() - 0.5) * 8;

      const color = mintColors[Math.floor(Math.random() * mintColors.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = Math.random() * 3 + 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Start animation loop
    animate();

    // Handle resize
    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function animate() {
    if (prefersReducedMotion) return;

    animationId = requestAnimationFrame(animate);

    if (!particles || !renderer || !scene || !camera || !clock) return;

    const elapsed = clock.getElapsedTime();
    const positions = particles.geometry.attributes.position.array as Float32Array;
    const speed = effectiveIntensity;

    // Animate particles with gentle floating motion
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += Math.sin(elapsed * 0.3 * speed + i) * 0.001 * speed;
      positions[i] += Math.cos(elapsed * 0.2 * speed + i * 0.5) * 0.0005 * speed;
    }
    particles.geometry.attributes.position.needsUpdate = true;

    // Mouse parallax — subtle rotation of the particle group
    const targetRotX = mouseY * 0.05;
    const targetRotY = mouseX * 0.05;
    particles.rotation.x += (targetRotX - particles.rotation.x) * 0.02;
    particles.rotation.y += (targetRotY - particles.rotation.y) * 0.02;

    // Gentle overall rotation
    particles.rotation.z += 0.0002 * speed;

    // Adjust opacity based on intensity
    particles.material.opacity = 0.6 * effectiveIntensity;

    renderer.render(scene, camera);
  }

  // --- Cleanup ---
  function cleanupThree() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    window.removeEventListener('resize', handleResize);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }
    if (particles) {
      particles.geometry.dispose();
      particles.material.dispose();
      particles = null;
    }
    scene = null;
    camera = null;
    clock = null;
  }

  // --- Lifecycle ---
  onMount(() => {
    checkReducedMotion();
    checkMobile();
    webglSupported = detectWebGL();
    webglChecked = true;

    if (webglSupported && !prefersReducedMotion && !isMobile) {
      initThreeScene();
    }

    window.addEventListener('mousemove', handleMouseMove);
  });

  onDestroy(() => {
    cleanupThree();
    if (motionQuery) {
      motionQuery.removeEventListener('change', handleMotionChange);
    }
    if (mobileQuery) {
      mobileQuery.removeEventListener('change', handleMobileChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', handleMouseMove);
    }
  });
</script>

<div
  class="threlte-background"
  aria-hidden="true"
>
  {#if webglChecked}
    {#if webglSupported && !prefersReducedMotion && !isMobile}
      <!-- Three.js canvas container -->
      <div bind:this={canvasContainer} class="canvas-container"></div>
    {:else}
      <!-- CSS animated gradient fallback (used for no WebGL, reduced motion, or mobile) -->
      <div
        class="css-fallback"
        class:reduced-motion={prefersReducedMotion || isMobile}
        style="opacity: {effectiveIntensity}"
      ></div>
    {/if}
  {/if}
</div>

<style>
  .threlte-background {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    overflow: hidden;
  }

  .canvas-container {
    width: 100%;
    height: 100%;
  }

  .canvas-container :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .css-fallback {
    width: 100%;
    height: 100%;
    background: radial-gradient(
        ellipse at 20% 50%,
        rgba(13, 148, 136, 0.04) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse at 80% 20%,
        rgba(13, 148, 136, 0.03) 0%,
        transparent 50%
      ),
      radial-gradient(
        ellipse at 50% 80%,
        rgba(229, 223, 217, 0.3) 0%,
        transparent 50%
      ),
      linear-gradient(180deg, #FAF8F5 0%, #FAF8F5 100%);
    background-size: 200% 200%;
    animation: gradient-shift 15s ease-in-out infinite;
  }

  .css-fallback.reduced-motion {
    animation: none;
    background-size: 100% 100%;
  }

  @keyframes gradient-shift {
    0% {
      background-position: 0% 50%;
    }
    25% {
      background-position: 50% 0%;
    }
    50% {
      background-position: 100% 50%;
    }
    75% {
      background-position: 50% 100%;
    }
    100% {
      background-position: 0% 50%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .css-fallback {
      animation: none;
      background-size: 100% 100%;
    }
  }
</style>
