import { z } from "zod";

const PK_MOBILE_RE = /^(?:\+92|0)3\d{9}$/;

export const SignupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters.").max(100).trim(),
  email: z.string().email("Invalid email address.").toLowerCase(),
  phone: z.string().refine(
    (v) => PK_MOBILE_RE.test(v.replace(/[\s-]/g, "")),
    { message: "Enter a valid Pakistani mobile number (e.g. 03001234567)." }
  ),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const LoginSchema = z.object({
  email: z.string().email("Invalid email address.").toLowerCase(),
  password: z.string().min(1, "Password is required.").max(128),
});

export const AddressSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  line1: z.string().min(5).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(100),
  province: z.string().min(2).max(100),
});

export const CartLineSchema = z.object({
  productId: z.string().uuid("Invalid product ID."),
  quantity: z.number().int().min(1).max(50),
  unit: z.enum(["suit", "meter"]),
  stitching: z.enum(["none", "bespoke"]),
  color: z.string().min(1).max(50),
});

export const PlaceOrderSchema = z.object({
  lines: z.array(CartLineSchema).min(1, "Cart is empty.").max(20),
  address: AddressSchema,
  paymentMethod: z.enum(["cod", "bank_transfer"]),
  otpVerified: z.boolean(),
});

export const PriceSchema = z.number().finite().min(100).max(1_000_000);
