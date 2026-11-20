'use strict';

/**
 * Category Mapping & Controlled Alias Utility
 * Provides deterministic parent-child category resolution, controlled legacy alias mappings,
 * and alignment between product and service merchant types.
 */

// Known standard platform category IDs for predictable lookup
const KNOWN_CATEGORY_IDS = {
  1: { category_id: 1, name: 'Restaurants & Food', slug: 'restaurants', type: 'product', parent_id: null },
  2: { category_id: 2, name: 'Grocery & Essentials', slug: 'grocery', type: 'product', parent_id: null },
  13: { category_id: 13, name: 'Healthcare & Doctors', slug: 'healthcare', type: 'service', parent_id: null },
  16: { category_id: 16, name: 'Pharmacies & Chemists', slug: 'pharmacy-chemist', type: 'product', parent_id: 13 },
  18: { category_id: 18, name: 'Home Services & Repairs', slug: 'repair-services', type: 'service', parent_id: null },
  20: { category_id: 20, name: 'Plumbing & Sanitary Works', slug: 'plumbing', type: 'service', parent_id: 18 },
  24: { category_id: 24, name: 'Beauty & Personal Care', slug: 'beauty-spa', type: 'service', parent_id: null }
};

// Controlled explicit legacy and common aliases for categories and subcategories
const CATEGORY_ALIASES = {
  // 1. Healthcare & Doctors
  'healthcare': [
    'healthcare & doctors',
    'healthcare',
    'health-care',
    'doctors',
    'doctor',
    'medical',
    'healthcare & doctor',
    'clinics'
  ],
  'pharmacy-chemist': [
    'pharmacies & chemists',
    'pharmacy-chemist',
    'pharmacy',
    'chemist',
    'chemists',
    'pharmacies',
    'medical store',
    'medical stores',
    'chemist shop',
    'medicine',
    'medicines'
  ],
  'clinics-doctors': [
    'clinics & general physicians',
    'clinics-doctors',
    'clinic',
    'clinics',
    'general physicians',
    'general physician',
    'doctor',
    'doctors',
    'physician'
  ],
  'dental-care': [
    'dental care & rct',
    'dental-care',
    'dental care',
    'dental',
    'dentist',
    'dental clinic'
  ],
  'diagnostic-labs': [
    'diagnostic labs & pathology',
    'diagnostic-labs',
    'diagnostic labs',
    'pathology',
    'pathology labs',
    'pathology lab',
    'diagnostic center',
    'blood test'
  ],

  // 2. Home Services & Repairs
  'repair-services': [
    'home services & repairs',
    'repair-services',
    'repair services',
    'home services',
    'repairs',
    'home repairs',
    'home repair',
    'home maintenance'
  ],
  'electrician': [
    'electrician & wiring',
    'electrician',
    'electricians',
    'electrical work',
    'electrical',
    'wiring'
  ],
  'plumbing': [
    'plumbing & sanitary works',
    'plumbing',
    'plumber',
    'plumbers',
    'sanitary works',
    'sanitary work',
    'plumbing service',
    'plumbing services'
  ],
  'ac-repair': [
    'ac cleaning & repair',
    'ac-repair',
    'ac repair',
    'ac service',
    'ac cleaning',
    'ac servicing'
  ],
  'deep-cleaning': [
    'housekeeping & deep cleaning',
    'deep-cleaning',
    'housekeeping',
    'deep cleaning',
    'cleaning',
    'home cleaning'
  ],
  'appliance-repair': [
    'appliance repair',
    'appliance-repair',
    'appliances repair',
    'home appliance repair'
  ],

  // 3. Beauty & Personal Care
  'beauty-spa': [
    'beauty & personal care',
    'beauty-spa',
    'beauty, salon & spa',
    'beauty salon & spa',
    'beauty & salon',
    'salon & spa',
    'salon and spa',
    'beauty parlour',
    'beauty care',
    'personal care'
  ],
  'salons-hair': [
    'salons & hair care',
    'salons-hair',
    'salon',
    'salons',
    'hair care',
    'hair salon',
    'beauty salon',
    'barber',
    'parlour'
  ],
  'spa-massage': [
    'spa & massage centers',
    'spa-massage',
    'spa',
    'massage',
    'spa & massage',
    'massage center',
    'spa center'
  ],
  'bridal-makeup': [
    'bridal & makeup artists',
    'bridal-makeup',
    'bridal makeup',
    'makeup artist',
    'makeup artists',
    'bridal'
  ],
  'skincare': [
    'skincare & dermatology',
    'skincare',
    'dermatology',
    'skin care',
    'skin clinic'
  ],

  // 4. Restaurants & Food
  'restaurants': [
    'restaurants & food',
    'restaurants',
    'food & cafe',
    'food',
    'restaurant',
    'cafe',
    'restaurants-food',
    'dining'
  ],
  'fast-food': [
    'fast food',
    'fast-food',
    'fastfood'
  ],
  'cafes-bakeries': [
    'cafes & bakeries',
    'cafes-bakeries',
    'cafe',
    'bakery',
    'bakeries',
    'cafes',
    'bakery & cafe'
  ],
  'meals-thali': [
    'meals & thali',
    'meals-thali',
    'thali',
    'meals',
    'tiffin service',
    'tiffin'
  ],
  'sweets-desserts': [
    'sweets & desserts',
    'sweets-desserts',
    'sweets',
    'desserts',
    'sweet shop',
    'mithai'
  ],
  'beverages-juices': [
    'beverages & juices',
    'beverages-juices',
    'beverages',
    'juices',
    'juice'
  ],

  // 5. Grocery & Essentials
  'grocery': [
    'grocery & essentials',
    'grocery',
    'essentials',
    'daily essentials',
    'kirana',
    'supermarket'
  ],
  'vegetables-fruits': [
    'vegetables & fruits',
    'vegetables-fruits',
    'vegetables',
    'fruits',
    'fruits & vegetables',
    'sabzi'
  ],
  'daily-essentials': [
    'daily essentials & staples',
    'daily-essentials',
    'staples',
    'provisions'
  ],
  'dairy-bakery': [
    'dairy & bakery',
    'dairy-bakery',
    'dairy',
    'milk products',
    'milk'
  ],
  'snacks-packaged-food': [
    'snacks & packaged food',
    'snacks-packaged-food',
    'snacks',
    'packaged food',
    'namkeen'
  ],
  'organic-dry-fruits': [
    'organic & dry fruits',
    'organic-dry-fruits',
    'dry fruits',
    'organic'
  ],

  // 6. Home Decor & Handicrafts
  'home-decor': [
    'home decor & handicrafts',
    'home-decor',
    'home decor',
    'handicrafts',
    'decor'
  ],
  'resin-art-gifts': [
    'resin art & custom gifts',
    'resin-art-gifts',
    'resin art',
    'custom gifts'
  ],
  'handicrafts': [
    'handicrafts & souvenirs',
    'handicrafts',
    'souvenirs'
  ],
  'furniture-decor': [
    'furniture & living decor',
    'furniture-decor',
    'furniture'
  ],
  'lighting-wall-decor': [
    'lighting & wall decor',
    'lighting-wall-decor',
    'lighting'
  ],

  // 7. Electronics & Gadgets
  'electronics': [
    'electronics & gadgets',
    'electronics',
    'gadgets'
  ],
  'mobile-phones': [
    'mobile phones & accessories',
    'mobile-phones',
    'mobile accessories',
    'smartphones',
    'mobile phone'
  ],
  'computers-peripherals': [
    'computers & peripherals',
    'computers-peripherals',
    'computers',
    'laptops',
    'computer'
  ],
  'home-appliances': [
    'home appliances',
    'home-appliances'
  ],
  'gadget-repairs': [
    'gadget repairs',
    'gadget-repairs',
    'mobile repair',
    'laptop repair'
  ],

  // 8. Education & Coaching
  'education': [
    'education & coaching',
    'education',
    'coaching',
    'classes'
  ],
  'tuitions': [
    'school & college tuitions',
    'tuitions',
    'tuition'
  ],
  'exam-coaching': [
    'competitive exams coaching',
    'exam-coaching'
  ],
  'language-coding': [
    'language & coding classes',
    'language-coding'
  ],
  'music-dance': [
    'music & dance academies',
    'music-dance'
  ],

  // 9. Fitness & Sports
  'fitness': [
    'fitness & sports',
    'fitness',
    'sports'
  ],
  'gyms': [
    'gyms & fitness centers',
    'gyms',
    'gym',
    'fitness center'
  ],
  'yoga': [
    'yoga & meditation',
    'yoga',
    'meditation'
  ],
  'sports-clubs': [
    'swimming & sports clubs',
    'sports-clubs',
    'sports club'
  ],

  // 10. CA, Tax & Legal Services
  'legal-financial': [
    'ca, tax & legal services',
    'legal-financial',
    'legal',
    'tax',
    'financial services'
  ],
  'chartered-accountants': [
    'chartered accountants (ca)',
    'chartered-accountants',
    'chartered accountant',
    'ca'
  ],
  'gst-income-tax': [
    'gst & income tax filing',
    'gst-income-tax',
    'gst',
    'income tax'
  ],
  'advocates-legal': [
    'advocates & legal advisors',
    'advocates-legal',
    'advocate',
    'lawyer'
  ],
  'business-registration': [
    'business registration & ip',
    'business-registration'
  ],

  // 11. Pet Care & Veterinary
  'pet-care': [
    'pet care & veterinary',
    'pet-care',
    'pet care',
    'veterinary'
  ],
  'veterinary-doctors': [
    'veterinary clinics & doctors',
    'veterinary-doctors',
    'vet',
    'vet doctor'
  ],
  'pet-grooming': [
    'pet grooming & spa',
    'pet-grooming'
  ],
  'pet-food-supplies': [
    'pet food & supplies',
    'pet-food-supplies',
    'pet food'
  ],

  // 12. Travel & Transport
  'travel': [
    'travel & transport',
    'travel',
    'transport'
  ],
  'taxi-car-rental': [
    'taxi & car rentals',
    'taxi-car-rental',
    'taxi',
    'cab'
  ],
  'tour-travel-agents': [
    'tour & travel agents',
    'tour-travel-agents',
    'travel agent'
  ],
  'packers-movers': [
    'packers & movers',
    'packers-movers'
  ]
};

