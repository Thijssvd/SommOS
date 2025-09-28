'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { guidanceRecommendations } = require('../core/wine_guidance_service');
const { analyzeProcurement } = require('../core/procurement_engine');

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true, api: 'v1', ts: Date.now() }));

const GuidanceSchema = z.object({
  grape: z.string().trim().min(1).optional(),
  style: z.enum(['red','white','rosé','rose','sparkling','orange','dessert','fortified']).optional(),
  pairing: z.string().trim().min(1).optional(),
  budget: z.number().finite().nonnegative().optional(),
  region: z.string().trim().min(1).optional(),
  vintage: z.number().int().gte(1900).lte(new Date().getFullYear()).optional(),
  weather: z.object({
    tempC: z.number().finite(),
    condition: z.string().trim().min(1).optional()
  }).optional()
});

router.post('/guidance', (req, res, next) => {
  const parse = GuidanceSchema.safeParse(req.body || {});
  if (!parse.success) {
    const err = new Error(parse.error.issues.map(i => i.message).join('; '));
    err.statusCode = 422;
    return next(err);
  }
  const input = parse.data;
  if (input.style === 'rose') input.style = 'rosé';
  const out = guidanceRecommendations(input);
  res.json({ input, recommendations: out });
});

const ProcurementSchema = z.object({
  currency: z.string().trim().toUpperCase().default('EUR'),
  maxPerBottle: z.number().finite().nonnegative().optional(),
  requests: z.array(z.object({
    label: z.string().trim().min(1),
    targetPrice: z.number().finite().nonnegative(),
    qty: z.number().int().nonnegative()
  })).max(100).default([])
});

router.post('/procurement/analyze', (req, res, next) => {
  const parse = ProcurementSchema.safeParse(req.body || {});
  if (!parse.success) {
    const err = new Error(parse.error.issues.map(i => i.message).join('; '));
    err.statusCode = 422;
    return next(err);
  }
  const input = parse.data;
  const out = analyzeProcurement(input);
  res.json({ input, analysis: out });
});

module.exports = router;
