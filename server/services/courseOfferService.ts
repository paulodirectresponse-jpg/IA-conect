export interface CourseOfferSnapshot {
  course_id: string;
  version: number;
  title: string;
  subtitle: string;
  price_brl_cents: number;
  currency: 'BRL';
  checkout_enabled: boolean;
}

const DEFAULT_PRICE_CENTS = 2990;

function configuredPrice() {
  const raw = Number(process.env.COURSE_ANIMATION_3D_PRICE_CENTS || DEFAULT_PRICE_CENTS);
  if (!Number.isFinite(raw) || raw < 100) return DEFAULT_PRICE_CENTS;
  return Math.round(raw);
}

function configuredCheckoutEnabled() {
  return String(process.env.COURSE_ANIMATION_3D_CHECKOUT_ENABLED || 'true').trim().toLowerCase() !== 'false';
}

export const ANIMATION_3D_COURSE_ID = 'animacao-3d-ia';

export const courseOfferService = {
  get(courseId = ANIMATION_3D_COURSE_ID): CourseOfferSnapshot | null {
    if (courseId !== ANIMATION_3D_COURSE_ID) return null;
    return {
      course_id: ANIMATION_3D_COURSE_ID,
      version: 1,
      title: 'Do Zero à Animação 3D com IA',
      subtitle: 'Crie sua primeira animação 3D com inteligência artificial sem dominar animação, modelagem ou Blender.',
      price_brl_cents: configuredPrice(),
      currency: 'BRL',
      checkout_enabled: configuredCheckoutEnabled(),
    };
  },
};
