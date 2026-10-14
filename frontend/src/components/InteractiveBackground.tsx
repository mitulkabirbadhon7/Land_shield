"use client";

import React, { useEffect, useRef } from "react";

interface LandParcel {
  id: number;
  dagNo: number;
  vertices: { x: number; y: number }[];
  centroid: { x: number; y: number };
  baseHue: string;
  fillOpacity: number;
}

export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with damped smoothing (lerp)
    const mouse = {
      x: width * 0.5,
      y: height * 0.45,
      targetX: width * 0.5,
      targetY: height * 0.45,
      isHovering: false,
    };

    // Cadastral Mouza Land Parcels
    let parcels: LandParcel[] = [];

    const generateParcels = () => {
      parcels = [];
      const cols = Math.ceil(width / 170) + 1;
      const rows = Math.ceil(height / 130) + 1;
      const cellW = width / (cols - 1);
      const cellH = height / (rows - 1);

      // Generate grid vertices with natural land survey perturbations
      const gridVertices: { x: number; y: number }[][] = [];
      for (let r = 0; r <= rows; r++) {
        gridVertices[r] = [];
        for (let c = 0; c <= cols; c++) {
          const jitterX = (Math.sin(r * 2.5 + c * 3.1) * 0.35 + (Math.random() - 0.5) * 0.3) * cellW * 0.38;
          const jitterY = (Math.cos(r * 3.7 + c * 1.9) * 0.35 + (Math.random() - 0.5) * 0.3) * cellH * 0.38;
          gridVertices[r][c] = {
            x: c * cellW + (c > 0 && c < cols ? jitterX : 0),
            y: r * cellH + (r > 0 && r < rows ? jitterY : 0),
          };
        }
      }

      // Construct Cadastral Land Plots (Dag boundaries)
      let idCounter = 1;
      const dagSeeds = [101, 102, 104, 108, 203, 205, 301, 309, 402, 407, 512, 601, 715, 820, 903, 911];
      const hues = [
        "rgba(16, 185, 129, ", // Emerald arable land
        "rgba(20, 184, 166, ", // Teal homestead/wetland
        "rgba(13, 148, 136, ", // Deep teal surveyed plot
        "rgba(34, 197, 94, ",  // Meadow green
        "rgba(217, 119, 6, ",  // Warm sand/clay boundary
      ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const p1 = gridVertices[r][c];
          const p2 = gridVertices[r][c + 1];
          const p3 = gridVertices[r + 1][c + 1];
          const p4 = gridVertices[r + 1][c];

          const cx = (p1.x + p2.x + p3.x + p4.x) / 4;
          const cy = (p1.y + p2.y + p3.y + p4.y) / 4;

          parcels.push({
            id: idCounter,
            dagNo: dagSeeds[(idCounter - 1) % dagSeeds.length] + Math.floor(idCounter / 3),
            vertices: [p1, p2, p3, p4],
            centroid: { x: cx, y: cy },
            baseHue: hues[idCounter % hues.length],
            fillOpacity: 0.03 + (idCounter % 5) * 0.015,
          });
          idCounter++;
        }
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      generateParcels();
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handlePointerMove = (e: PointerEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.isHovering = true;
    };

    const handlePointerLeave = () => {
      mouse.isHovering = false;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });

    const startTime = performance.now();

    const render = (time: number) => {
      const elapsed = (time - startTime) * 0.001;

      // Smooth mouse follow
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // 1. Radar / LIDAR Land Scanner Sweep (Continuous Drone/Satellite Survey Motion)
      const sweepCycle = (elapsed * 0.15) % 1; // 0 to 1 cycle
      const sweepY = sweepCycle * (height + 300) - 150;

      const sweepGrad = ctx.createLinearGradient(0, sweepY - 140, 0, sweepY + 40);
      sweepGrad.addColorStop(0, "rgba(16, 185, 129, 0)");
      sweepGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.07)");
      sweepGrad.addColorStop(1, "rgba(20, 184, 166, 0.14)");

      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, sweepY - 140, width, 180);

      // Subtle LIDAR scan line
      ctx.beginPath();
      ctx.moveTo(0, sweepY);
      ctx.lineTo(width, sweepY);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.28)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Render Cadastral Land Parcels (দাগ ও সীমানা নকশা)
      let activeHoverParcel: LandParcel | null = null;
      let minDistance = Infinity;

      parcels.forEach((parcel) => {
        const dx = mouse.x - parcel.centroid.x;
        const dy = mouse.y - parcel.centroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance) {
          minDistance = dist;
          activeHoverParcel = parcel;
        }

        const isNearby = dist < 220;
        const proximityRatio = isNearby ? 1 - dist / 220 : 0;

        // Draw Parcel Polygon (Boundary lines)
        ctx.beginPath();
        parcel.vertices.forEach((v, idx) => {
          // Subtle breathing elevation (earth contour oscillation)
          const driftX = Math.sin(elapsed * 0.5 + v.y * 0.005) * 1.5;
          const driftY = Math.cos(elapsed * 0.5 + v.x * 0.005) * 1.5;

          const vx = v.x + driftX;
          const vy = v.y + driftY;

          if (idx === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        });
        ctx.closePath();

        // Parcel fill (subtle earthen green tint, highlights under mouse)
        const currentOpacity = parcel.fillOpacity + proximityRatio * 0.14;
        ctx.fillStyle = `${parcel.baseHue}${currentOpacity})`;
        ctx.fill();

        // Boundary stroke
        const strokeAlpha = 0.15 + proximityRatio * 0.45;
        ctx.strokeStyle = `rgba(16, 185, 129, ${strokeAlpha})`;
        ctx.lineWidth = isNearby ? 1.8 : 1.0;
        ctx.stroke();

        // Draw Cadastral Dag Number (মৌজা দাগ নম্বর) at centroid
        if (width > 640) {
          ctx.font = isNearby ? "bold 11px system-ui, sans-serif" : "10px system-ui, sans-serif";
          ctx.fillStyle = isNearby
            ? `rgba(5, 150, 105, ${0.85 + proximityRatio * 0.15})`
            : "rgba(100, 116, 139, 0.35)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`দাগ ${parcel.dagNo}`, parcel.centroid.x, parcel.centroid.y);
        }

        // Draw Surveyor Boundary Stake Pins (+) at vertices
        parcel.vertices.forEach((v) => {
          const pinAlpha = 0.2 + proximityRatio * 0.6;
          ctx.strokeStyle = `rgba(16, 185, 129, ${pinAlpha})`;
          ctx.lineWidth = 1;
          const s = 3;
          ctx.beginPath();
          ctx.moveTo(v.x - s, v.y);
          ctx.lineTo(v.x + s, v.y);
          ctx.moveTo(v.x, v.y - s);
          ctx.lineTo(v.x, v.y + s);
          ctx.stroke();
        });
      });

      // 3. Interactive Surveyor Reticle & Plot Inspector (Mouse Follower)
      if (mouse.isHovering && activeHoverParcel) {
        const hoverParcel = activeHoverParcel as LandParcel;

        // Circular surveyor scanner optic around cursor
        const scanRadius = 75;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, scanRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Surveyor Precision Crosshair
        ctx.beginPath();
        ctx.moveTo(mouse.x - scanRadius - 10, mouse.y);
        ctx.lineTo(mouse.x - scanRadius + 8, mouse.y);
        ctx.moveTo(mouse.x + scanRadius - 8, mouse.y);
        ctx.lineTo(mouse.x + scanRadius + 10, mouse.y);
        ctx.moveTo(mouse.x, mouse.y - scanRadius - 10);
        ctx.lineTo(mouse.x, mouse.y - scanRadius + 8);
        ctx.moveTo(mouse.x, mouse.y + scanRadius - 8);
        ctx.lineTo(mouse.x, mouse.y + scanRadius + 10);
        ctx.strokeStyle = "rgba(16, 185, 129, 0.5)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Connect cursor to active land parcel centroid with surveyor beam
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(hoverParcel.centroid.x, hoverParcel.centroid.y);
        ctx.strokeStyle = "rgba(20, 184, 166, 0.4)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Mini Cartographic Survey HUD Tag
        const tagX = mouse.x + 22;
        const tagY = mouse.y - 32;

        ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        ctx.beginPath();
        ctx.roundRect(tagX, tagY, 118, 28, 6);
        ctx.fill();
        ctx.strokeStyle = "rgba(52, 211, 153, 0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#34d399";
        ctx.font = "bold 10px monospace, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(`PLOT DAG: #${hoverParcel.dagNo}`, tagX + 8, tagY + 10);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "9px monospace, sans-serif";
        ctx.fillText("CAD. SURVEY • OK", tagX + 8, tagY + 20);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
    >
      {/* Cadastral Land Survey Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-85 transition-opacity duration-700 dark:opacity-75"
      />

      {/* Gentle Edge Gradient for Smooth Content Legibility */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-white/90 dark:from-slate-950/40 dark:via-slate-950/10 dark:to-slate-950/90" />
    </div>
  );
}
