/** Brand colours shared by semantic HTML, the 2D poster and the live 3D scene.
 * Values are sRGB CSS colours. Cap finishes affect materials only; manufacturing
 * contours and the source engraving remain identical for every fragrance. */
export const BRAND_THEME = Object.freeze({
  ivory: '#F8F6EF',
  sage: '#E6EEE0',
  ink: '#253B30',
  muted: '#637267',
  line: '#253B3026',
});

function siliconeColors(cap, detail) {
  return Object.freeze({ cap, button: cap, ring: cap, capDetail: detail, buttonDetail: detail });
}

function productTheme(cap, detail, base, light) {
  return Object.freeze({
    cap,
    capColors: siliconeColors(cap, detail),
    world: Object.freeze({ base, light, accent: cap, ink: BRAND_THEME.ink }),
  });
}

export const PRODUCT_THEMES = Object.freeze({
  aloe: productTheme('#BAD1B0', '#AFC4A5', BRAND_THEME.sage, '#F4F7F0'),
  argan: productTheme('#E7B6AE', '#D9ABA4', '#F3E4DF', '#FAF1EC'),
  bamboo: productTheme('#B6CBDE', '#ABBFD1', '#E2EBF1', '#F1F6FA'),
});

/** Build-time CSS: inserting this after the base styles keeps CSS, canvas and
 * cap palettes in agreement without a second handwritten colour catalogue.
 * The older colour variable names remain aliases for existing components. */
export function themeCss() {
  const root = {
    paper: BRAND_THEME.ivory, ink: BRAND_THEME.ink, muted: BRAND_THEME.muted,
    line: BRAND_THEME.line, ivory: BRAND_THEME.ivory, sage: BRAND_THEME.sage,
    lavender: BRAND_THEME.sage, 'selected-world-bg': BRAND_THEME.sage, ice: PRODUCT_THEMES.bamboo.world.base,
    coral: PRODUCT_THEMES.argan.cap,
  };
  const declarations = values => Object.entries(values).map(([key, value]) => `--${key}:${value};`).join('');
  return `:root{${declarations(root)}}\n` + Object.entries(PRODUCT_THEMES).map(([id,theme])=>`html[data-selected-scent="${id}"]{--selected-world-bg:${theme.world.base};}`).join('\n')+'\n'+Object.entries(PRODUCT_THEMES).map(([scent, theme]) =>
    `.scent-${scent}{${declarations({
      'world-bg': theme.world.base, 'world-light': theme.world.light,
      'world-accent': theme.world.accent, 'world-ink': theme.world.ink, scent: theme.world.base,
      'cap-color': theme.cap,
    })}}`).join('\n');
}
