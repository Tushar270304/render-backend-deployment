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
    const { filename, phoneNumber, timestamp, deviceId } = req.query;

    if (!filename || !phoneNumber || !timestamp || !deviceId) {
      return res.status(400).json({ error: "Missing required query parameters: filename, phoneNumber, timestamp, deviceId are required." });
    }

    const recordingEndTime = parseInt(timestamp, 10);
    const normalizedNumber = phoneNumber.replace(/\D/g, ""); // Normalize the number

    const candidateLog = await CallLog.findOne({
      deviceId: deviceId,
      clientNumber: { $regex: normalizedNumber.slice(-10), $options: "i" }, // Match last 10 digits
      recordingFile: { $exists: false }, // Must not already be linked
      timestamp: { $lt: new Date(recordingEndTime) }, // Call started before recording ended
    }).sort({ timestamp: -1 }); // Get the most recent one first

    if (candidateLog) {
      const calculatedStartTime = recordingEndTime - (candidateLog.duration * 1000);
      const timeDifference = Math.abs(candidateLog.timestamp.getTime() - calculatedStartTime);

      if (timeDifference < 45000) {
        candidateLog.recordingFile = filename;
        await candidateLog.save();
        console.log(`✅ Recording "${filename}" successfully linked to call log ID ${candidateLog._id}.`);
      } else {
        console.warn(`⚠️ Found a candidate log for "${filename}", but the duration didn't match. Time difference was ${timeDifference}ms. Not linking.`);
      }
    } else {
        console.log(`ℹ️ No unlinked call log found for recording "${filename}". It will be uploaded without a link.`);
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
      ContentType: "audio/mpeg", // Adjust if you have other formats like .m4a
    };

    const uploadURL = await s3.getSignedUrlPromise("putObject", params);

    res.json({ uploadURL });

  } catch (err) {
    console.error("❌ Error generating signed URL or linking recording:", err);
    res.status(500).json({ error: "Failed to process recording upload request." });
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

router.get("/get-closest-recording", auth, async (req, res) => {
  const { number, timestamp } = req.query;

  if (!number || !timestamp) {
    return res.status(400).json({ success: false, message: "Missing number or timestamp" });
  }

  const normalizedNumber = number.replace(/\D/g, '').slice(-10);
  const expectedTime = new Date(Number(timestamp));
  
  const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    signatureVersion: "v4",
  });

  const listParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Prefix: 'mobile_recordings/',
  };

  try {
    const data = await s3.listObjectsV2(listParams).promise();

    const matchedFiles = data.Contents
      .filter(obj => obj.Key.includes(`(${normalizedNumber})`))
      .map(obj => {
        const key = obj.Key;
        const match = key.match(/_([0-9]{14})\.mp3$/);
        if (!match) return null;

        const timeStr = match[1];
        let fileDate = new Date(`${timeStr.slice(0,4)}-${timeStr.slice(4,6)}-${timeStr.slice(6,8)}T${timeStr.slice(8,10)}:${timeStr.slice(10,12)}:${timeStr.slice(12,14)}Z`);
        
        // 👇 **THE FIX IS HERE** 👇
        // Assume the filename is in IST and convert it to UTC by subtracting 5.5 hours.
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        fileDate = new Date(fileDate.getTime() - istOffsetMs);

        const diff = Math.abs(fileDate.getTime() - expectedTime.getTime());

        return { key, fileDate, diff };
      })
      .filter(Boolean) // Remove any nulls from non-matching filenames
      .sort((a, b) => a.diff - b.diff);

    if (matchedFiles.length === 0 || matchedFiles[0].diff > 600000) { // 10-minute threshold
      return res.status(404).json({ success: false, message: "No close match found" });
    }

    const closestFileKey = matchedFiles[0].key;
    const signedUrl = await s3.getSignedUrlPromise("getObject", {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: closestFileKey,
      Expires: 60 * 5, // 5 minutes
    });

    res.json({ success: true, url: signedUrl });

  } catch (err) {
    console.error("❌ Error in get-closest-recording:", err);
    res.status(500).json({ success: false, message: "Server error while processing S3 files" });
  }
});




module.exports = router;
