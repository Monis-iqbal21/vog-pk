import { z } from 'zod';

const line = z.object({
  listingId: z.uuid(),
  skuCode: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  quantity: z.number().int().min(1).max(50),
}).strict();

export const cartLines = z.array(line).min(1).max(20)
  .refine((items) => new Set(items.map((item) => `${item.listingId}:${item.skuCode}`)).size === items.length,
    'Each product variant may appear only once.');

export const checkoutOrder = z.object({
  idempotencyKey: z.uuid(),
  items: cartLines,
  customerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?\d[\d ()-]{7,24}$/),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(8).max(500),
  paymentMethod: z.enum(['COD', 'CARD']),
  couponCode: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).strict();
export const checkoutQuote = z.object({ items: cartLines, couponCode: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/).optional() }).strict();

export const receiptRequest = z.object({
  orderNumber: z.string().regex(/^VOG-[0-9]{6}-[A-F0-9]{20}$/),
  receiptToken: z.uuid(),
}).strict();

export type CartLines = z.infer<typeof cartLines>;
export type CheckoutOrder = z.infer<typeof checkoutOrder>;
