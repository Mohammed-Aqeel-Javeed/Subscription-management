// Payment card icon imports for configuration page - LOCAL HIGH QUALITY LOGOS
// All icons stored locally in /public/assets/payment-icons/ for offline reliability
const visa = '/assets/payment-icons/visa.svg';
const mastercard = '/assets/payment-icons/mastercard.svg';
const paypal = '/assets/payment-icons/paypal.svg';
const amex = '/assets/payment-icons/amex.svg';
const apple_pay = '/assets/payment-icons/apple-pay.svg';
const google_pay = '/assets/payment-icons/google-pay.svg';

// Generic payment types: colorful emoji SVGs stored locally
const bank = '/assets/payment-icons/bank.svg'; // 🏦 Bank
const cash = '/assets/payment-icons/cash.svg'; // 💵 Banknote
const other = '/assets/payment-icons/other.svg'; // 💳 Credit card

// Additional icons shown in your image
const user = 'https://cdn.jsdelivr.net/gh/twbs/icons@main/icons/person-circle.svg';
const notification = 'https://cdn.jsdelivr.net/gh/twbs/icons@main/icons/bell.svg';
const lock = 'https://cdn.jsdelivr.net/gh/twbs/icons@main/icons/lock.svg';

const cardImages = {
  visa,
  mastercard,
  paypal,
  amex,
  apple_pay,
  google_pay,
  bank,
  cash,
  other,
  user,
  notification,
  lock,
};

export { cardImages };
export type CardImageKey = keyof typeof cardImages;