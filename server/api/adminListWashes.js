// server/api/adminListWashes.js
const { supabase } = require('../supabaseClient');

module.exports = async (req, res) => {
  try {
    // Optional limit query param: /api/admin/washes?limit=50
    const limit = parseInt(req.query.limit, 10) || 25;

    const { data, error } = await supabase
      .from('washes')
      .select('*')
      .order('scheduled_start', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase error listing washes:', error);
      return res.status(500).json({
        error: 'Failed to load washes',
        details: error.message || error,
      });
    }

    return res.json({ washes: data || [] });
  } catch (e) {
    console.error('Unexpected error in adminListWashes:', e);
    return res.status(500).json({
      error: 'Unexpected server error',
      details: e.message || e,
    });
  }
};
