import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "./config";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function userMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];

  if (!header || typeof header !== "string") {
    res.status(401).json({ message: "You are not logged in" });
    return;
  }

  try {
    const decoded = jwt.verify(header, JWT_SECRET);
    if (typeof decoded === "string" || !("id" in decoded)) {
      res.status(401).json({ message: "You are not logged in" });
      return;
    }
    req.userId = (decoded as JwtPayload).id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}
