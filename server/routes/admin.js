import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';

const router = express.Router();

// Protect all admin endpoints with JWT authentication and admin role verification
router.use(authMiddleware);
router.use(adminMiddleware);

// 1. Get System Statistics
router.get('/stats', async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;

    let userCount = 0;
    let projectCount = 0;

    if (isDbConnected) {
      userCount = await User.countDocuments();
      projectCount = await Project.countDocuments();
    }

    res.json({
      users: userCount,
      projects: projectCount,
      database: {
        connected: isDbConnected,
        state: mongoose.connection.readyState,
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Failed to retrieve system statistics' });
  }
});

// 2. Get All Users (with project counts)
router.get('/users', async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return res.json([]);
    }

    const users = await User.find().sort({ createdAt: -1 });

    // Aggregate project count per user
    const counts = await Project.aggregate([
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    counts.forEach((item) => {
      if (item._id) countMap[item._id.toString()] = item.count;
    });

    const userList = users.map((u) => {
      const safe = u.toSafeObject();
      safe.projectCount = countMap[safe.id] || 0;
      return safe;
    });

    res.json(userList);
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ message: 'Failed to retrieve user list' });
  }
});

// 3. Get All Resumes/Projects (Across all users)
router.get('/projects', async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      return res.json([]);
    }

    const projects = await Project.find()
      .populate('userId', 'name email role')
      .sort({ updatedAt: -1 });

    const formatted = projects.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      owner: p.owner,
      contentLength: (p.content || '').length,
      lineCount: (p.content || '').split('\n').length,
      archived: p.archived,
      trashed: p.trashed,
      lastModified: p.lastModified || p.updatedAt,
      createdAt: p.createdAt,
      user: p.userId
        ? {
            id: p.userId._id?.toString(),
            name: p.userId.name,
            email: p.userId.email,
            role: p.userId.role,
          }
        : { name: 'Unknown', email: 'N/A' },
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Admin get projects error:', err);
    res.status(500).json({ message: 'Failed to retrieve resume database' });
  }
});

// 4. Get Single Resume Details (with full LaTeX code)
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('userId', 'name email role');
    if (!project) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({
      id: project._id.toString(),
      title: project.title,
      owner: project.owner,
      content: project.content,
      archived: project.archived,
      trashed: project.trashed,
      lastModified: project.lastModified || project.updatedAt,
      createdAt: project.createdAt,
      user: project.userId
        ? {
            id: project.userId._id?.toString(),
            name: project.userId.name,
            email: project.userId.email,
          }
        : null,
    });
  } catch (err) {
    console.error('Admin get single project error:', err);
    res.status(500).json({ message: 'Failed to retrieve resume content' });
  }
});

// 5. Update User Role (Promote / Demote)
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (role === 'admin') {
      return res.status(403).json({ message: 'Only Shubh Namdeo is authorized as Administrator. No other accounts can be granted admin privileges.' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent demoting the administrator
    if (user.role === 'admin' && (user.name?.toLowerCase().includes('shubh') || user.email?.toLowerCase().includes('shubh'))) {
      return res.status(400).json({ message: 'Cannot demote Shubh Namdeo, the designated sole Administrator' });
    }

    user.role = role;
    await user.save();

    res.json({
      message: `User role updated to ${role}`,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Admin update user role error:', err);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// 6. Delete User & Cascade Resumes
router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own administrator account' });
    }

    const user = await User.findById(targetId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Cascade delete all user's projects
    const deleteProjectsResult = await Project.deleteMany({ userId: targetId });
    await User.findByIdAndDelete(targetId);

    res.json({
      message: 'User and all associated resumes deleted successfully',
      deletedResumesCount: deleteProjectsResult.deletedCount,
    });
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user account' });
  }
});

// 7. Delete Resume
router.delete('/projects/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json({ message: 'Resume deleted successfully' });
  } catch (err) {
    console.error('Admin delete project error:', err);
    res.status(500).json({ message: 'Failed to delete resume' });
  }
});

// 8. Edit / Update Resume (Admin Override)
router.put('/projects/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    if (title !== undefined) project.title = title.trim();
    if (content !== undefined) project.content = content;
    project.lastModified = new Date();

    await project.save();

    res.json({
      message: 'Resume updated successfully by administrator',
      project: project.toJSON(),
    });
  } catch (err) {
    console.error('Admin update project error:', err);
    res.status(500).json({ message: 'Failed to update resume' });
  }
});

export default router;
