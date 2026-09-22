// Admin/Compare form definition per category: which fields, in what order, and how each is
// labelled and edited. Keys must match shared/drink-schema.json (pinned by drinkSchema.test.js);
// labels and inputs are UI-only, so they live here rather than in the shared schema.
export const FIELDS = {
  wine: [
    { key: 'producer',      label: 'Producer',              type: 'text', autocomplete: true },
    { key: 'seriesAndName', label: 'Series & Name',          type: 'text' },
    { key: 'wineCategory',  label: 'Wine Type',              type: 'select', options: ['Red', 'White', 'Rosé', 'Sparkling', 'Fortified'] },
    { key: 'variety',       label: 'Variety',                type: 'tags', default: [] },
    { key: 'sweetness',     label: 'Sweetness',              type: 'select', options: ['Extra-Dry', 'Dry', 'Off-Dry', 'Sweet'] },
    { key: 'country',       label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'region',        label: 'Region / Appellation',   type: 'text', autocomplete: true, placeholder: 'Loire Valley / Sancerre' },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'vivinoScore',   label: 'Vivino Score',           type: 'number', min: 1, max: 5, step: 0.1, placeholder: 'e.g. 4.2' },
    { key: 'tags',          label: 'Tags',                   type: 'tags', default: [] },
  ],
  beer: [
    { key: 'brewery',     label: 'Brewery',               type: 'text', autocomplete: true },
    { key: 'name',        label: 'Beer Name',              type: 'text' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'tags',        label: 'Tags',                   type: 'tags', default: [] },
  ],
  whiskey: [
    { key: 'distillery',  label: 'Distillery',             type: 'text', autocomplete: true },
    { key: 'name',        label: 'Name',                   type: 'text' },
    { key: 'country',     label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'region',      label: 'Region',                 type: 'text', placeholder: 'Speyside, Islay, Highlands…', autocomplete: true },
    { key: 'age',         label: 'Age (years)',             type: 'number' },
    { key: 'style',       label: 'Style',                  type: 'text' },
    { key: 'abv',         label: 'ABV (%)',                type: 'number' },
    { key: 'tags',        label: 'Tags',                   type: 'tags', default: [] },
  ],
  others: [
    { key: 'drinkCategory', label: 'Drink Category',         type: 'text', placeholder: 'Rum, Vodka, Liqueur…' },
    { key: 'distillery',    label: 'Distillery',             type: 'text', autocomplete: true },
    { key: 'name',          label: 'Name',                   type: 'text' },
    { key: 'country',       label: 'Country of Origin',      type: 'text', autocomplete: true },
    { key: 'style',         label: 'Style',                  type: 'text' },
    { key: 'age',           label: 'Age (years)',             type: 'number' },
    { key: 'abv',           label: 'ABV (%)',                type: 'number' },
    { key: 'tags',          label: 'Tags',                   type: 'tags', default: [] },
  ],
};
