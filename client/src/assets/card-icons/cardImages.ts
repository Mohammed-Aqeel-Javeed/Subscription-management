// Payment card icon imports for configuration page
// High-quality public icon URLs with better reliability
const visa = 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@9/icons/visa.svg';
const mastercard = 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@9/icons/mastercard.svg';
const paypal = 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@9/icons/paypal.svg';
const amex = 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@9/icons/americanexpress.svg';
const apple_pay = 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@9/icons/applepay.svg';
const google_pay = 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons@9/icons/googlepay.svg';
const bank = 'https://cdn.jsdelivr.net/gh/twbs/icons@main/icons/bank.svg';
const cash = 'https://cdn.jsdelivr.net/gh/twbs/icons@main/icons/cash-coin.svg';
const other = 'https://cdn.jsdelivr.net/gh/twbs/icons@main/icons/question-circle.svg';

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