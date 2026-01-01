const { supabase } = require('../supabaseClient');

module.exports = async (req, res) => {
  try {
    const userId = req.query.userId || null;

    let query = supabase
      .from('washes')
      .select('*')
      .order('scheduled_start', { ascending: true });

    if (userId) {
      // 🔹 Use the actual column name in your table
      query = query.eq('sharetribe_user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error in /api/dashboard:', error);
      return res.status(500).json({
        error: 'Failed to load dashboard data',
        details: error.message || error,
      });
    }

    const now = new Date();
    const upcoming = [];
    const past = [];

    (data || []).forEach(row => {
      const dtRaw = row.scheduled_start || row.scheduled_end;
      const dt = dtRaw ? new Date(dtRaw) : null;
      const bucket = dt && dt >= now ? upcoming : past;

      const mapped = {
        id: row.id,
        date: dt ? dt.toLocaleDateString() : '',
        time: dt
          ? dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : '',
        location: row.location_id || '',
        washerName: row.washer_id || '',
        washerPhone: row.washer_phone || '',
        status: row.status,
        vehicleCount: row.vehicle_count,
      };

      bucket.push(mapped);
    });

     // --- NEW: credits query ---
    const { data: creditRows, error: creditsError } = await supabase
      .from('subscription_credits')
      .select('*')
      .eq('sharetribe_user_id', userId)
      .limit(1);

    if (creditsError) {
      console.error('Supabase error (credits):', creditsError);
      // don't hard-fail dashboard, just log and return null credits
    }

    let creditsPayload = null;
    if (creditRows && creditRows.length > 0) {
      const row = creditRows[0];
      creditsPayload = {
        remaining: row.credits_remaining,
        planLabel: row.plan_label,
      };
    }



    return res.json({ upcoming, past,
                     credits: creditsPayload });
  } catch (e) {
    console.error('Unexpected error in /api/dashboard:', e);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: e.message || e,
    });
  }
};
