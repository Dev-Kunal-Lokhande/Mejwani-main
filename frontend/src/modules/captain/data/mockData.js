export const SECTIONS = [
  {
    id: 'ac-hall',
    name: 'AC Hall',
    icon: 'Snowflake',
    gradient: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30 dark:border-blue-500/20',
    textGradient: 'from-blue-400 to-indigo-400',
    bgIcon: 'bg-blue-500/10 text-blue-500',
    desc: 'Premium air-conditioned luxury dining space'
  },
  {
    id: 'non-ac',
    name: 'Non-AC',
    icon: 'Wind',
    gradient: 'from-orange-500/20 to-amber-500/20 border-orange-500/30 dark:border-orange-500/20',
    textGradient: 'from-orange-400 to-amber-400',
    bgIcon: 'bg-orange-500/10 text-orange-500',
    desc: 'Traditional open-air garden style seating'
  },
  {
    id: 'rooftop',
    name: 'Rooftop',
    icon: 'CloudSun',
    gradient: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 dark:border-purple-500/20',
    textGradient: 'from-purple-400 to-pink-400',
    bgIcon: 'bg-purple-500/10 text-purple-500',
    desc: 'Skyview terrace with scenic breeze and vibes'
  },
  {
    id: 'family-section',
    name: 'Family Section',
    icon: 'Users',
    gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 dark:border-emerald-500/20',
    textGradient: 'from-emerald-400 to-teal-400',
    bgIcon: 'bg-emerald-500/10 text-emerald-500',
    desc: 'Quiet, cozy partitions for private family dining'
  }
];

export const INITIAL_TABLES = [
  // AC Hall Tables
  { id: 'T-A01', number: 'A1', capacity: 2, section: 'AC Hall', status: 'available' },
  { id: 'T-A02', number: 'A2', capacity: 4, section: 'AC Hall', status: 'occupied', currentOrder: { id: 'ORD-101', itemsCount: 5, total: 1250, time: '14:15' } },
  { id: 'T-A03', number: 'A3', capacity: 4, section: 'AC Hall', status: 'available' },
  { id: 'T-A04', number: 'A4', capacity: 6, section: 'AC Hall', status: 'reserved', reserveTime: '19:30' },
  { id: 'T-A05', number: 'A5', capacity: 8, section: 'AC Hall', status: 'occupied', currentOrder: { id: 'ORD-104', itemsCount: 3, total: 780, time: '14:35' } },
  { id: 'T-A06', number: 'A6', capacity: 4, section: 'AC Hall', status: 'available' },

  // Non-AC Tables
  { id: 'T-N01', number: 'N1', capacity: 4, section: 'Non-AC', status: 'occupied', currentOrder: { id: 'ORD-102', itemsCount: 4, total: 640, time: '14:20' } },
  { id: 'T-N02', number: 'N2', capacity: 2, section: 'Non-AC', status: 'available' },
  { id: 'T-N03', number: 'N3', capacity: 4, section: 'Non-AC', status: 'available' },
  { id: 'T-N04', number: 'N4', capacity: 4, section: 'Non-AC', status: 'occupied', currentOrder: { id: 'ORD-105', itemsCount: 6, total: 1120, time: '14:05' } },
  { id: 'T-N05', number: 'N5', capacity: 6, section: 'Non-AC', status: 'available' },
  { id: 'T-N06', number: 'N6', capacity: 8, section: 'Non-AC', status: 'reserved', reserveTime: '20:00' },

  // Rooftop Tables
  { id: 'T-R01', number: 'R1', capacity: 2, section: 'Rooftop', status: 'available' },
  { id: 'T-R02', number: 'R2', capacity: 4, section: 'Rooftop', status: 'available' },
  { id: 'T-R03', number: 'R3', capacity: 4, section: 'Rooftop', status: 'occupied', currentOrder: { id: 'ORD-103', itemsCount: 2, total: 450, time: '14:40' } },
  { id: 'T-R04', number: 'R4', capacity: 6, section: 'Rooftop', status: 'available' },
  { id: 'T-R05', number: 'R5', capacity: 2, section: 'Rooftop', status: 'reserved', reserveTime: '21:00' },
  { id: 'T-R06', number: 'R6', capacity: 4, section: 'Rooftop', status: 'available' },

  // Family Section Tables
  { id: 'T-F01', number: 'F1', capacity: 6, section: 'Family Section', status: 'available' },
  { id: 'T-F02', number: 'F2', capacity: 6, section: 'Family Section', status: 'occupied', currentOrder: { id: 'ORD-106', itemsCount: 8, total: 2450, time: '13:50' } },
  { id: 'T-F03', number: 'F3', capacity: 8, section: 'Family Section', status: 'available' },
  { id: 'T-F04', number: 'F4', capacity: 4, section: 'Family Section', status: 'available' },
  { id: 'T-F05', number: 'F5', capacity: 10, section: 'Family Section', status: 'reserved', reserveTime: '20:30' },
  { id: 'T-F06', number: 'F6', capacity: 6, section: 'Family Section', status: 'available' }
];

