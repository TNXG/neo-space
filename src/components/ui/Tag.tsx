import { SVGProps, ReactElement } from "react";

interface TagProps {
  label: string;
  icon?: (props: SVGProps<SVGSVGElement>) => ReactElement;
}

export function Tag({ label, icon: Icon }: TagProps) {
  return (
    <span className="text-(--accent) bg-(--accent-soft) text-[11px] font-medium px-2.5 py-1 border border-(--accent-soft) rounded-md inline-flex gap-1.5 items-center">
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}
