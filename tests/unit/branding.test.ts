import { describe, expect, it } from 'vitest';
import { BRANDING_PRESETS } from '../../src/config/branding';

describe('brand isolation', () => {
  it('keeps the private fan-remake disclosure explicit', () => {
    const privateBrand = BRANDING_PRESETS.PRIVATE_FAN_REMAKE;
    expect(privateBrand.name).toBe('ENDURO');
    expect(privateBrand.legalNotice).toContain('Não afiliado');
  });

  it('keeps protected names out of the original public identity', () => {
    const publicBrand = BRANDING_PRESETS.ORIGINAL_PUBLIC_BUILD;
    const completeIdentity = JSON.stringify(publicBrand).toLocaleLowerCase('en');
    expect(completeIdentity).not.toContain('enduro');
    expect(completeIdentity).not.toContain('activision');
    expect(publicBrand.name).toBe('ROAD ENDURANCE');
  });
});
