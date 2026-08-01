import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import { PRICING_TIERS } from '../utils/planLimits.js';

const router = express.Router();

const handleCheckoutSession = (req, res) => {
  const planTier = req.body?.planTier || req.body?.plan || 'pro';
  const validPlans = Object.values(PRICING_TIERS);

  if (!validPlans.includes(planTier)) {
    return res.status(400).json({ error: 'Invalid subscription plan tier.' });
  }

  const clientOrigin = process.env.CLIENT_ORIGIN || 'https://mydrmeet.netlify.app';
  const checkoutUrl = `https://checkout.paymongo.com/pay/${Date.now()}?plan=${planTier}`;
  const checkoutSession = {
    id: `cs_test_${Date.now()}`,
    planTier,
    checkoutUrl,
    checkout_url: checkoutUrl,
    successUrl: `${clientOrigin}/#pricing?payment=success&tier=${planTier}`,
    cancelUrl: `${clientOrigin}/#pricing?payment=cancelled`,
  };

  res.status(201).json(checkoutSession);
};

// Handle both POST /api/checkout and POST /api/checkout/create-session
router.post('/', hybridAuth, handleCheckoutSession);
router.post('/create-session', hybridAuth, handleCheckoutSession);

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
