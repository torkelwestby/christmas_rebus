'use client';

export default function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/bama.png"
      alt="BAMA"
      className={className}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}