// Build reverse lookup: lowercase alias string -> canonical slug
const ALIAS_TO_CANONICAL = new Map();
for (const [slug, aliases] of Object.entries(CATEGORY_ALIASES)) {
  ALIAS_TO_CANONICAL.set(slug.toLowerCase(), slug);
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), slug);
  }
}

/**
 * Returns canonical slug for a given alias or input string.
 */
function getCanonicalSlugForAlias(input) {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();
  return ALIAS_TO_CANONICAL.get(str) || null;
}

/**
 * Returns a fallback known category record if matching ID or slug exists.
 */
function getKnownCategoryByIdOrSlug(val) {
  if (!val) return null;
  const str = String(val).trim();

  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (KNOWN_CATEGORY_IDS[num]) {
      return { ...KNOWN_CATEGORY_IDS[num] };
    }
  }

  const slug = getCanonicalSlugForAlias(str) || str.toLowerCase();
  for (const item of Object.values(KNOWN_CATEGORY_IDS)) {
    if (item.slug === slug || item.name.toLowerCase() === str.toLowerCase()) {
      return { ...item };
    }
  }

  return null;
}

/**
 * Given a category record and its child subcategories from DB, returns an array
 * of all eligible category names and controlled aliases to match merchants against.
 * Strictly uses exact values (never wildcards) to prevent leaking unrelated merchants.
 */
