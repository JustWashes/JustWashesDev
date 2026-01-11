// server/api/bookings.js
const { supabase } = require('../supabaseClient');

const toISODate = d => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const monthRangeForDate = dateISO => {
  const d = new Date(`${dateISO}T00:00:00`);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const {
      sharetribe_user_id,
      location,
      service_date, // YYYY-MM-DD
      start_time,   // HH:MM:SS or HH:MM
      end_time,     // HH:MM:SS or HH:MM
      vehicle_count,
      mode,         // 'auto' | 'specific'
      washer_id,    // required if mode === 'specific'
    } = req.body || {};

    const userId = String(sharetribe_user_id || '').trim();
    const z = String(zip || '').trim();
    const dateISO = String(service_date || '').trim();

    if (!userId || !z || !dateISO || !start_time || !end_time) {
      return res.status(400).json({
        error: 'missing_required_fields',
        message: 'sharetribe_user_id, zip, service_date, start_time, end_time are required',
      });
    }

    // ---------- credits check (basic) ----------
    // If you want to hard-block booking when 0 credits, do it here.
    const { data: creditRows, error: creditsError } = await supabase
      .from('subscription_credits')
      .select('*')
      .eq('sharetribe_user_id', userId)
      .limit(1);

    if (creditsError) {
      console.error('Supabase credits check error:', creditsError);
      // don’t hard fail on credits table issues in dev
    } else {
      const row = creditRows?.[0];
      if (row && typeof row.credits_remaining === 'number' && row.credits_remaining <= 0) {
        return res.status(409).json({
          error: 'no_credits',
          message: 'No credits remaining. Please upgrade your plan.',
        });
      }
    }

    // Normalize times to HH:MM:SS
    const normStart = String(start_time).length === 5 ? `${start_time}:00` : String(start_time);
    const normEnd = String(end_time).length === 5 ? `${end_time}:00` : String(end_time);

    // Find all availability blocks matching this ZIP/date/time with capacity remaining
    const { data: blocks, error: blocksError } = await supabase
      .from('washer_availability')
      .select(
        `
        id,
        washer_id,
        service_date,
        start_time,
        end_time,
        location,
        status,
        max_bookings,
        current_bookings
      `
      )
      .eq('location', z)
      .eq('service_date', dateISO)
      .eq('start_time', normStart)
      .eq('end_time', normEnd)
      .eq('status', 'open');

    if (blocksError) {
      console.error('Supabase availability lookup error:', blocksError);
      return res.status(500).json({
        error: 'availability_lookup_failed',
        details: blocksError.message || blocksError,
      });
    }

    const candidates = (blocks || []).filter(b => (b.current_bookings || 0) < (b.max_bookings || 0));

    if (!candidates.length) {
      return res.status(409).json({
        error: 'no_capacity',
        message: 'No availability remaining for that time slot.',
      });
    }

    // Determine washer assignment
    let chosenWasherId = null;
    let chosenAvailabilityId = null;

    const desiredMode = mode === 'specific' ? 'specific' : 'auto';

    if (desiredMode === 'specific') {
      const requestedWasherId = String(washer_id || '').trim();
      if (!requestedWasherId) {
        return res.status(400).json({
          error: 'missing_washer_id',
          message: 'washer_id is required when mode=specific',
        });
      }
      const match = candidates.find(c => c.washer_id === requestedWasherId);
      if (!match) {
        return res.status(409).json({
          error: 'washer_not_available',
          message: 'Selected technician does not have capacity for this slot.',
        });
      }
      chosenWasherId = match.washer_id;
      chosenAvailabilityId = match.id;
    } else {
      // AUTO: fairness by "completed washes in this ZIP/month"
      const { startISO, endISO } = monthRangeForDate(dateISO);

      // Count completed washes per washer in that ZIP for the month
      const { data: completedRows, error: completedError } = await supabase
        .from('washes')
        .select('washer_id, status, scheduled_start, location_id')
        .eq('location_id', z)
        .eq('status', 'completed')
        .gte('scheduled_start', startISO)
        .lt('scheduled_start', endISO);

      if (completedError) {
        console.error('Supabase completed wash count error:', completedError);
        // If this fails, we still can pick deterministically among candidates
      }

      const counts = new Map(); // washer_id -> completed count
      (completedRows || []).forEach(r => {
        if (!r.washer_id) return;
        counts.set(r.washer_id, (counts.get(r.washer_id) || 0) + 1);
      });

      // Choose candidate washer with minimum count
      const sorted = [...candidates].sort((a, b) => {
        const ca = counts.get(a.washer_id) || 0;
        const cb = counts.get(b.washer_id) || 0;
        if (ca !== cb) return ca - cb;
        // stable tie-breaker
        return String(a.washer_id).localeCompare(String(b.washer_id));
      });

      chosenWasherId = sorted[0].washer_id;
      chosenAvailabilityId = sorted[0].id;
    }

    // Reserve capacity: increment current_bookings for chosenAvailabilityId
    // (dev-safe; not fully race-proof, but fine for now)
    const chosen = candidates.find(c => c.id === chosenAvailabilityId);
    if (!chosen) {
      return res.status(409).json({ error: 'availability_not_found', message: 'Availability changed.' });
    }
    if ((chosen.current_bookings || 0) >= (chosen.max_bookings || 0)) {
      return res.status(409).json({ error: 'capacity_full', message: 'Slot just filled. Try again.' });
    }

    const newBookings = (chosen.current_bookings || 0) + 1;
    const { error: updateError } = await supabase
      .from('washer_availability')
      .update({ current_bookings: newBookings })
      .eq('id', chosenAvailabilityId);

    if (updateError) {
      console.error('Supabase reserve capacity error:', updateError);
      return res.status(500).json({
        error: 'reserve_failed',
        details: updateError.message || updateError,
      });
    }

    // Insert wash
    const scheduledStart = new Date(`${dateISO}T${normStart.slice(0, 5)}:00`).toISOString();
    const scheduledEnd = new Date(`${dateISO}T${normEnd.slice(0, 5)}:00`).toISOString();

    const insertPayload = {
      sharetribe_user_id: userId,
      washer_id: chosenWasherId,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      location_id: z, // ZIP for now
      vehicle_count: vehicle_count || 1,
      status: 'scheduled',
    };

    const { data: wash, error: insertError } = await supabase
      .from('washes')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      console.error('Supabase insert wash error:', insertError);
      return res.status(500).json({
        error: 'create_wash_failed',
        details: insertError.message || insertError,
      });
    }

    // OPTIONAL: decrement credits (you can decide policy later)
    // In dev, I’m not mutating credits automatically because you may want to consume on completion instead.

    return res.status(201).json({
      ok: true,
      wash,
      assigned: {
        washer_id: chosenWasherId,
        availability_id: chosenAvailabilityId,
        mode: desiredMode,
      },
    });
  } catch (e) {
    console.error('Unexpected error in /api/bookings:', e);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: e.message || e,
    });
  }
};
