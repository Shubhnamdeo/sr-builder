import express from 'express';
import Project, { MAX_RESUMES_PER_USER } from '../models/Project.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// All project routes require authentication
router.use(authMiddleware);

// 1. Get all projects for logged-in user
router.get('/', async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user._id }).sort({ lastModified: -1 });
    res.json(projects);
  } catch (err) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// 2. Create a new project (Enforcing 10-resume limit per user)
router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Project title is required' });
    }

    const activeCount = await Project.countDocuments({
      userId: req.user._id,
      trashed: false,
    });

    if (activeCount >= MAX_RESUMES_PER_USER) {
      return res.status(403).json({
        message: `Cloud storage limit reached (${activeCount}/${MAX_RESUMES_PER_USER} resumes). Please delete or trash an older resume to create a new one.`,
      });
    }

    const project = await Project.create({
      userId: req.user._id,
      title: title.trim(),
      owner: 'You',
      content: content || '',
      lastModified: new Date(),
    });

    res.status(201).json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ message: 'Failed to create project' });
  }
});

// 3. Get single project by ID
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ message: 'Failed to retrieve project' });
  }
});

// 4. Update project (code, title, archive, trash)
router.put('/:id', async (req, res) => {
  try {
    const { title, content, archived, trashed } = req.body;

    const updates = { lastModified: new Date() };
    if (typeof title === 'string') updates.title = title.trim();
    if (typeof content === 'string') updates.content = content;
    if (typeof archived === 'boolean') updates.archived = archived;
    if (typeof trashed === 'boolean') updates.trashed = trashed;

    const updated = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ message: 'Failed to update project' });
  }
});

// 5. Permanently delete project
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project permanently deleted', id: req.params.id });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ message: 'Failed to delete project' });
  }
});

// 6. Bulk migration / sync from localStorage to MongoDB
router.post('/sync-local', async (req, res) => {
  try {
    const { localProjects } = req.body;
    if (!Array.isArray(localProjects) || localProjects.length === 0) {
      return res.status(400).json({ message: 'No local projects to sync' });
    }

    let importedCount = 0;
    for (const p of localProjects) {
      const activeCount = await Project.countDocuments({
        userId: req.user._id,
        trashed: false,
      });

      if (activeCount >= MAX_RESUMES_PER_USER) break;

      await Project.create({
        userId: req.user._id,
        title: p.title || 'Untitled Resume',
        owner: 'You',
        content: p.content || '',
        archived: !!p.archived,
        trashed: !!p.trashed,
        lastModified: p.lastModified ? new Date(p.lastModified) : new Date(),
      });
      importedCount++;
    }

    const allProjects = await Project.find({ userId: req.user._id }).sort({ lastModified: -1 });
    res.json({ message: `Successfully synced ${importedCount} projects to cloud`, projects: allProjects });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ message: 'Failed to sync local projects' });
  }
});

export default router;