export const MENU_CATEGORIES = [
  'Soup',
  'Veg Starter',
  'Non-Veg Starter',
  'Chinese Starter',
  'Veg Main Course',
  'Non-Veg Main Course',
  'Beverages',
  'Desserts'
];

export const MENU_ITEMS = [
  // Soup
  { id: 'M-001', name: 'Manchow Soup Veg', price: 120, category: 'Soup', isVeg: true, popular: true, rating: 4.6, desc: 'Hot & spicy soup with crunchy deep-fried noodles' },
  { id: 'M-002', name: 'Hot & Sour Chicken Soup', price: 150, category: 'Soup', isVeg: false, popular: false, rating: 4.3, desc: 'Fiery chicken shreds in sour soy broth' },
  { id: 'M-003', name: 'Cream of Tomato Soup', price: 110, category: 'Soup', isVeg: true, popular: false, rating: 4.4, desc: 'Classic rich tomato cream broth with butter croutons' },

  // Veg Starter
  { id: 'M-010', name: 'Paneer Tikka Masala (Dry)', price: 240, category: 'Veg Starter', isVeg: true, popular: true, rating: 4.9, desc: 'Clay-oven chargrilled cottage cheese cubes in spices' },
  { id: 'M-011', name: 'Hara Bhara Kabab', price: 180, category: 'Veg Starter', isVeg: true, popular: false, rating: 4.2, desc: 'Deep-fried spinach, green peas, and potato patties' },
  { id: 'M-012', name: 'Mushroom Tandoori', price: 220, category: 'Veg Starter', isVeg: true, popular: true, rating: 4.5, desc: 'Plump spice-marinated button mushrooms roasted in tandoor' },

  // Non-Veg Starter
  { id: 'M-020', name: 'Chicken Tandoori (Half)', price: 280, category: 'Non-Veg Starter', isVeg: false, popular: true, rating: 4.8, desc: 'Classic red spice yogurt marinated chicken roasted on open charcoal' },
  { id: 'M-021', name: 'Chicken Tikka', price: 260, category: 'Non-Veg Starter', isVeg: false, popular: true, rating: 4.7, desc: 'Boneless tender chicken chunks grilled in authentic tandoori spices' },
  { id: 'M-022', name: 'Mutton Seekh Kabab', price: 340, category: 'Non-Veg Starter', isVeg: false, popular: false, rating: 4.4, desc: 'Spiced minced lamb skewers grilled to smoky perfection' },

  // Chinese Starter
  { id: 'M-030', name: 'Veg Manchurian Dry', price: 190, category: 'Chinese Starter', isVeg: true, popular: true, rating: 4.6, desc: 'Crisp vegetable balls tossed in dark soy garlic-chilli glaze' },
  { id: 'M-031', name: 'Paneer Chilli', price: 220, category: 'Chinese Starter', isVeg: true, popular: true, rating: 4.7, desc: 'Batter-fried paneer cubes in tangy oriental green-chilli sauce' },
  { id: 'M-032', name: 'Chicken Lollipop (6 Pcs)', price: 250, category: 'Chinese Starter', isVeg: false, popular: true, rating: 4.9, desc: 'Crispy fried chicken drumettes glazed in spicy Schezwan' },

  // Veg Main Course
  { id: 'M-040', name: 'Paneer Butter Masala', price: 260, category: 'Veg Main Course', isVeg: true, popular: true, rating: 4.9, desc: 'Soft paneer in rich, mildly sweet tomato, butter, cashew gravy' },
  { id: 'M-041', name: 'Kaju Curry', price: 280, category: 'Veg Main Course', isVeg: true, popular: false, rating: 4.5, desc: 'Roasted cashew nuts simmered in luxurious golden onion-tomato gravy' },
  { id: 'M-042', name: 'Veg Diwani Handi', price: 230, category: 'Veg Main Course', isVeg: true, popular: false, rating: 4.3, desc: 'Mixed garden vegetables cooked in mildly spiced spinach cashew gravy' },
  { id: 'M-043', name: 'Dal Tadka Double', price: 160, category: 'Veg Main Course', isVeg: true, popular: true, rating: 4.7, desc: 'Yellow lentils tempered twice with cumin, garlic, red chillies, and ghee' },

  // Non-Veg Main Course
  { id: 'M-050', name: 'Chicken Tikka Masala', price: 320, category: 'Non-Veg Main Course', isVeg: false, popular: true, rating: 4.8, desc: 'Grilled chicken chunks cooked in spiced, thick orange gravy' },
  { id: 'M-051', name: 'Butter Chicken (Murgh Makhani)', price: 340, category: 'Non-Veg Main Course', isVeg: false, popular: true, rating: 4.9, desc: 'Tandoori chicken shreds pulled and cooked in a silky buttery gravy' },
  { id: 'M-052', name: 'Mutton Rogan Josh', price: 420, category: 'Non-Veg Main Course', isVeg: false, popular: true, rating: 4.7, desc: 'Kashmiri style aromatic lamb curry cooked with red chillies & spices' },
  { id: 'M-053', name: 'Mejwani Special Chicken Rassa', price: 380, category: 'Non-Veg Main Course', isVeg: false, popular: true, rating: 4.9, desc: 'Our chef\'s signature hot and spicy rustic Maharashtrian chicken curry' },

  // Beverages
  { id: 'M-060', name: 'Fresh Lime Soda (Sweet & Salt)', price: 60, category: 'Beverages', isVeg: true, popular: false, rating: 4.4, desc: 'Fizzing fresh lime juice custom sweet and salted' },
  { id: 'M-061', name: 'Special Masala Chaas', price: 50, category: 'Beverages', isVeg: true, popular: true, rating: 4.7, desc: 'Refreshing spiced buttermilk flavored with coriander and cumin' },
  { id: 'M-062', name: 'Mango Lassi Premium', price: 90, category: 'Beverages', isVeg: true, popular: true, rating: 4.8, desc: 'Thick, creamy yogurt drink blended with Alphonso mango pulp' },
  { id: 'M-063', name: 'Mineral Water (1L)', price: 30, category: 'Beverages', isVeg: true, popular: false, rating: 4.1, desc: 'Chilled packaged drinking water bottle' },

  // Desserts
  { id: 'M-070', name: 'Sizzling Brownie with Ice Cream', price: 180, category: 'Desserts', isVeg: true, popular: true, rating: 4.9, desc: 'Hot chocolate fudge brownie served on hot sizzler iron plate with vanilla scoop' },
  { id: 'M-071', name: 'Gulab Jamun (2 Pcs)', price: 70, category: 'Desserts', isVeg: true, popular: true, rating: 4.8, desc: 'Warm sweet milk-solid balls soaked in cardamon sugar syrup' },
  { id: 'M-072', name: 'Matka Kulfi', price: 90, category: 'Desserts', isVeg: true, popular: false, rating: 4.6, desc: 'Traditional saffron-pistachio slow-reduced ice cream set in clay pot' }
];
