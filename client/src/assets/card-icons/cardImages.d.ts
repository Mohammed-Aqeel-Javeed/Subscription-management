declare const cardImages: {
    visa: string;
    mastercard: string;
    paypal: string;
    amex: string;
    apple_pay: string;
    google_pay: string;
    bank: string;
    cash: string;
    other: string;
    user: string;
    notification: string;
    lock: string;
};
export { cardImages };
export type CardImageKey = keyof typeof cardImages;
