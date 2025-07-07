const jwt = require("jsonwebtoken");

const auth = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const token = req.headers.authorization?.split(" ")[1];
  const validApiKey = process.env.REACT_APP_API_KEY;
  const jwtSecret = process.env.JWT_SECRET;

  if (apiKey && apiKey === validApiKey) {
    req.user = { role: "web" };
    return next();
  }

  if (token) {
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err)
        return res
          .status(403)
          .json({ success: false, message: "Invalid token" });
      req.user = decoded;
      return next();
    });
  } else {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }
};

module.exports = auth;
