import { PRIVATE_BRANDING, PUBLIC_BRANDING } from './branding';

export const BRANDING =
  import.meta.env.VITE_BRAND_MODE === 'ORIGINAL_PUBLIC_BUILD'
    ? PUBLIC_BRANDING
    : PRIVATE_BRANDING;
