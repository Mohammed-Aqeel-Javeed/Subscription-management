
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
// @ts-ignore
import { registerRoutes } from "./routes.js";

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}



const app = express();
// CORS must be the first middleware
app.use(cors({
  origin: [
    "https://subscription-management-6uje.onrender.com",
    "http://localhost:5173"
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(res, bodyJson);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {

  // Example: Secure cookie setup in login route (adjust as needed)
  // app.post("/api/login", (req, res) => {
  //   // ...login logic...
  //   res.cookie("token", token, {
  //     httpOnly: true,
  //     secure: true,
  //     sameSite: "none",
  //   });
  //   res.json({ message: "Login successful" });
  // });

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files from client/dist in all environments
  const expressStatic = require("express").static;
  const path = require("path");
  const publicPath = path.join(process.cwd(), "dist/public");
  app.use(expressStatic(publicPath));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicPath, "index.html"));
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
