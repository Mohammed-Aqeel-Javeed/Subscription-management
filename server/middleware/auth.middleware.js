import jwt from 'jsonwebtoken';
var JWT_SECRET = process.env.JWT_SECRET || "subs_secret_key";
export var authenticateToken = function (req, res, next) {
    var token;
    // Support both Authorization header and cookie
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.replace("Bearer ", "");
    }
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    if (!token) {
        return res.status(401).json({ message: "Access token required" });
    }
    try {
        var decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};
// Optional authentication - sets user if token exists but doesn't fail if missing
export var optionalAuth = function (req, res, next) {
    var token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.replace("Bearer ", "");
    }
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }
    if (token) {
        try {
            var decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        }
        catch (err) {
            req.user = undefined;
        }
    }
    next();
};
