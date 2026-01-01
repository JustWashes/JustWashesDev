// server/api/adminCreateWash.js
const { supabase } = require('../supabaseClient');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
      sharetribe_user_id,
      subscription_id,
      washer_id,             // ✅ actual column in your table
      status,
      scheduled_start,
      scheduled_end,
      location_id,
      vehicle_count,
      special_instructions,
    } = req.body || {};

    // Basic validation
    if (!sharetribe_user_id || !scheduled_start || !location_id) {
      return res.status(400).json({
        error: 'Missing required fields',
        details:
          'sharetribe_user_id, scheduled_start and location_id are required.',
      });
    }

    const insertPayload = {
      sharetribe_user_id,
      subscription_id: subscription_id || null,
      washer_id: washer_id || null,          // ✅ now defined
      status: status || 'scheduled',
      scheduled_start,                       // ISO string is fine
      scheduled_end: scheduled_end || null,
      location_id,
      vehicle_count: vehicle_count || 1,
      special_instructions: special_instructions || null,
      late_cancellation_fee_applied: false,
    };

    const { data, error } = await supabase
      .from('washes')
      .insert([insertPayload])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating wash:', error);
      return res.status(500).json({
        error: 'Failed to create wash',
        details: error.message || error,
      });
    }

    return res.status(201).json({ wash: data });
  } catch (e) {
    console.error('Unexpected error in adminCreateWash:', e);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: e.message || e,
    });
  }
};
