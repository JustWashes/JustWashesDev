// server/api/availability.js
const { supabase } = require('../supabaseClient');

/**
 * GET /api/availability
 *
 * Supports:
 *  - ?zip=38655&date=2026-01-05
 *      -> returns time slots (aggregated) for that day in that ZIP
 *
 *  - ?zip=38655&startDate=2026-01-01&endDate=2026-01-31
 *      -> returns daily summary (how many open blocks exist each day) for month highlighting
 *
 * Output shapes:
 *  - day mode:
 *      { zip, date, slots: [{ availability_ids:[], start_time, end_time, open_blocks, total_capacity_remaining, washers:[{id, name, phone}] }] }
 *  - range mode:
 *      { zip, startDate, endDate, days:[{ date, open_blocks }] }
 */
module.exports = async (req, res) => {
  try {
    const zip = String(req.query.zip || '').trim();
    const date = req.query.date ? String(req.query.date).trim() : null;
    const startDate = req.query.startDate ? String(req.query.startDate).trim() : null;
    const endDate = req.query.endDate ? String(req.query.endDate).trim() : null;

    if (!zip) {
      return res.status(400).json({ error: 'missing_zip', message: 'zip is required' });
    }

    // ---------- RANGE MODE (month summary) ----------
    if (!date && startDate && endDate) {
      const { data, error } = await supabase
        .from('washer_availability')
        .select(
          `
          id,
          service_date,
          location,
          status,
          max_bookings,
          current_bookings
        `
        )
        .eq('location', zip)
        .gte('service_date', startDate)
        .lte('service_date', endDate);

      if (error) {
        console.error('Supabase error in /api/availability (range):', error);
        return res.status(500).json({
          error: 'availability_range_failed',
          details: error.message || error,
        });
      }

      // Count open blocks per day where capacity remains
      const map = new Map(); // date -> open_blocks
      (data || []).forEach(r => {
        const hasCapacity =
          typeof r.max_bookings === 'number' &&
          typeof r.current_bookings === 'number' &&
          r.current_bookings < r.max_bookings;

        if (r.status !== 'open' || !hasCapacity) return;

        const key = r.service_date;
        map.set(key, (map.get(key) || 0) + 1);
      });

      const days = Array.from(map.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([d, count]) => ({ date: d, open_blocks: count }));

      return res.json({ zip, startDate, endDate, days });
    }

    // ---------- DAY MODE (slots for a specific date) ----------
    if (!date) {
      return res.status(400).json({
        error: 'missing_date',
        message: 'Provide either date OR (startDate and endDate).',
      });
    }

    const { data, error } = await supabase
      .from('washer_availability')
      .select(
        `
        id,
        service_date,
        start_time,
        end_time,
        location,
        status,
        max_bookings,
        current_bookings,
        washer_id,
        washers (
          id,
          display_name,
          phone
        )
      `
      )
      .eq('location', zip)
      .eq('service_date', date)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Supabase error in /api/availability (day):', error);
      return res.status(500).json({
        error: 'availability_day_failed',
        details: error.message || error,
      });
    }

    // Aggregate by time window (start_time + end_time)
    const slotMap = new Map();
    (data || []).forEach(r => {
      const hasCapacity =
        typeof r.max_bookings === 'number' &&
        typeof r.current_bookings === 'number' &&
        r.current_bookings < r.max_bookings;

      if (r.status !== 'open' || !hasCapacity) return;

      const key = `${r.start_time}-${r.end_time}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          availability_ids: [],
          start_time: r.start_time,
          end_time: r.end_time,
          open_blocks: 0,
          total_capacity_remaining: 0,
          washers: [],
        });
      }

      const slot = slotMap.get(key);
      slot.availability_ids.push(r.id);
      slot.open_blocks += 1;
      slot.total_capacity_remaining += Math.max(0, (r.max_bookings || 0) - (r.current_bookings || 0));
      slot.washers.push({
        id: r.washer_id,
        name: r.washers?.display_name || '',
        phone: r.washers?.phone || '',
        availability_id: r.id,
      });
    });

    const slots = Array.from(slotMap.values()).sort((a, b) =>
      String(a.start_time).localeCompare(String(b.start_time))
    );

    return res.json({ zip, date, slots });
  } catch (e) {
    console.error('Unexpected error in /api/availability:', e);
    return res.status(500).json({
      error: 'unexpected_error',
      details: e.message || e,
    });
  }
};
