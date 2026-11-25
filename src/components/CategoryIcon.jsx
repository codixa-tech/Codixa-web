import { Globe, Smartphone, Monitor, Boxes, Bot, GraduationCap, Layers } from 'lucide-react';

const ICONS = { web: Globe, mobile: Smartphone, desktop: Monitor, erp: Boxes, robotics: Bot, training: GraduationCap, systems: Layers, ai: Bot };

export default function CategoryIcon({ name, size = 20, ...rest }) {
  const Icon = ICONS[name] || Layers;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" {...rest} />;
}
