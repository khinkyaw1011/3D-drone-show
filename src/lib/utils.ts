export { cn } from "cn"

/**
 * Group digits the same way on the server and in every browser. Locale-aware number
 * formatting disagrees between Node and browsers for some locales (Burmese numerals),
 * which breaks hydration, and the UI sets numbers in a Latin mono face anyway.
 */
export const formatNumber = (value: number) => value.toLocaleString('en-US');
