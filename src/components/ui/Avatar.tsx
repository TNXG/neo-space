import { cn } from "@/lib/utils";

interface AvatarProps {
  src: string;
  size?: string;
  alt?: string;
  className?: string;
}

export function Avatar({ src, size, alt, className }: AvatarProps) {
  return (
    <div
      className={cn(
        size || "w-24 h-24",
        "group border-(--bg-primary) border-2 rounded-full shadow-md relative overflow-hidden bg-linear-to-br from-gray-200 to-gray-400",
        className
      )}
    >
      <img
        src={src}
        alt={alt || "Avatar"}
        className="h-full w-full transition-transform duration-500 object-cover group-hover:scale-110"
      />
    </div>
  );
}
