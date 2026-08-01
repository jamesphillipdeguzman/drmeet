import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import { PRICING_TIERS } from '../utils/planLimits.js';

const router = express.Router();

// Simulated checkout session creation (PayMongo / Stripe style)
router.post('/create-session', hybridAuth, (req, res) => {
  const { planTier } = req.body;
  const validPlans = Object.values(PRICING_TIERS);

  if (!planTier || !validPlans.includes(planTier)) {
    return res.status(400).json({ error: 'Invalid or missing subscription plan tier.' });
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://mydrmeet.netlify.app';
  const checkoutSession = {
    id: `cs_test_${Date.now()}`,
    planTier,
    checkoutUrl: `https://checkout.paymongo.com/pay/${Date.now()}?plan=${planTier}`,
    successUrl: `${clientOrigin}/#pricing?payment=success&tier=${planTier}`,
    cancelUrl: `${clientOrigin}/#pricing?payment=cancelled`,
  };

  res.status(201).json(checkoutSession);
});

// Simulated PayMongo webhook endpoint
router.post('/webhook', (req, res) => {
  const { eventType, data } = req.body || {};

  if (!eventType || eventType !== 'checkout.session.completed') {
    return res.status(200).json({ received: true, processed: false });
  }

  const { doctorId, planTier } = data || {};
  return res.status(200).json({
    received: true,
    processed: true,
    message: `Doctor ${doctorId} upgraded to ${planTier} plan.`,
  });
});

export default router;
