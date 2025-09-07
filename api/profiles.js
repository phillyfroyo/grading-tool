// api/profiles.js - Prisma-powered profiles API
import express from "express";
import { prisma } from "../lib/prisma.js";

const app = express();
app.use(express.json({ limit: '10mb' }));

// Get all profiles
app.get("/api/profiles", async (req, res) => {
  try {
    const profiles = await prisma.classProfile.findMany({
      orderBy: { lastModified: 'desc' }
    });
    res.json({ profiles });
  } catch (error) {
    console.error('Error loading profiles:', error);
    res.status(500).json({ error: "Error loading profiles" });
  }
});

// Create new profile
app.post("/api/profiles", async (req, res) => {
  try {
    const newProfile = await prisma.classProfile.create({
      data: {
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
      }
    });
    res.json(newProfile);
  } catch (error) {
    console.error('Error creating profile:', error);
    res.status(500).json({ error: "Error creating profile" });
  }
});

// Update profile
app.put("/api/profiles/:id", async (req, res) => {
  try {
    const updatedProfile = await prisma.classProfile.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        cefrLevel: req.body.cefrLevel,
        vocabulary: req.body.vocabulary || [],
        grammar: req.body.grammar || [],
        prompt: req.body.prompt || '',
      }
    });
    res.json(updatedProfile);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error('Error updating profile:', error);
    res.status(500).json({ error: "Error updating profile" });
  }
});

// Delete profile
app.delete("/api/profiles/:id", async (req, res) => {
  try {
    await prisma.classProfile.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: "Profile not found" });
    }
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: "Error deleting profile" });
  }
});

export default app;