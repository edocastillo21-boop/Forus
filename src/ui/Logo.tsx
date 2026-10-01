export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ display: 'inline-block' }}>
      <rect width="64" height="64" rx="16" fill="#FF6B1A" />
      <path d="M22 16h24v8H31v7h13v8H31v11h-9z" fill="#1A0A00" />
      <rect x="12" y="29" width="5" height="10" rx="1.5" fill="#1A0A00" />
      <rect x="47" y="29" width="5" height="10" rx="1.5" fill="#1A0A00" />
    </svg>
  );
}
