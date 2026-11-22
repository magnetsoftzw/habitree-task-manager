const mongoose = require('mongoose');
const Project = require('../models/project');

const findAccessibleProject = async (projectId, userId) => {
    if (!mongoose.isValidObjectId(projectId)) return null;
    return Project.findOne({
        _id: projectId,
        $or: [{ owner: userId }, { collaborators: userId }],
    });
};

const PROJECT_PALETTE = ['#C2410C', '#1F5FAD', '#1E6B47', '#6B5BD2', '#C2185B', '#0E7C7B', '#B45309'];

const projectColor = (project) => {
    if (project?.color) return project.color;
    const id = String(project?._id || '');
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return PROJECT_PALETTE[hash % PROJECT_PALETTE.length];
};

module.exports = { findAccessibleProject, projectColor, PROJECT_PALETTE };
