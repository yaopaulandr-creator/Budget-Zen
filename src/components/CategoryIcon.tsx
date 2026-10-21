import {
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Car,
  CircleEllipsis,
  CircleHelp,
  Coffee,
  Coins,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartHandshake,
  Home,
  Landmark,
  Laptop,
  PawPrint,
  Phone,
  PiggyBank,
  Plane,
  ReceiptText,
  Repeat2,
  RotateCcw,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Stethoscope,
  Tag,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cx } from './ui'

export const CATEGORY_ICONS: Array<{ value: string; label: string; Icon: LucideIcon }> = [
  { value: 'briefcase', label: 'Travail', Icon: Briefcase },
  { value: 'laptop', label: 'Indépendant', Icon: Laptop },
  { value: 'building', label: 'Immobilier', Icon: Building2 },
  { value: 'trending-up', label: 'Hausse', Icon: TrendingUp },
  { value: 'trending-down', label: 'Baisse', Icon: TrendingDown },
  { value: 'gift', label: 'Cadeau', Icon: Gift },
  { value: 'sparkles', label: 'Primes', Icon: Sparkles },
  { value: 'heart-handshake', label: 'Aide', Icon: HeartHandshake },
  { value: 'rotate-ccw', label: 'Remboursement', Icon: RotateCcw },
  { value: 'home', label: 'Logement', Icon: Home },
  { value: 'zap', label: 'Énergie', Icon: Zap },
  { value: 'wifi', label: 'Internet', Icon: Wifi },
  { value: 'smartphone', label: 'Téléphone', Icon: Smartphone },
  { value: 'phone', label: 'Mobile', Icon: Phone },
  { value: 'shopping-basket', label: 'Courses', Icon: ShoppingBasket },
  { value: 'utensils', label: 'Restaurant', Icon: UtensilsCrossed },
  { value: 'car', label: 'Voiture', Icon: Car },
  { value: 'fuel', label: 'Carburant', Icon: Fuel },
  { value: 'bus', label: 'Transport', Icon: Bus },
  { value: 'bike', label: 'Vélo', Icon: Bike },
  { value: 'stethoscope', label: 'Santé', Icon: Stethoscope },
  { value: 'shield-check', label: 'Assurance', Icon: ShieldCheck },
  { value: 'repeat', label: 'Abonnement', Icon: Repeat2 },
  { value: 'gamepad-2', label: 'Loisirs', Icon: Gamepad2 },
  { value: 'shirt', label: 'Vêtements', Icon: Shirt },
  { value: 'graduation-cap', label: 'Éducation', Icon: GraduationCap },
  { value: 'baby', label: 'Famille', Icon: Baby },
  { value: 'landmark', label: 'Impôts', Icon: Landmark },
  { value: 'plane', label: 'Voyage', Icon: Plane },
  { value: 'wrench', label: 'Entretien', Icon: Wrench },
  { value: 'piggy-bank', label: 'Épargne', Icon: PiggyBank },
  { value: 'wallet', label: 'Portefeuille', Icon: Wallet },
  { value: 'coins', label: 'Pièces', Icon: Coins },
  { value: 'receipt', label: 'Reçu', Icon: ReceiptText },
  { value: 'tag', label: 'Étiquette', Icon: Tag },
  { value: 'book-open', label: 'Livre', Icon: BookOpen },
  { value: 'coffee', label: 'Café', Icon: Coffee },
  { value: 'dumbbell', label: 'Sport', Icon: Dumbbell },
  { value: 'paw-print', label: 'Animaux', Icon: PawPrint },
  { value: 'heart', label: 'Cœur', Icon: Heart },
  { value: 'circle-help', label: 'Divers', Icon: CircleHelp },
  { value: 'circle-ellipsis', label: 'Autres', Icon: CircleEllipsis },
]

const ICON_MAP = new Map(CATEGORY_ICONS.map((entry) => [entry.value, entry.Icon]))

export function CategoryIcon({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = ICON_MAP.get(icon) ?? CircleHelp
  const sizes = {
    xs: { wrapper: 'h-5 w-5 rounded', icon: 'h-3 w-3' },
    sm: { wrapper: 'h-7 w-7 rounded-md', icon: 'h-3.5 w-3.5' },
    md: { wrapper: 'h-9 w-9 rounded-lg', icon: 'h-4.5 w-4.5' },
    lg: { wrapper: 'h-11 w-11 rounded-xl', icon: 'h-5 w-5' },
  }[size]
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center', sizes.wrapper, className)}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icon aria-hidden className={sizes.icon} />
    </span>
  )
}
