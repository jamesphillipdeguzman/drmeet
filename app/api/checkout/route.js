import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'PAYMONGO_SECRET_KEY is not configured.' },
        { status: 500 }
      );
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
          success_url: 'https://mydrmeet.netlify.app/pricing?success=true',
          cancel_url: 'https://mydrmeet.netlify.app/pricing',
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
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || 'Failed to create PayMongo checkout session', details: data },
        { status: response.status }
      );
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Checkout URL not returned from PayMongo.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkout_url: checkoutUrl, checkoutUrl: checkoutUrl }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
