import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import dotenv from "dotenv";

import { getMatchmakingAdvice } from "./src/lib/gemini.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("hr_nexus.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK(role IN ('buyer', 'seller')) NOT NULL,
    bio TEXT,
    avatar TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    buyer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    budget_min INTEGER,
    budget_max INTEGER,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(buyer_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    proposal TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id),
    FOREIGN KEY(seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  -- Seed Data
  INSERT OR IGNORE INTO users (id, name, email, role, bio, avatar) VALUES 
  ('buyer_1', 'Acme Corp HR', 'hr@acme.com', 'buyer', 'Fast-growing tech startup looking for HR expertise.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Acme'),
  ('seller_1', 'Sarah Jenkins', 'sarah@hrconsulting.com', 'seller', 'Senior HR Consultant with 10 years experience in tech recruitment and organizational design.', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah');

  INSERT OR IGNORE INTO projects (id, buyer_id, title, description, budget_min, budget_max) VALUES 
  ('p1', 'buyer_1', 'Technical Recruitment for Engineering Team', 'We are looking for a specialized recruiter to help us hire 5 senior software engineers and 2 product managers over the next 3 months.', 5000, 15000),
  ('p2', 'buyer_1', 'Organizational Culture Audit', 'Need an HR expert to conduct a full culture audit and provide recommendations for improving employee engagement in a remote-first environment.', 3000, 8000);
`);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT projects.*, users.name as buyer_name FROM projects JOIN users ON projects.buyer_id = users.id ORDER BY created_at DESC").all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { id, buyer_id, title, description, budget_min, budget_max } = req.body;
    try {
      db.prepare("INSERT INTO projects (id, buyer_id, title, description, budget_min, budget_max) VALUES (?, ?, ?, ?, ?, ?)").run(id, buyer_id, title, description, budget_min, budget_max);
      
      // Auto-create milestones
      const milestones = [
        { id: crypto.randomUUID(), project_id: id, title: 'Project Kickoff & Strategy', amount: Math.floor(budget_min * 0.2) },
        { id: crypto.randomUUID(), project_id: id, title: 'Initial Talent Sourcing', amount: Math.floor(budget_min * 0.4) },
        { id: crypto.randomUUID(), project_id: id, title: 'Final Placement & Onboarding', amount: Math.floor(budget_min * 0.4) },
      ];
      
      const insertMilestone = db.prepare("INSERT INTO milestones (id, project_id, title, amount) VALUES (?, ?, ?, ?)");
      for (const m of milestones) {
        insertMilestone.run(m.id, m.project_id, m.title, m.amount);
      }

      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/users/:id", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  });

  app.post("/api/users", (req, res) => {
    const { id, name, email, role, bio, avatar } = req.body;
    try {
      db.prepare("INSERT OR REPLACE INTO users (id, name, email, role, bio, avatar) VALUES (?, ?, ?, ?, ?, ?)").run(id, name, email, role, bio, avatar);
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/projects/:id/bids", (req, res) => {
    const bids = db.prepare("SELECT bids.*, users.name as seller_name FROM bids JOIN users ON bids.seller_id = users.id WHERE project_id = ?").all(req.params.id);
    res.json(bids);
  });

  app.post("/api/bids", (req, res) => {
    const { id, project_id, seller_id, amount, proposal } = req.body;
    try {
      db.prepare("INSERT INTO bids (id, project_id, seller_id, amount, proposal) VALUES (?, ?, ?, ?, ?)").run(id, project_id, seller_id, amount, proposal);
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/projects/:id/milestones", (req, res) => {
    const milestones = db.prepare("SELECT * FROM milestones WHERE project_id = ?").all(req.params.id);
    res.json(milestones);
  });

  app.post("/api/milestones", (req, res) => {
    const { id, project_id, title, amount } = req.body;
    try {
      db.prepare("INSERT INTO milestones (id, project_id, title, amount) VALUES (?, ?, ?, ?)").run(id, project_id, title, amount);
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/projects/:id/matchmaking", async (req, res) => {
    try {
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
      const sellers = db.prepare("SELECT * FROM users WHERE role = 'seller'").all();
      
      if (!project) return res.status(404).json({ error: "Project not found" });
      
      const advice = await getMatchmakingAdvice(
        project.description, 
        sellers.map(s => `${s.name}: ${s.bio}`)
      );
      
      res.json({ advice });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Socket.io for Real-time Chat
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their room`);
    });

    socket.on("send_message", (data) => {
      const { sender_id, receiver_id, content } = data;
      db.prepare("INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)").run(sender_id, receiver_id, content);
      io.to(receiver_id).emit("receive_message", data);
      socket.emit("receive_message", data); // Echo back to sender
    });

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
