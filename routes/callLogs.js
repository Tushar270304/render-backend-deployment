const express = require("express");
const router = express.Router();
const CallLog = require("../models/CallLog");
const auth = require("../middleware/auth");
const AWS = require("aws-sdk");
require("dotenv").config();

// Helper: Convert numeric type to string
function getCallType(type) {
  switch (type) {
    case 1:
      return "INCOMING";
    case 2:
      return "OUTGOING";
    case 3:
      return "MISSED";
    case 5:
      return "REJECTED";
    default:
      return "UNKNOWN";
  }
}

router.post("/", auth, async (req, res) => {
  try {
    const logs = req.body.logs || [];
    const deviceId = req.body.device || "";
    const location = req.body.location || "";

    if (!logs.length) {
      return res
        .status(400)
        .json({ success: false, message: "No logs provided" });
    }

    const bulkOps = logs.map((log) => {
      const callType = getCallType(log.type);
      const timestamp = new Date(log.date);

      return {
        updateOne: {
          filter: {
            deviceId,
            clientNumber: log.number,
            callType,
            timestamp,
          },
          update: {
            $setOnInsert: {
              deviceId,
              callerName: log.name || "",
              clientNumber: log.number,
              callType,
              duration: log.duration,
              timestamp,
              location,
              status: "",
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      const result = await CallLog.bulkWrite(bulkOps, { ordered: false });
      const inserted = result.upsertedCount || 0;
      console.log(`📥 ${inserted} new log(s) saved from ${deviceId}`);
      return res.json({
        success: true,
        message: `${inserted} new logs saved.`,
      });
    } else {
      return res.json({ success: true, message: "No new logs to save." });
    }
  } catch (err) {
    console.error("❌ Error saving logs:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ GET: Retrieve logs with filters
router.get("/", auth, async (req, res) => {
  try {
    const {
      from,
      to,
      callType,
      callTypes, // expects comma-separated values like "INCOMING,OUTGOING"
      deviceId,
      location,
      clientNumber,
      page = 1,
      limit = 100,
    } = req.query;

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
    if (callTypes) {
      const typesArray = callTypes
        .split(",")
        .map((t) => t.trim().toUpperCase());
      query.callType = { $in: typesArray };
    }

    if (deviceId) query.deviceId = deviceId;
    if (location) query.location = location;
    if (clientNumber) {
      query.clientNumber = {
        $regex: clientNumber.replace(/\D/g, "").slice(-10),
        $options: "i",
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await CallLog.countDocuments(query);
    const logs = await CallLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, total, logs });
  } catch (err) {
    console.error("❌ Error fetching logs:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ PUT: Update status (remark/note) of a call log
router.put("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || typeof status !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status value" });
  }

  try {
    const updated = await CallLog.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Call log not found" });
    }

    res.json({ success: true, message: "Status updated", data: updated });
  } catch (err) {
    console.error("❌ Error updating status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Generate pre-signed URL for S3 upload
router.get("/generate-upload-url", async (req, res) => {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ error: "Missing filename in query" });
    }

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      signatureVersion: "v4",
    });

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `mobile_recordings/${filename}`,
      Expires: 120,
      ContentType: "audio/mpeg", // or 'audio/3gpp', based on your recordings
    };

    const uploadURL = await s3.getSignedUrlPromise("putObject", params);

    res.json({ uploadURL });
  } catch (err) {
    console.error("Error generating signed URL:", err);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
});

// ✅ PUT: Update status of most recent log for given deviceId and clientNumber
router.put("/update-latest", async (req, res) => {
  try {
    const { deviceId, clientNumber, status } = req.body;

    if (!deviceId || !clientNumber || !status) {
      return res.status(400).json({
        success: false,
        message: "deviceId, clientNumber, and status are required",
      });
    }

    // Normalize number (last 10 digits)
    const normalizedNumber = clientNumber.replace(/\D/g, "").slice(-10);

    // Find the most recent matching log
    const latestLog = await CallLog.findOne({
      deviceId,
      clientNumber: { $regex: normalizedNumber, $options: "i" },
    })
      .sort({ timestamp: -1 });

    if (!latestLog) {
      return res.status(404).json({
        success: false,
        message: "No matching log found",
      });
    }

    latestLog.status = status;
    await latestLog.save();

    res.json({
      success: true,
      message: "Status updated for most recent log",
      data: latestLog,
    });
  } catch (err) {
    console.error("❌ Error updating latest status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/get-recording-url", auth, async (req, res) => {
  try {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ success: false, message: "Missing filename" });
    }

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      signatureVersion: "v4",
    });

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: `mobile_recordings/${filename}`,
      Expires: 60 * 5, // valid for 5 minutes
    };

    const url = await s3.getSignedUrlPromise("getObject", params);

    res.json({ success: true, url });
  } catch (err) {
    console.error("❌ Error generating download URL:", err);
    res.status(500).json({ success: false, message: "Failed to generate recording URL" });
  }
});

router.get("/get-recordings-by-number", auth, async (req, res) => {
  try {
    const { number } = req.query;

    if (!number) {
      return res.status(400).json({ success: false, message: "Missing number" });
    }

    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      signatureVersion: "v4",
    });

    const prefix = `mobile_recordings/`;
    const normalizedNumber = number.replace(/\D/g, '').slice(-10); // Extract last 10 digits

    const listParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Prefix: prefix,
    };

    const data = await s3.listObjectsV2(listParams).promise();

    const matched = data.Contents.filter(obj => {
      const key = obj.Key.toLowerCase();
      return (
        key.includes(`(0091${normalizedNumber})`) ||
        key.includes(`(${normalizedNumber})`)
      );
    }).map(obj => {
      const key = obj.Key.replace(prefix, "");
      const match = key.match(/_([0-9]{14})\.mp3$/);
      const parsedTimestamp = match
        ? new Date(`${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}T${match[1].slice(8, 10)}:${match[1].slice(10, 12)}:${match[1].slice(12, 14)}Z`)
        : obj.LastModified;

      return {
        filename: key,
        recordingTimestamp: parsedTimestamp,
        s3Timestamp: obj.LastModified,
        key: obj.Key,
      };
    });

    res.json({ success: true, recordings: matched });
  } catch (err) {
    console.error("❌ Error listing recordings:", err);
    res.status(500).json({ success: false, message: "Failed to list recordings" });
  }
});



module.exports = router;
