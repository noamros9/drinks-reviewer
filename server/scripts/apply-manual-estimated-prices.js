// One-time (rerunnable) apply of manually WebSearch-researched estimatedPrice values, for drinks
// the Gemini backfill (backfill-estimated-prices.js) couldn't confidently price under its free-tier
// quota. Source: scratchpad/price_research.md manual research pass. Only writes ids with a
// confirmed real listing; never overwrites an existing estimatedPrice or a real collection price.
// Run manually: node server/scripts/apply-manual-estimated-prices.js
const { readData, writeData } = require('../dataStore');
const { close } = require('../db');

function avgLotPrice(drink) {
  const prices = (drink.collection || []).map(l => l.price).filter(p => typeof p === 'number' && !Number.isNaN(p));
  return prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
}

const PRICES = {
  wine: {
    '8a047548-5ade-4181-929f-3fb6e6c5ec0d': 74,
    '0480a8fe-3dcb-4a0d-a64f-059742edb4ed': 111,
    'deef07ca-3fa6-4dae-a041-d741b415935a': 54,
    '24238a6a-a298-4be1-a546-afea30e94fff': 64,
    'e61a5a18-38bd-4e63-bcaa-d93ae8e75a72': 48,
    '60cc8a68-9d77-43f8-9ea2-862b313e73c5': 56,
    'b473910a-d4f3-44cc-951a-a67ce711673e': 70,
    '25d272f2-6d02-4a91-8aaa-b610f1b17782': 109,
    '89e6d064-fab1-42f2-bbf3-4ed7a7aa5a03': 66,
    '16319c06-60fd-4801-881e-5b00069dd841': 52,
    '8b20d27e-509a-4696-972b-6851cdf4db02': 56,
    '14cde6db-2c15-4333-929f-f6ee85cf4484': 70,
    'c72b1046-d670-42c2-a373-0051c7b3c4c5': 30,
    'e1afd496-4126-4503-b3f8-612286d62c42': 19,
    'f38a08aa-ba6d-4145-9182-e6753e3beda4': 59.90,
    '8ca38a6b-2b71-49f8-9f57-e2d89c4ba894': 59.90,
    '872405f5-4565-4c0f-be29-e2a9281b0c13': 59,
    '6fa546c6-6916-49b6-813d-196d2df421c0': 56,
    '8369cbe6-ae29-495a-8ffb-6d5291f83a30': 26,
    '4d8c5982-fc1c-4870-aea9-8c1560c14cd0': 33,
  },
  beer: {
    'e803324d-1a0e-4863-9b1e-0506588fd51f': 5,
    '76fe2ce0-7ba3-41b5-b676-9e080b0312ec': 16.70,
    'ecd3cba2-da8d-4778-aa95-c4b4591bc5ec': 14.50,
    '63767e18-ccd2-4a7e-9cdf-917f6dfd4235': 14,
    '9816c21e-0356-4580-80a0-c248c6e9e2c3': 19,
    'd9b4f6ad-afd6-4f25-8914-ed6aa6371956': 14,
    'd679f8a9-c93e-44c4-9d37-1a60436c787b': 14.50,
    'dfb9e881-7e4d-4136-ad99-375e31563bb0': 12.50,
    'e4ef333c-5419-48e6-85b8-d5cd00252ca6': 11.50,
    'c60818d4-8f1c-4340-ad3a-7c915eb8b2b0': 12,
    '17524fa7-dad0-4e1b-a172-4fabbf619f3f': 13,
    'b3d76857-4d9f-481a-bfbc-2fc42088c2b3': 17,
    '9446a2f9-f2ad-4646-be2b-8289f5516a72': 9.50,
    '3f760d77-70ca-49b3-b969-caa94dc7d5b3': 15,
    'f9b625f3-eb06-49dc-bcfd-a50c45d1023c': 6,
  },
  whiskey: {
    '0b74d9d1-5be5-4c25-895c-2ab9a02f62c9': 139,
    'e03885d4-992d-4551-95e2-287f6687fa33': 75,
    'e292adde-df93-47f5-a6a8-99683352b5f2': 490,
    '21369e5e-3c36-494b-ba10-d8ec494eb75a': 368,
  },
};

async function applyCategory(category, prices) {
  const data = await readData(category);
  let applied = 0;
  for (const [id, price] of Object.entries(prices)) {
    const drink = data.find(d => d.id === id);
    if (!drink) { console.warn(`${category}: id ${id} not found, skipping`); continue; }
    if (avgLotPrice(drink) !== null || typeof drink.estimatedPrice === 'number') {
      console.warn(`${category}: id ${id} already priced, skipping`);
      continue;
    }
    drink.estimatedPrice = price;
    applied++;
  }
  if (applied > 0) await writeData(category, data);
  console.log(`${category}: applied ${applied}/${Object.keys(prices).length}`);
}

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI is required.'); process.exit(1); }
  for (const [category, prices] of Object.entries(PRICES)) await applyCategory(category, prices);
  await close();
}

main().catch(err => { console.error(err); process.exit(1); });
