import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Public } from '../security/guards.js';
import { validate, validId } from '../security/validation.js';
import { StorefrontService } from './storefront.service.js';
import { CheckoutService } from './checkout.service.js';
import { checkoutOrder, checkoutQuote, receiptRequest } from './checkout.validation.js';
import { query, slug } from './query.js';
@Controller('catalog')
@Public()
export class StorefrontController {
  constructor(
    @Inject(StorefrontService) readonly catalog: StorefrontService,
    @Inject(CheckoutService) readonly checkout: CheckoutService,
  ) {}
  @Get('checkout/config') checkoutConfig() {
    return this.checkout.configuration();
  }
  @Post('checkout/quote') @HttpCode(200) quote(@Body() body: unknown) {
    const input = validate(checkoutQuote, body);
    return this.checkout.quote(input.items, input.couponCode);
  }
  @Post('orders') createOrder(@Req() request: Request, @Body() body: unknown) {
    return this.checkout.create(validate(checkoutOrder, body), request.get('origin'));
  }
  @Post('orders/receipt') @HttpCode(200) receipt(@Body() body: unknown) {
    const input = validate(receiptRequest, body);
    return this.checkout.readReceipt(input.orderNumber, input.receiptToken);
  }
  @Get('navigation') navigation(@Query() q: unknown) {
    validate(z.object({}).strict(), q);
    return this.catalog.navigation();
  }
  @Get('homepage') homepage(@Query() q: unknown) {
    validate(z.object({}).strict(), q);
    return this.catalog.homepage();
  }
  @Get('listings') listings(@Query() q: unknown) {
    return this.catalog.list(validate(query, q));
  }
  @Get('routes/:slug') route(@Param('slug') s: string, @Query() q: unknown) {
    validate(z.object({}).strict(), q);
    return this.catalog.route(validate(slug, s));
  }
  @Get('products/:slug') product(
    @Param('slug') s: string,
    @Query() q: unknown,
  ) {
    const input = validate(
      z
        .object({
          variant: z
            .string()
            .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/)
            .optional(),
        })
        .strict(),
      q,
    );
    return this.catalog.detail(validate(slug, s), input.variant);
  }
  @Get('media/:slug/:asset') async media(
    @Param('slug') s: string,
    @Param('asset') a: string,
    @Query() q: unknown,
    @Res() r: Response,
  ) {
    const input = validate(
      z
        .object({
          width: z.coerce
            .number()
            .refine((v) => [320, 640, 1280, 1920].includes(v))
            .default(640),
        })
        .strict(),
      q,
    );
    const bytes = await this.catalog.media(
      validate(slug, s),
      validId(a),
      input.width,
    );
    r.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }).send(bytes);
  }
}
