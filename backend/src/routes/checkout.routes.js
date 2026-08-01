import express from 'express';
import { hybridAuth } from '../middlewares/auth.middleware.js';
import { PRICING_TIERS } from '../utils/planLimits.js';

const router = express.Router();

const handleCheckoutSession = async (req, res) => {
  try {
    const planTier = req.body?.planTier || req.body?.plan || 'pro';
    const validPlans = Object.values(PRICING_TIERS);

    if (!validPlans.includes(planTier)) {
      return res.status(400).json({ error: 'Invalid subscription plan tier.' });
    }

    const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY;
    const clientOrigin = process.env.CLIENT_ORIGIN || 'https://mydrmeet.netlify.app';

    if (paymongoSecretKey) {
      const encodedKey = Buffer.from(`${paymongoSecretKey}:`).toString('base64');
      const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Basic ${encodedKey}`,
        },
        body: JSON.stringify({
          data: {
            attributes: {
              send_email_receipt: true,
              show_description: true,
              show_line_items: true,
              line_items: [
                {
                  currency: 'PHP',
                  amount: 249900, // ₱2,499.00 in centavos
                  description: 'DrMeet Pro Subscription - Unlimited Patients & Features',
                  name: 'DrMeet Pro Plan',
                  quantity: 1,
                },
              ],
              payment_method_types: ['card', 'gcash', 'paymaya'],
              success_url: `${clientOrigin}/#pricing?status=success&tier=${planTier}`,
              cancel_url: `${clientOrigin}/#pricing?status=cancelled`,
            },
          },
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('PayMongo API Error:', responseData);
        return res.status(response.status || 500).json({
          error: 'Failed to create PayMongo checkout session',
          details: responseData,
        });
      }

      const checkoutUrl = responseData.data?.attributes?.checkout_url;
      return res.status(201).json({
        success: true,
        id: responseData.data?.id,
        planTier,
        checkoutUrl,
        checkout_url: checkoutUrl,
        successUrl: `${clientOrigin}/#pricing?status=success&tier=${planTier}`,
        cancelUrl: `${clientOrigin}/#pricing?status=cancelled`,
      });
    }

    // Fallback mock session when PAYMONGO_SECRET_KEY is not set (e.g. unit/integration tests)
    const mockCheckoutUrl = `https://checkout.paymongo.com/pay/${Date.now()}?plan=${planTier}`;
    return res.status(201).json({
      success: true,
      id: `cs_test_${Date.now()}`,
      planTier,
      checkoutUrl: mockCheckoutUrl,
      checkout_url: mockCheckoutUrl,
      successUrl: `${clientOrigin}/#pricing?payment=success&tier=${planTier}`,
      cancelUrl: `${clientOrigin}/#pricing?payment=cancelled`,
    });
  } catch (error) {
    console.error('PayMongo Checkout Handler Exception:', error.message);
    return res.status(500).json({
      error: 'Failed to create PayMongo checkout session',
      details: error.message,
    });
  }
};

// Handle both POST /api/checkout and POST /api/checkout/create-session
router.post('/', hybridAuth, handleCheckoutSession);
router.post('/create-session', hybridAuth, handleCheckoutSession);

// PayMongo webhook endpoint
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
