"use client";

export function VideoBackground({ className = "" }: { className?: string }): React.ReactNode {
  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden ${className}`}>
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute min-w-full min-h-full w-auto h-auto top-1/2 left-1/2 object-cover transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
      >
        <source src="/topographic-textures.3840x2160.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[1px]" />
    </div>
  );
}
