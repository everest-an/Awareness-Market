import { useEffect, useRef } from "react";

// CSS-based 3D Globe animation (no Three.js dependency)
export default function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add subtle parallax effect on mouse move
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const x = (clientX / innerWidth - 0.5) * 20;
      const y = (clientY / innerHeight - 0.5) * 20;
      containerRef.current.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg)`;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Glow effect */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-primary/20 blur-[100px] animate-pulse" />
      
      {/* Globe container */}
      <div
        ref={containerRef}
        className="relative w-[400px] h-[400px] md:w-[500px] md:h-[500px] transition-transform duration-100 ease-out"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Main globe */}
        <div className="absolute inset-0 rounded-full globe-gradient animate-spin-slow" />
        
        {/* Grid lines - horizontal */}
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute inset-0 rounded-full border border-primary/20"
            style={{
              transform: `rotateX(${i * 22.5}deg)`,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
        
        {/* Grid lines - vertical */}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute inset-0 rounded-full border border-primary/20"
            style={{
              transform: `rotateY(${i * 30}deg)`,
              transformStyle: "preserve-3d",
            }}
          />
        ))}
        
        {/* Glowing nodes */}
        {[...Array(20)].map((_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          const radius = 180 + Math.random() * 40;
          const x = Math.cos(angle) * radius;
          const y = (Math.random() - 0.5) * 300;
          const z = Math.sin(angle) * radius;
          const delay = Math.random() * 2;
          
          return (
            <div
              key={`node-${i}`}
              className="absolute w-2 h-2 rounded-full bg-accent animate-pulse"
              style={{
                left: `calc(50% + ${x}px)`,
                top: `calc(50% + ${y}px)`,
                transform: `translateZ(${z}px)`,
                animationDelay: `${delay}s`,
                boxShadow: "0 0 10px 2px oklch(0.75 0.18 195 / 60%)",
              }}
            />
          );
        })}
        
        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full" style={{ transform: "translateZ(1px)" }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(0.65 0.20 230 / 0%)" />
              <stop offset="50%" stopColor="oklch(0.65 0.20 230 / 40%)" />
              <stop offset="100%" stopColor="oklch(0.65 0.20 230 / 0%)" />
            </linearGradient>
          </defs>
          {[...Array(8)].map((_, i) => {
            const startAngle = Math.random() * Math.PI * 2;
            const endAngle = startAngle + Math.PI * (0.3 + Math.random() * 0.5);
            const radius = 200;
            const startX = 250 + Math.cos(startAngle) * radius;
            const startY = 250 + Math.sin(startAngle) * radius * 0.4;
            const endX = 250 + Math.cos(endAngle) * radius;
            const endY = 250 + Math.sin(endAngle) * radius * 0.4;
            const controlX = 250 + Math.cos((startAngle + endAngle) / 2) * radius * 1.3;
            const controlY = 250 + Math.sin((startAngle + endAngle) / 2) * radius * 0.2;
            
            return (
              <path
                key={`line-${i}`}
                d={`M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="1"
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            );
          })}
        </svg>
        
        {/* Outer ring */}
        <div className="absolute inset-[-20px] rounded-full border border-primary/10 animate-spin-slower" />
        <div className="absolute inset-[-40px] rounded-full border border-primary/5" />
      </div>
      
      {/* Floating particles */}
      {[...Array(30)].map((_, i) => (
        <div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full bg-primary/40 animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}
