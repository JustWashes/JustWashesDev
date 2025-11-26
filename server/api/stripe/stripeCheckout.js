// server/api/stripe/stripeCheckout.js

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const { plan, email } = req.body;

    const priceMap = {
      monthly: 'price_monthly_123',
      bimonthly: 'price_bi_456',
      quarterly: 'price_quarter_789',
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      payment_method_types: ['card'],
      line_items: [{ price: priceMap[plan], quantity: 1 }],
      success_url: 'http://localhost:3000/payment-success',
      cancel_url: 'http://localhost:3000/choose-subscription',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe error' });
  }
};
