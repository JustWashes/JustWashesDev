const { supabase } = require('../supabaseClient');

module.exports = async (req, res) => {
  try {
    const { startDate, endDate, zip } = req.query;

    let q = supabase
      .from('washer_availability')
      .select(`
        id,
        washer_id,
        service_date,
        start_time,
        end_time,
        location,
        status,
        max_bookings,
        current_bookings,
        washer:washers (
          id,
          display_name,
          phone
        )
      `)
      .eq('status', 'open')
      .order('service_date', { ascending: true })
      .order('start_time', { ascending: true });

    if (startDate) q = q.gte('service_date', startDate);
    if (endDate) q = q.lte('service_date', endDate);
    if (zip) q = q.eq('location', zip);

    const { data, error } = await q;

    if (error) {
      console.error('Supabase error in adminAvailability:', error);
      return res.status(500).json({ error: 'Failed to load availability', details: error.message });
    }

    return res.json({ availability: data || [] });
  } catch (e) {
    console.error('Unexpected error in adminAvailability:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
};
