interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// Deterministic background color from name
function bgColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500',
    'bg-orange-500', 'bg-rose-500', 'bg-teal-500', 'bg-cyan-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const px = `${size}px`;
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: px, height: px }}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px, fontSize: size * 0.38 }}
      className={`rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold ${bgColor(name)} ${className}`}
    >
      {initials(name) || '?'}
    </div>
  );
}
