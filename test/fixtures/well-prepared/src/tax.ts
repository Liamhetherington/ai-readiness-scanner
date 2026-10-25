export const withTax = (cents: number, rate: number): number => Math.round(cents * (1 + rate));
