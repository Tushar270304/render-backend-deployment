const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const auth = require('../middleware/auth'); // ✅ Import auth
// Helper: Convert numeric type to string
function getCallType(type) {
  switch (type) {
    case 1: return 'INCOMING';
    case 2: return 'OUTGOING';
    case 3: return 'MISSED';
    case 5: return 'REJECTED';
    default: return 'UNKNOWN';
  }
}

// ✅ POST: Save new logs with deduplication
router.post('/', auth, async (req, res) => {
  try {
    const logs = req.body.logs || [];
    const deviceId = req.body.device || '';
    const location = req.body.location || '';

    if (!logs.length) {
      return res.status(400).json({ success: false, message: 'No logs provided' });
    }

    const bulkOps = [];

    for (const log of logs) {
      const callType = getCallType(log.type);
      const timestamp = new Date(log.date);

      bulkOps.push({
        updateOne: {
          filter: {
            deviceId,
            clientNumber: log.number,
            callType,
            timestamp
          },
          update: {
            $setOnInsert: {
              deviceId,
              callerName: log.name || '',
              clientNumber: log.number,
              callType,
              duration: log.duration,
              timestamp,
              location,
              status: ''
            }
          },
          upsert: true
        }
      });
    }

    if (bulkOps.length > 0) {
      const result = await CallLog.bulkWrite(bulkOps, { ordered: false });
      const inserted = result.upsertedCount || 0;

      console.log(`📥 ${inserted} new log(s) saved from ${deviceId}`);
      return res.json({ success: true, message: `${inserted} new logs saved.` });
    } else {
      return res.json({ success: true, message: 'No new logs to save.' });
    }

  } catch (err) {
    console.error('❌ Error saving logs:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ GET: Retrieve logs with filters
router.get('/', auth, async (req, res) => {
  try {
    const { from, to, callType, deviceId, location, clientNumber } = req.query;
    const query = {};

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.timestamp.$lte = toDate;
      }
    }

    if (callType) query.callType = callType.toUpperCase();
    if (deviceId) query.deviceId = deviceId;
    if (location) query.location = location;
    if (clientNumber) {
      query.clientNumber = { $regex: clientNumber, $options: 'i' };
    }

    const logs = await CallLog.find(query).sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    console.error('❌ Error fetching logs:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ PUT: Update status (remark/note) of a call log
router.put('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || typeof status !== 'string') {
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }

  try {
    const updated = await CallLog.findByIdAndUpdate(id, { status }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Call log not found' });
    }

    res.json({ success: true, message: 'Status updated', data: updated });
  } catch (err) {
    console.error('❌ Error updating status:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