function getEligibleCategoryNames(cat, childSubcategories = []) {
  const eligibleSet = new Set();

  if (!cat) return [];

  // Add primary name and slug
  if (cat.name) eligibleSet.add(cat.name.toLowerCase());
  if (cat.slug) eligibleSet.add(cat.slug.toLowerCase());

  // Add aliases for category's slug and name
  const catSlug = cat.slug ? cat.slug.toLowerCase() : getCanonicalSlugForAlias(cat.name);
  if (catSlug && CATEGORY_ALIASES[catSlug]) {
    CATEGORY_ALIASES[catSlug].forEach(alias => eligibleSet.add(alias.toLowerCase()));
  }

  // Include child subcategories and their controlled aliases
  if (Array.isArray(childSubcategories)) {
    for (const sub of childSubcategories) {
      if (sub.name) eligibleSet.add(sub.name.toLowerCase());
      if (sub.slug) eligibleSet.add(sub.slug.toLowerCase());

      const subSlug = sub.slug ? sub.slug.toLowerCase() : getCanonicalSlugForAlias(sub.name);
      if (subSlug && CATEGORY_ALIASES[subSlug]) {
        CATEGORY_ALIASES[subSlug].forEach(alias => eligibleSet.add(alias.toLowerCase()));
      }
    }
  }

  return Array.from(eligibleSet);
}

module.exports = {
  KNOWN_CATEGORY_IDS,
  CATEGORY_ALIASES,
  ALIAS_TO_CANONICAL,
  getCanonicalSlugForAlias,
  getKnownCategoryByIdOrSlug,
  getEligibleCategoryNames
};
