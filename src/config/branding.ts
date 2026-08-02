export const BRAND_MODES = ['PRIVATE_FAN_REMAKE', 'ORIGINAL_PUBLIC_BUILD'] as const;

export type BrandMode = (typeof BRAND_MODES)[number];

export interface BrandingConfig {
  mode: BrandMode;
  name: string;
  shortName: string;
  eyebrow: string;
  subtitle: string;
  legalNotice: string;
  description: string;
  logoText: string;
  colors: {
    accent: string;
    accentWarm: string;
    panel: string;
  };
}

export const PRIVATE_BRANDING: BrandingConfig = {
    mode: 'PRIVATE_FAN_REMAKE',
    name: 'ENDURO',
    shortName: 'Enduro Fan Remake',
    eyebrow: 'PRIVATE STUDY BUILD',
    subtitle: 'HYPER-REALISTIC FAN REMAKE',
    legalNotice:
      'Projeto de fã não oficial, criado para estudo e experimentação. Não afiliado ou endossado pela Activision.',
    description: 'Uma releitura privada e original de uma corrida arcade de resistência clássica.',
    logoText: 'ENDURO',
    colors: { accent: '#14d9ff', accentWarm: '#ffb45b', panel: '#071019d9' },
};

export const PUBLIC_BRANDING: BrandingConfig = {
    mode: 'ORIGINAL_PUBLIC_BUILD',
    name: 'ROAD ENDURANCE',
    shortName: 'Road Endurance',
    eyebrow: 'ORIGINAL ARCADE EXPERIENCE',
    subtitle: 'THE NEVER-ENDING RACE',
    legalNotice: '',
    description: 'An original endless arcade road endurance game.',
    logoText: 'ROAD ENDURANCE',
    colors: { accent: '#80f0c8', accentWarm: '#ffcc66', panel: '#07130fd9' },
};

export const BRANDING_PRESETS: Record<BrandMode, BrandingConfig> = {
  PRIVATE_FAN_REMAKE: PRIVATE_BRANDING,
  ORIGINAL_PUBLIC_BUILD: PUBLIC_BRANDING,
};

export function normalizeBrandMode(value: string | undefined): BrandMode {
  return value === 'ORIGINAL_PUBLIC_BUILD' ? value : 'PRIVATE_FAN_REMAKE';
}
