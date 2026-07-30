import express from 'express';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      console.error('[Checkout Route Error] PAYMONGO_SECRET_KEY is missing');
      return res.status(500).json({ error: 'PAYMONGO_SECRET_KEY is not configured.' });
    }

    const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

    const payload = {
      data: {
        attributes: {
          line_items: [
            {
              currency: 'PHP',
              amount: 249900,
              name: 'Clinic Pro Plan',
              description: 'Dr. Meet Clinic Pro Subscription',
              quantity: 1,
            },
          ],
          payment_method_types: ['card', 'gcash', 'paymaya'],
          success_url: 'https://mydrmeet.netlify.app/#pricing?success=true',
          cancel_url: 'https://mydrmeet.netlify.app/#pricing',
        },
      },
    };

    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[PayMongo Error]', data);
      return res.status(response.status).json({
        error: data.errors?.[0]?.detail || 'Failed to create PayMongo checkout session',
        details: data,
      });
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'Checkout URL not returned from PayMongo.' });
    }

    return res.status(200).json({
      checkout_url: checkoutUrl,
      checkoutUrl: checkoutUrl,
    });
  } catch (err) {
    console.error('[Checkout Route Exception]', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
